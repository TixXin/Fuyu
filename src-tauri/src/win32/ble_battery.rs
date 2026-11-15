use windows::{
    core::{Result, HSTRING},
    Devices::{
        Bluetooth::{
            BluetoothCacheMode, BluetoothConnectionStatus, BluetoothLEDevice,
            GenericAttributeProfile::{GattCharacteristicUuids, GattCommunicationStatus, GattDeviceService, GattServiceUuids},
        },
        Enumeration::DeviceInformation,
    },
    Storage::Streams::DataReader,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BleDevice {
    pub(crate) address: String,
    pub(crate) name: String,
    pub(crate) appearance: u16,
    pub(crate) battery: Option<u8>,
}

fn connected_ids() -> Result<Vec<HSTRING>> {
    let selector = BluetoothLEDevice::GetDeviceSelectorFromConnectionStatus(BluetoothConnectionStatus::Connected)?;
    let found = DeviceInformation::FindAllAsyncAqsFilter(&selector)?.join()?;
    let mut ids = Vec::new();
    for index in 0..found.Size()? {
        ids.push(found.GetAt(index)?.Id()?);
    }
    Ok(ids)
}

fn read_level(service: &GattDeviceService) -> Result<Option<u8>> {
    let found = service
        .GetCharacteristicsForUuidWithCacheModeAsync(GattCharacteristicUuids::BatteryLevel()?, BluetoothCacheMode::Cached)?
        .join()?;
    if found.Status()? != GattCommunicationStatus::Success {
        return Ok(None);
    }
    let characteristics = found.Characteristics()?;
    for index in 0..characteristics.Size()? {
        let read = characteristics.GetAt(index)?.ReadValueWithCacheModeAsync(BluetoothCacheMode::Uncached)?.join()?;
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
    let found = device.GetGattServicesForUuidWithCacheModeAsync(GattServiceUuids::Battery()?, BluetoothCacheMode::Cached)?.join()?;
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

fn describe(id: &HSTRING, wanted: impl Fn(u16) -> bool) -> Result<Option<BleDevice>> {
    let device = BluetoothLEDevice::FromIdAsync(id)?.join()?;
    let appearance = device.Appearance()?.RawValue()?;
    let described = if wanted(appearance) {
        Some(BleDevice {
            address: format!("{:012X}", device.BluetoothAddress()?),
            name: device.Name()?.to_string_lossy(),
            appearance,
            battery: battery(&device).ok().flatten(),
        })
    } else {
        None
    };
    let _ = device.Close();
    Ok(described)
}

pub(crate) fn connected_devices(wanted: impl Fn(u16) -> bool) -> Vec<BleDevice> {
    let Ok(ids) = connected_ids() else {
        return Vec::new();
    };
    ids.iter().filter_map(|id| describe(id, &wanted).ok().flatten()).collect()
}
