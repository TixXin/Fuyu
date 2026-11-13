use std::{collections::HashMap, process::Command};

use serde_json::Value;

const ADDRESS_DIGITS: usize = 12;
const LEVEL_KEYS: [&str; 3] = ["device_batteryLevelMain", "device_batteryLevelLeft", "device_batteryLevelRight"];

pub(crate) fn address_key(text: &str) -> Option<String> {
    let digits: String = text.chars().filter(char::is_ascii_hexdigit).take(ADDRESS_DIGITS).map(|c| c.to_ascii_uppercase()).collect();
    (digits.len() == ADDRESS_DIGITS).then_some(digits)
}

fn level(text: &str) -> Option<u8> {
    text.trim().trim_end_matches('%').trim().parse::<u8>().ok().filter(|&level| level <= 100)
}

pub(crate) fn parse_batteries(report: &Value) -> HashMap<String, u8> {
    let mut batteries = HashMap::new();
    let controllers = report.get("SPBluetoothDataType").and_then(Value::as_array).into_iter().flatten();
    let devices = controllers.filter_map(|controller| controller.get("device_connected")?.as_array()).flatten();
    for fields in devices.filter_map(Value::as_object).flat_map(|entry| entry.values()) {
        let Some(key) = fields.get("device_address").and_then(Value::as_str).and_then(address_key) else { continue };
        let main = fields.get(LEVEL_KEYS[0]).and_then(Value::as_str).and_then(level);
        let buds = LEVEL_KEYS[1..].iter().filter_map(|name| fields.get(*name)?.as_str().and_then(level)).min();
        if let Some(battery) = main.or(buds) {
            batteries.insert(key, battery);
        }
    }
    batteries
}

pub(crate) fn connected_batteries() -> HashMap<String, u8> {
    let Ok(output) = Command::new("/usr/sbin/system_profiler").args(["SPBluetoothDataType", "-json"]).output() else {
        return HashMap::new();
    };
    serde_json::from_slice::<Value>(&output.stdout).map(|report| parse_batteries(&report)).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::{address_key, parse_batteries};
    use serde_json::json;

    #[test]
    fn audio_uids_and_bluetooth_addresses_share_a_key() {
        assert_eq!(address_key("b4-e7-b3-ca-e4-eb:output").as_deref(), Some("B4E7B3CAE4EB"));
        assert_eq!(address_key("B4:E7:B3:CA:E4:EB").as_deref(), Some("B4E7B3CAE4EB"));
        assert_eq!(address_key("BuiltInSpeakerDevice"), None);
    }

    #[test]
    fn batteries_come_from_connected_devices_only() {
        let report = json!({ "SPBluetoothDataType": [{
            "device_connected": [
                { "Buds": { "device_address": "B4:E7:B3:CA:E4:EB", "device_batteryLevelLeft": "80%", "device_batteryLevelRight": "65%", "device_batteryLevelCase": "10%" } },
                { "Speaker": { "device_address": "F9:69:0C:A8:3C:E5", "device_batteryLevelMain": "40 %" } },
                { "Mouse": { "device_address": "9A:02:CB:73:34:05" } }
            ],
            "device_not_connected": [
                { "Old": { "device_address": "68:3B:09:5C:0E:8B", "device_batteryLevelMain": "5%" } }
            ]
        }]});
        let batteries = parse_batteries(&report);
        assert_eq!(batteries.len(), 2);
        assert_eq!(batteries.get("B4E7B3CAE4EB"), Some(&65));
        assert_eq!(batteries.get("F9690CA83CE5"), Some(&40));
    }
}
