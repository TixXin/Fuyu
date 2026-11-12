use windows::{
    core::{Result, PWSTR},
    Win32::{
        Devices::FunctionDiscovery::{PKEY_Device_EnumeratorName, PKEY_Device_FriendlyName},
        Foundation::PROPERTYKEY,
        Media::Audio::{eRender, IMMDevice, IMMDeviceEnumerator, MMDeviceEnumerator, PKEY_AudioEndpoint_FormFactor, DEVICE_STATE_ACTIVE},
        System::Com::{
            CoCreateInstance, CoTaskMemFree,
            StructuredStorage::{PropVariantClear, PropVariantToStringAlloc, PropVariantToUInt32, PROPVARIANT},
            CLSCTX_ALL, STGM_READ,
        },
        UI::Shell::PropertiesSystem::IPropertyStore,
    },
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct AudioOutputInfo {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) form_factor: u32,
    pub(crate) enumerator: String,
}

pub(crate) fn active_outputs() -> Result<Vec<AudioOutputInfo>> {
    unsafe {
        let devices: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        let collection = devices.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)?;
        let count = collection.GetCount()?;
        let mut outputs = Vec::with_capacity(count as usize);
        for index in 0..count {
            if let Ok(output) = collection.Item(index).and_then(|device| describe(&device)) {
                outputs.push(output);
            }
        }
        Ok(outputs)
    }
}

fn describe(device: &IMMDevice) -> Result<AudioOutputInfo> {
    let (id, store) = unsafe {
        let raw = device.GetId()?;
        let id = raw.to_string();
        CoTaskMemFree(Some(raw.0 as *const _));
        (id.map_err(|_| windows::core::Error::empty())?, device.OpenPropertyStore(STGM_READ)?)
    };
    Ok(AudioOutputInfo {
        id,
        name: read_string(&store, &PKEY_Device_FriendlyName).unwrap_or_default(),
        form_factor: read_u32(&store, &PKEY_AudioEndpoint_FormFactor).unwrap_or(0),
        enumerator: read_string(&store, &PKEY_Device_EnumeratorName).unwrap_or_default(),
    })
}

fn read<T>(store: &IPropertyStore, key: &PROPERTYKEY, convert: impl FnOnce(&PROPVARIANT) -> Option<T>) -> Option<T> {
    unsafe {
        let mut value = store.GetValue(key).ok()?;
        let result = convert(&value);
        let _ = PropVariantClear(&mut value);
        result
    }
}

fn read_string(store: &IPropertyStore, key: &PROPERTYKEY) -> Option<String> {
    read(store, key, |value| {
        unsafe {
            let text: PWSTR = PropVariantToStringAlloc(value).ok()?;
            let copy = text.to_string().ok();
            CoTaskMemFree(Some(text.0 as *const _));
            copy
        }
    })
}

fn read_u32(store: &IPropertyStore, key: &PROPERTYKEY) -> Option<u32> {
    read(store, key, |value| unsafe { PropVariantToUInt32(value) }.ok())
}
