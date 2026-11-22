use windows::{
    core::{GUID, HSTRING, PCWSTR},
    Win32::{
        Devices::{
            DeviceAndDriverInstallation::{
                CM_Get_DevNode_PropertyW, CM_Get_Device_ID_ListW, CM_Get_Device_ID_List_SizeW, CM_Locate_DevNodeW,
                CM_GETIDLIST_FILTER_ENUMERATOR, CM_GETIDLIST_FILTER_PRESENT, CM_LOCATE_DEVNODE_NORMAL, CR_BUFFER_SMALL,
                CR_SUCCESS,
            },
            Properties::{
                DEVPKEY_Device_ClassGuid, DEVPKEY_Device_ContainerId, DEVPKEY_Device_FriendlyName, DEVPROPTYPE,
                DEVPROP_TYPE_BYTE, DEVPROP_TYPE_GUID, DEVPROP_TYPE_STRING,
            },
        },
        Foundation::DEVPROPKEY,
    },
};

const DEVPKEY_BLUETOOTH_BATTERY: DEVPROPKEY = DEVPROPKEY {
    fmtid: GUID::from_u128(0x104ea319_6ee2_4701_bd47_8ddbf425bbe5),
    pid: 2,
};

const DEVPKEY_BLUETOOTH_ADDRESS: DEVPROPKEY = DEVPROPKEY {
    fmtid: GUID::from_u128(0x2bd67d8b_8beb_48d5_87e0_6cda3428040a),
    pid: 1,
};

const BLUETOOTH_ENUMERATORS: [&str; 4] = ["BTHENUM", "BTHHFENUM", "BTHLE", "BTHLEDEVICE"];
const HID_ENUMERATOR: &str = "HID";

#[derive(Debug, Clone)]
pub(crate) struct BluetoothNode {
    pub(crate) instance_id: String,
    pub(crate) container: GUID,
    pub(crate) address: Option<String>,
    pub(crate) name: Option<String>,
    pub(crate) battery: Option<u8>,
}

fn locate(instance_id: &str) -> Option<u32> {
    let id = HSTRING::from(instance_id);
    let mut node = 0u32;
    let result = unsafe { CM_Locate_DevNodeW(&mut node, PCWSTR(id.as_ptr()), CM_LOCATE_DEVNODE_NORMAL) };
    (result == CR_SUCCESS).then_some(node)
}

fn property<T: Copy + Default>(node: u32, key: &DEVPROPKEY, expected: DEVPROPTYPE) -> Option<T> {
    let mut value = T::default();
    let mut kind = DEVPROPTYPE::default();
    let mut size = std::mem::size_of::<T>() as u32;
    let result = unsafe {
        CM_Get_DevNode_PropertyW(node, key, &mut kind, Some((&mut value as *mut T).cast()), &mut size, 0)
    };
    (result == CR_SUCCESS && kind == expected && size as usize == std::mem::size_of::<T>()).then_some(value)
}

fn string_property(node: u32, key: &DEVPROPKEY) -> Option<String> {
    let mut kind = DEVPROPTYPE::default();
    let mut size = 0u32;
    let probe = unsafe { CM_Get_DevNode_PropertyW(node, key, &mut kind, None, &mut size, 0) };
    if probe != CR_BUFFER_SMALL || kind != DEVPROP_TYPE_STRING || size < 2 {
        return None;
    }
    let mut buffer = vec![0u16; (size as usize).div_ceil(2)];
    let result =
        unsafe { CM_Get_DevNode_PropertyW(node, key, &mut kind, Some(buffer.as_mut_ptr().cast()), &mut size, 0) };
    if result != CR_SUCCESS || kind != DEVPROP_TYPE_STRING {
        return None;
    }
    let end = buffer.iter().position(|&unit| unit == 0).unwrap_or(buffer.len());
    let text = String::from_utf16_lossy(&buffer[..end]).trim().to_string();
    (!text.is_empty()).then_some(text)
}

pub(crate) fn container_id(instance_id: &str) -> Option<GUID> {
    property(locate(instance_id)?, &DEVPKEY_Device_ContainerId, DEVPROP_TYPE_GUID)
}

fn device_ids(enumerator: &str) -> Vec<String> {
    let filter = HSTRING::from(enumerator);
    let flags = CM_GETIDLIST_FILTER_ENUMERATOR | CM_GETIDLIST_FILTER_PRESENT;
    let mut length = 0u32;
    if unsafe { CM_Get_Device_ID_List_SizeW(&mut length, PCWSTR(filter.as_ptr()), flags) } != CR_SUCCESS {
        return Vec::new();
    }
    let mut buffer = vec![0u16; length as usize];
    if unsafe { CM_Get_Device_ID_ListW(PCWSTR(filter.as_ptr()), &mut buffer, flags) } != CR_SUCCESS {
        return Vec::new();
    }
    buffer
        .split(|&unit| unit == 0)
        .filter(|id| !id.is_empty())
        .map(String::from_utf16_lossy)
        .collect()
}

pub(crate) fn bluetooth_nodes() -> Vec<BluetoothNode> {
    BLUETOOTH_ENUMERATORS
        .iter()
        .flat_map(|enumerator| device_ids(enumerator))
        .filter_map(|instance_id| {
            let node = locate(&instance_id)?;
            let container = property::<GUID>(node, &DEVPKEY_Device_ContainerId, DEVPROP_TYPE_GUID)?;
            Some(BluetoothNode {
                container,
                address: string_property(node, &DEVPKEY_BLUETOOTH_ADDRESS),
                name: string_property(node, &DEVPKEY_Device_FriendlyName),
                battery: property::<u8>(node, &DEVPKEY_BLUETOOTH_BATTERY, DEVPROP_TYPE_BYTE).map(|level| level.min(100)),
                instance_id,
            })
        })
        .collect()
}

pub(crate) fn hid_classes() -> Vec<(GUID, GUID)> {
    device_ids(HID_ENUMERATOR)
        .iter()
        .filter_map(|instance_id| {
            let node = locate(instance_id)?;
            let container = property::<GUID>(node, &DEVPKEY_Device_ContainerId, DEVPROP_TYPE_GUID)?;
            let class = property::<GUID>(node, &DEVPKEY_Device_ClassGuid, DEVPROP_TYPE_GUID)?;
            Some((container, class))
        })
        .collect()
}
