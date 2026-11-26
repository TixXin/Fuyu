mod hidpp;

use std::{
    collections::HashMap,
    ffi::CString,
    sync::{Mutex, OnceLock, PoisonError},
    time::{Duration, Instant},
};

use hidapi::{DeviceInfo, HidApi, HidDevice};

use super::peripherals::{Peripheral, PeripheralKind};
use hidpp::{Params, Reply};

const LOGITECH: u16 = 0x046D;
const VENDOR_PAGE: u16 = 0xFF00;
const LONG_USAGE: u16 = 0x0002;
const RECEIVER_PRODUCTS: &[u16] = &[0xC52B, 0xC532, 0xC534, 0xC539, 0xC53A, 0xC53F, 0xC541, 0xC545, 0xC547, 0xC548, 0xC54D];
const SLOTS: std::ops::RangeInclusive<u8> = 1..=6;
const REPLY_WAIT: Duration = Duration::from_millis(250);
const RETRY_MISSING: Duration = Duration::from_secs(120);
const MAX_NAME: usize = 48;

#[derive(Clone)]
struct Known {
    battery: u8,
    unified: bool,
    name: String,
    kind: PeripheralKind,
}

enum Slot {
    Missing(Instant),
    Known(Known),
}

struct Receiver {
    path: CString,
    key: String,
}

fn slots() -> &'static Mutex<HashMap<(String, u8), Slot>> {
    static SLOT_CACHE: OnceLock<Mutex<HashMap<(String, u8), Slot>>> = OnceLock::new();
    SLOT_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn is_receiver(info: &DeviceInfo) -> bool {
    info.vendor_id() == LOGITECH
        && info.usage_page() == VENDOR_PAGE
        && (RECEIVER_PRODUCTS.contains(&info.product_id())
            || info.product_string().is_some_and(|name| name.to_ascii_lowercase().contains("receiver")))
}

fn receivers<'a>(list: impl Iterator<Item = &'a DeviceInfo>) -> Vec<Receiver> {
    let mut chosen: HashMap<String, (bool, CString)> = HashMap::new();
    for info in list.filter(|info| is_receiver(info)) {
        let key = format!(
            "logitech-{:04x}-{}-{}",
            info.product_id(),
            info.serial_number().unwrap_or_default(),
            info.interface_number()
        );
        let long = info.usage() == LONG_USAGE;
        let keep = chosen.get(&key).is_none_or(|(had_long, _)| long && !had_long);
        if keep {
            chosen.insert(key, (long, info.path().to_owned()));
        }
    }
    let mut found: Vec<Receiver> = chosen.into_iter().map(|(key, (_, path))| Receiver { path, key }).collect();
    found.sort_by(|a, b| a.key.cmp(&b.key));
    found
}

fn call(device: &HidDevice, slot: u8, feature: u8, function: u8, params: &[u8]) -> Option<Params> {
    let sent = hidpp::request(slot, feature, function, params);
    device.write(&sent).ok()?;
    let deadline = Instant::now() + REPLY_WAIT;
    let mut buffer = [0u8; 64];
    loop {
        let left = deadline.saturating_duration_since(Instant::now());
        if left.is_zero() {
            return None;
        }
        let millis = i32::try_from(left.as_millis()).unwrap_or(i32::MAX).max(1);
        let read = device.read_timeout(&mut buffer, millis).ok()?;
        if read == 0 {
            return None;
        }
        match hidpp::match_reply(&sent, &buffer[..read]) {
            Reply::Data(params) => return Some(params),
            Reply::Error => return None,
            Reply::Other => {}
        }
    }
}

fn feature_index(device: &HidDevice, slot: u8, feature: u16) -> Option<u8> {
    let reply = call(device, slot, hidpp::ROOT_FEATURE, hidpp::ROOT_GET_FEATURE, &hidpp::feature_id(feature))?;
    (reply[0] != 0).then_some(reply[0])
}

fn read_name(device: &HidDevice, slot: u8, index: u8) -> Option<String> {
    let length = usize::from(call(device, slot, index, hidpp::NAME_COUNT, &[])?[0]).min(MAX_NAME);
    let mut name = Vec::with_capacity(length);
    while name.len() < length {
        let offset = u8::try_from(name.len()).ok()?;
        let chunk = call(device, slot, index, hidpp::NAME_CHUNK, &[offset])?;
        let part = hidpp::name_chunk(&chunk, length - name.len());
        if part.is_empty() {
            break;
        }
        name.extend_from_slice(part);
    }
    let name = String::from_utf8_lossy(&name).trim().to_string();
    (!name.is_empty()).then_some(name)
}

fn probe(device: &HidDevice, slot: u8) -> Option<Known> {
    let (battery, unified) = match feature_index(device, slot, hidpp::UNIFIED_BATTERY) {
        Some(index) => (index, true),
        None => (feature_index(device, slot, hidpp::BATTERY_STATUS)?, false),
    };
    let naming = feature_index(device, slot, hidpp::DEVICE_NAME);
    let kind = naming
        .and_then(|index| call(device, slot, index, hidpp::NAME_TYPE, &[]))
        .and_then(|reply| hidpp::kind_from_type(reply[0]));
    let name = naming.and_then(|index| read_name(device, slot, index));
    let kind = kind.unwrap_or(PeripheralKind::Mouse);
    let name = name.unwrap_or_else(|| "Logitech".to_string());
    Some(Known { battery, unified, name, kind })
}

fn level(device: &HidDevice, slot: u8, known: &Known) -> Option<u8> {
    if known.unified {
        hidpp::unified_battery(&call(device, slot, known.battery, hidpp::UNIFIED_STATUS, &[])?)
    } else {
        hidpp::battery_status(&call(device, slot, known.battery, hidpp::BATTERY_LEVEL, &[])?)
    }
}

fn read_slot(device: &HidDevice, receiver: &str, slot: u8, cache: &mut HashMap<(String, u8), Slot>) -> Option<Peripheral> {
    let id = (receiver.to_string(), slot);
    let now = Instant::now();
    let known = match cache.get(&id) {
        Some(Slot::Missing(retry_at)) if now < *retry_at => return None,
        Some(Slot::Known(known)) => Some(known.clone()),
        _ => None,
    };
    let reading = known
        .or_else(|| probe(device, slot))
        .and_then(|known| level(device, slot, &known).map(|battery| (known, battery)));
    match reading {
        Some((known, battery)) => {
            let peripheral = Peripheral {
                device: format!("{receiver}-{slot}"),
                name: known.name.clone(),
                kind: known.kind,
                battery: Some(battery),
            };
            cache.insert(id, Slot::Known(known));
            Some(peripheral)
        }
        None => {
            cache.insert(id, Slot::Missing(now + RETRY_MISSING));
            None
        }
    }
}

pub(super) fn read_peripherals() -> Vec<Peripheral> {
    let Ok(api) = HidApi::new() else {
        return Vec::new();
    };
    let found_receivers = receivers(api.device_list());
    let mut cache = slots().lock().unwrap_or_else(PoisonError::into_inner);
    cache.retain(|(receiver, _), _| found_receivers.iter().any(|found| &found.key == receiver));
    let mut found = Vec::new();
    for receiver in &found_receivers {
        let Ok(device) = api.open_path(&receiver.path) else {
            continue;
        };
        for slot in SLOTS {
            if let Some(peripheral) = read_slot(&device, &receiver.key, slot, &mut cache) {
                found.push(peripheral);
            }
        }
    }
    found
}
