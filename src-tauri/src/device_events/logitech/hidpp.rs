use super::super::peripherals::PeripheralKind;

pub(super) const SHORT_REPORT: u8 = 0x10;
pub(super) const LONG_REPORT: u8 = 0x11;
pub(super) const LONG_LEN: usize = 20;
pub(super) const PARAMS_LEN: usize = LONG_LEN - 4;
const SOFTWARE_ID: u8 = 0x0B;
const ERROR_V2: u8 = 0xFF;
const ERROR_V1: u8 = 0x8F;

pub(super) const ROOT_FEATURE: u8 = 0x00;
pub(super) const ROOT_GET_FEATURE: u8 = 0;
pub(super) const DEVICE_NAME: u16 = 0x0005;
pub(super) const NAME_COUNT: u8 = 0;
pub(super) const NAME_CHUNK: u8 = 1;
pub(super) const NAME_TYPE: u8 = 2;
pub(super) const UNIFIED_BATTERY: u16 = 0x1004;
pub(super) const UNIFIED_STATUS: u8 = 1;
pub(super) const BATTERY_STATUS: u16 = 0x1000;
pub(super) const BATTERY_LEVEL: u8 = 0;

pub(super) type Params = [u8; PARAMS_LEN];

pub(super) fn request(device: u8, feature: u8, function: u8, params: &[u8]) -> [u8; LONG_LEN] {
    let mut packet = [0u8; LONG_LEN];
    packet[0] = LONG_REPORT;
    packet[1] = device;
    packet[2] = feature;
    packet[3] = (function << 4) | SOFTWARE_ID;
    let len = params.len().min(PARAMS_LEN);
    packet[4..4 + len].copy_from_slice(&params[..len]);
    packet
}

pub(super) fn feature_id(feature: u16) -> [u8; 2] {
    feature.to_be_bytes()
}

#[derive(Debug, PartialEq, Eq)]
pub(super) enum Reply {
    Data(Params),
    Error,
    Other,
}

pub(super) fn match_reply(sent: &[u8; LONG_LEN], got: &[u8]) -> Reply {
    if got.len() < 7 || !matches!(got[0], SHORT_REPORT | LONG_REPORT) || got[1] != sent[1] {
        return Reply::Other;
    }
    if got[2] == ERROR_V2 && got[3] == sent[2] && got[4] == sent[3] {
        return Reply::Error;
    }
    if got[2] == ERROR_V1 && got[3] == sent[2] {
        return Reply::Error;
    }
    if got[2] != sent[2] || got[3] != sent[3] {
        return Reply::Other;
    }
    let mut params = [0u8; PARAMS_LEN];
    let body = &got[4..];
    let len = body.len().min(PARAMS_LEN);
    params[..len].copy_from_slice(&body[..len]);
    Reply::Data(params)
}

fn level_from_flags(flags: u8) -> Option<u8> {
    if flags & 0x08 != 0 {
        Some(100)
    } else if flags & 0x04 != 0 {
        Some(60)
    } else if flags & 0x02 != 0 {
        Some(20)
    } else if flags & 0x01 != 0 {
        Some(5)
    } else {
        None
    }
}

pub(super) fn unified_battery(params: &Params) -> Option<u8> {
    let percent = params[0];
    if (1..=100).contains(&percent) {
        Some(percent)
    } else {
        level_from_flags(params[1])
    }
}

pub(super) fn battery_status(params: &Params) -> Option<u8> {
    let percent = params[0];
    (1..=100).contains(&percent).then_some(percent)
}

pub(super) fn kind_from_type(device_type: u8) -> Option<PeripheralKind> {
    match device_type {
        0 | 2 => Some(PeripheralKind::Keyboard),
        3 | 5 => Some(PeripheralKind::Mouse),
        4 => Some(PeripheralKind::Trackpad),
        _ => None,
    }
}

pub(super) fn name_chunk(params: &Params, wanted: usize) -> &[u8] {
    let end = params.iter().position(|b| *b == 0).unwrap_or(PARAMS_LEN).min(wanted);
    &params[..end]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn params(bytes: &[u8]) -> Params {
        let mut out = [0u8; PARAMS_LEN];
        out[..bytes.len()].copy_from_slice(bytes);
        out
    }

    #[test]
    fn builds_long_requests_with_function_and_software_id() {
        let packet = request(2, ROOT_FEATURE, ROOT_GET_FEATURE, &feature_id(UNIFIED_BATTERY));
        assert_eq!(&packet[..6], &[0x11, 0x02, 0x00, 0x0B, 0x10, 0x04]);
        assert_eq!(packet.len(), 20);
        assert_eq!(request(1, 0x06, NAME_TYPE, &[])[3], 0x2B);
    }

    #[test]
    fn matches_only_its_own_reply_and_spots_errors() {
        let sent = request(1, 0x05, UNIFIED_STATUS, &[]);
        let mut reply = [0u8; LONG_LEN];
        reply[..8].copy_from_slice(&[0x11, 0x01, 0x05, 0x1B, 87, 0x04, 0x00, 0x00]);
        assert_eq!(match_reply(&sent, &reply), Reply::Data(params(&[87, 0x04])));

        let other_app = [0x11, 0x01, 0x05, 0x1A, 50, 0, 0];
        assert_eq!(match_reply(&sent, &other_app), Reply::Other);
        let other_device = [0x11, 0x02, 0x05, 0x1B, 50, 0, 0];
        assert_eq!(match_reply(&sent, &other_device), Reply::Other);
        assert_eq!(match_reply(&sent, &[0x11, 0x01, 0xFF, 0x05, 0x1B, 0x05, 0]), Reply::Error);
        assert_eq!(match_reply(&sent, &[0x10, 0x01, 0x8F, 0x05, 0x1B, 0x09, 0]), Reply::Error);
        assert_eq!(match_reply(&sent, &[0x11, 0x01]), Reply::Other);
    }

    #[test]
    fn reads_battery_percent_or_falls_back_to_level_flags() {
        assert_eq!(unified_battery(&params(&[73, 0x04])), Some(73));
        assert_eq!(unified_battery(&params(&[0, 0x02])), Some(20));
        assert_eq!(unified_battery(&params(&[0, 0x08])), Some(100));
        assert_eq!(unified_battery(&params(&[0, 0])), None);
        assert_eq!(battery_status(&params(&[45, 20, 0])), Some(45));
        assert_eq!(battery_status(&params(&[0, 0, 0])), None);
    }

    #[test]
    fn maps_device_types_and_trims_names() {
        assert_eq!(kind_from_type(0), Some(PeripheralKind::Keyboard));
        assert_eq!(kind_from_type(3), Some(PeripheralKind::Mouse));
        assert_eq!(kind_from_type(4), Some(PeripheralKind::Trackpad));
        assert_eq!(kind_from_type(6), None);
        let name = params(b"MX Master 3S");
        assert_eq!(name_chunk(&name, 40), b"MX Master 3S");
        assert_eq!(name_chunk(&name, 2), b"MX");
    }
}
