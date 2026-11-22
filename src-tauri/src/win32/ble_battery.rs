use std::time::{Duration, Instant};

use windows::{
    core::{Error, Result, RuntimeType, HSTRING},
    Devices::{
        Bluetooth::{
            BluetoothCacheMode, BluetoothConnectionStatus, BluetoothLEDevice,
            GenericAttributeProfile::{GattCharacteristicUuids, GattCommunicationStatus, GattDeviceService, GattServiceUuids},
        },
        Enumeration::DeviceInformation,
    },
    Storage::Streams::DataReader,
    Win32::Foundation::E_ABORT,
};
use windows_future::{AsyncStatus, IAsyncOperation};

const STEP_LIMIT: Duration = Duration::from_secs(3);
const ROUND_LIMIT: Duration = Duration::from_secs(10);
const STATUS_POLL: Duration = Duration::from_millis(20);

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BleDevice {
    pub(crate) address: String,
    pub(crate) name: String,
    pub(crate) appearance: u16,
    pub(crate) battery: u8,
}

fn wait<T: RuntimeType + 'static>(operation: IAsyncOperation<T>) -> Result<T> {
    let deadline = Instant::now() + STEP_LIMIT;
    while operation.Status()? == AsyncStatus::Started {
        if Instant::now() >= deadline {
            let _ = operation.Cancel();
            return Err(Error::from(E_ABORT));
        }
        std::thread::sleep(STATUS_POLL);
    }
    operation.GetResults()
}

fn connected_ids() -> Result<Vec<HSTRING>> {
    let selector = BluetoothLEDevice::GetDeviceSelectorFromConnectionStatus(BluetoothConnectionStatus::Connected)?;
    let found = wait(DeviceInformation::FindAllAsyncAqsFilter(&selector)?)?;
    let mut ids = Vec::new();
    for index in 0..found.Size()? {
        ids.push(found.GetAt(index)?.Id()?);
    }
    Ok(ids)
}

fn read_level(service: &GattDeviceService) -> Result<Option<u8>> {
    let found = wait(service.GetCharacteristicsForUuidWithCacheModeAsync(
        GattCharacteristicUuids::BatteryLevel()?,
        BluetoothCacheMode::Cached,
    )?)?;
    if found.Status()? != GattCommunicationStatus::Success {
        return Ok(None);
    }
    let characteristics = found.Characteristics()?;
    for index in 0..characteristics.Size()? {
        let read = wait(characteristics.GetAt(index)?.ReadValueWithCacheModeAsync(BluetoothCacheMode::Uncached)?)?;
        if read.Status()? != GattCommunicationStatus::Success {
            continue;
        }
        let value = read.Value()?;
        if value.Length()? == 0 {
            continue;
        }
        let level = DataReader::FromBuffer(&value)?.ReadByte()?;
        if level <= 100 {
            return Ok(Some(level));
        }
    }
    Ok(None)
}

fn battery(device: &BluetoothLEDevice) -> Result<Option<u8>> {
    let found =
        wait(device.GetGattServicesForUuidWithCacheModeAsync(GattServiceUuids::Battery()?, BluetoothCacheMode::Cached)?)?;
    if found.Status()? != GattCommunicationStatus::Success {
        return Ok(None);
    }
    let services = found.Services()?;
    let mut level = None;
    for index in 0..services.Size()? {
        let service = services.GetAt(index)?;
        if level.is_none() {
            level = read_level(&service).ok().flatten();
        }
        let _ = service.Close();
    }
    Ok(level)
}

fn describe(id: &HSTRING) -> Result<Option<BleDevice>> {
    let device = wait(BluetoothLEDevice::FromIdAsync(id)?)?;
    let described = match battery(&device).ok().flatten() {
        Some(level) => Some(BleDevice {
            address: format!("{:012X}", device.BluetoothAddress()?),
            name: device.Name()?.to_string_lossy(),
            appearance: device.Appearance().and_then(|appearance| appearance.RawValue()).unwrap_or(0),
            battery: level,
        }),
        None => None,
    };
    let _ = device.Close();
    Ok(described)
}

pub(crate) fn connected_devices() -> Vec<BleDevice> {
    let started = Instant::now();
    let Ok(ids) = connected_ids() else {
        return Vec::new();
    };
    ids.iter()
        .take_while(|_| started.elapsed() < ROUND_LIMIT)
        .filter_map(|id| describe(id).ok().flatten())
        .collect()
}
