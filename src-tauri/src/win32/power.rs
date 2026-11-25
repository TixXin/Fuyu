use windows::{
    Devices::Power::Battery as WinRtBattery,
    System::Power::BatteryStatus,
    Win32::System::Power::{GetPwrCapabilities, GetSystemPowerStatus, SYSTEM_POWER_CAPABILITIES, SYSTEM_POWER_STATUS},
};

const CHARGING_FLAG: u8 = 8;
const NO_SYSTEM_BATTERY: u8 = 128;
const UNKNOWN: u8 = 255;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct PowerSource {
    pub(crate) plugged_in: bool,
    pub(crate) charging: bool,
    pub(crate) battery: Option<u8>,
    pub(crate) remaining_minutes: Option<u32>,
    pub(crate) time_to_full_minutes: Option<u32>,
    pub(crate) current_mwh: Option<u32>,
    pub(crate) full_charge_mwh: Option<u32>,
    pub(crate) design_mwh: Option<u32>,
    pub(crate) rate_mw: Option<i32>,
}

#[derive(Debug, Clone, Copy, Default)]
struct ReportDetails {
    present: bool,
    charging: Option<bool>,
    current_mwh: Option<u32>,
    full_charge_mwh: Option<u32>,
    design_mwh: Option<u32>,
    rate_mw: Option<i32>,
}

fn has_real_laptop_battery() -> Option<bool> {
    let mut caps = SYSTEM_POWER_CAPABILITIES::default();
    if !unsafe { GetPwrCapabilities(&mut caps) } {
        return None;
    }
    Some(caps.SystemBatteriesPresent && !caps.BatteriesAreShortTerm)
}

fn aggregate_report() -> Option<ReportDetails> {
    let _apartment = super::com::WinRtApartment::multithreaded().ok()?;
    let battery = WinRtBattery::AggregateBattery().ok()?;
    let report = battery.GetReport().ok()?;
    let status = report.Status().ok()?;
    if status == BatteryStatus::NotPresent {
        return Some(ReportDetails { present: false, ..Default::default() });
    }
    let positive = |res: windows::core::Result<windows::Foundation::IReference<i32>>| {
        res.ok().and_then(|r| r.Value().ok()).filter(|&v| v > 0).map(|v| v as u32)
    };
    let rate_mw = report.ChargeRateInMilliwatts().ok().and_then(|r| r.Value().ok());
    let charging = match status {
        BatteryStatus::Charging => Some(true),
        BatteryStatus::Discharging | BatteryStatus::Idle => Some(false),
        _ => None,
    };
    Some(ReportDetails {
        present: true,
        charging,
        current_mwh: positive(report.RemainingCapacityInMilliwattHours()),
        full_charge_mwh: positive(report.FullChargeCapacityInMilliwattHours()),
        design_mwh: positive(report.DesignCapacityInMilliwattHours()),
        rate_mw,
    })
}

pub(crate) fn power_source() -> Option<PowerSource> {
    if has_real_laptop_battery() == Some(false) {
        return None;
    }
    let mut status = SYSTEM_POWER_STATUS::default();
    unsafe { GetSystemPowerStatus(&mut status) }.ok()?;
    if status.BatteryFlag != UNKNOWN && status.BatteryFlag & NO_SYSTEM_BATTERY != 0 {
        return None;
    }
    let details = aggregate_report();
    if details.is_some_and(|d| !d.present) {
        return None;
    }
    if status.BatteryFlag == UNKNOWN && status.BatteryLifePercent > 100 && details.is_none() {
        return None;
    }
    let plugged_in = match status.ACLineStatus {
        0 => false,
        1 => true,
        _ => return None,
    };
    let battery = (status.BatteryLifePercent <= 100).then_some(status.BatteryLifePercent);
    let charging = details
        .and_then(|d| d.charging)
        .unwrap_or(plugged_in && status.BatteryFlag != UNKNOWN && (status.BatteryFlag & CHARGING_FLAG) != 0);
    let remaining_minutes = (!plugged_in && status.BatteryLifeTime != u32::MAX && status.BatteryLifeTime > 0)
        .then_some((status.BatteryLifeTime + 30) / 60);
    let d = details.unwrap_or_default();
    Some(PowerSource {
        plugged_in,
        charging,
        battery,
        remaining_minutes,
        time_to_full_minutes: None,
        current_mwh: d.current_mwh,
        full_charge_mwh: d.full_charge_mwh,
        design_mwh: d.design_mwh,
        rate_mw: d.rate_mw,
    })
}
