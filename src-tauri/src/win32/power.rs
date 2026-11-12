use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};

const NO_SYSTEM_BATTERY: u8 = 128;
const UNKNOWN: u8 = 255;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct PowerSource {
    pub(crate) plugged_in: bool,
    pub(crate) battery: Option<u8>,
}

pub(crate) fn power_source() -> Option<PowerSource> {
    let mut status = SYSTEM_POWER_STATUS::default();
    unsafe { GetSystemPowerStatus(&mut status) }.ok()?;
    if status.BatteryFlag == UNKNOWN || status.BatteryFlag & NO_SYSTEM_BATTERY != 0 {
        return None;
    }
    let plugged_in = match status.ACLineStatus {
        0 => false,
        1 => true,
        _ => return None,
    };
    let battery = (status.BatteryLifePercent <= 100).then_some(status.BatteryLifePercent);
    Some(PowerSource { plugged_in, battery })
}
