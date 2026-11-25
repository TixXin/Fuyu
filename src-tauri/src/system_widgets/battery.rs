use std::{
    sync::{Mutex, PoisonError},
    time::{Duration, Instant},
};

use serde::Serialize;

use crate::platform::power::PowerSource;

const MAX_SAMPLE_GAP: Duration = Duration::from_secs(10 * 60);
const MIN_RATE_SPAN: Duration = Duration::from_secs(30);
const MAX_ESTIMATE_MINUTES: u32 = 48 * 60;
const MIN_RATE_MW: f64 = 100.0;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Battery {
    pub level: Option<u8>,
    pub plugged_in: bool,
    pub charging: bool,
    pub remaining_minutes: Option<u32>,
    pub time_to_full_minutes: Option<u32>,
    pub current_mwh: Option<u32>,
    pub full_charge_mwh: Option<u32>,
    pub design_mwh: Option<u32>,
    pub health_percent: Option<u8>,
    pub rate_mw: Option<i32>,
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct Anchor {
    pub(crate) at: Instant,
    pub(crate) plugged_in: bool,
    pub(crate) charging: bool,
    pub(crate) current_mwh: Option<u32>,
    pub(crate) level: Option<u8>,
}

#[derive(Debug, Default)]
pub(crate) struct Estimator {
    anchor: Option<Anchor>,
    measured_discharge_mw: Option<f64>,
    measured_charge_mw: Option<f64>,
}

impl Estimator {
    pub(crate) fn update(&mut self, source: PowerSource, now: Instant) -> Battery {
        if let Some(prev) = self.anchor {
            let span = now.saturating_duration_since(prev.at);
            if span > MAX_SAMPLE_GAP || prev.plugged_in != source.plugged_in || prev.charging != source.charging {
                self.anchor = Some(Anchor {
                    at: now,
                    plugged_in: source.plugged_in,
                    charging: source.charging,
                    current_mwh: source.current_mwh,
                    level: source.battery,
                });
                self.measured_discharge_mw = None;
                self.measured_charge_mw = None;
            } else if span >= MIN_RATE_SPAN {
                let hours = span.as_secs_f64() / 3600.0;
                if let (Some(before), Some(after)) = (prev.current_mwh, source.current_mwh) {
                    if !source.plugged_in && before > after {
                        let rate = f64::from(before - after) / hours;
                        if rate >= MIN_RATE_MW {
                            self.measured_discharge_mw = Some(blend(self.measured_discharge_mw, rate));
                            self.anchor = Some(Anchor {
                                at: now,
                                plugged_in: source.plugged_in,
                                charging: source.charging,
                                current_mwh: source.current_mwh,
                                level: source.battery,
                            });
                        }
                    } else if source.plugged_in && source.charging && after > before {
                        let rate = f64::from(after - before) / hours;
                        if rate >= MIN_RATE_MW {
                            self.measured_charge_mw = Some(blend(self.measured_charge_mw, rate));
                            self.anchor = Some(Anchor {
                                at: now,
                                plugged_in: source.plugged_in,
                                charging: source.charging,
                                current_mwh: source.current_mwh,
                                level: source.battery,
                            });
                        }
                    } else if source.plugged_in && after < before {
                        self.measured_charge_mw = None;
                    }
                } else if let (Some(before_pct), Some(after_pct), Some(full)) = (prev.level, source.battery, source.full_charge_mwh) {
                    if !source.plugged_in && before_pct > after_pct {
                        let dmwh = f64::from(full) * f64::from(before_pct - after_pct) / 100.0;
                        let rate = dmwh / hours;
                        if rate >= MIN_RATE_MW {
                            self.measured_discharge_mw = Some(blend(self.measured_discharge_mw, rate));
                        }
                    } else if source.plugged_in && source.charging && after_pct > before_pct {
                        let dmwh = f64::from(full) * f64::from(after_pct - before_pct) / 100.0;
                        let rate = dmwh / hours;
                        if rate >= MIN_RATE_MW {
                            self.measured_charge_mw = Some(blend(self.measured_charge_mw, rate));
                        }
                    }
                }
            }
        } else {
            self.anchor = Some(Anchor {
                at: now,
                plugged_in: source.plugged_in,
                charging: source.charging,
                current_mwh: source.current_mwh,
                level: source.battery,
            });
        }

        let health_percent = health_of(source.full_charge_mwh, source.design_mwh);
        let remaining_minutes = estimate_remaining(&source, self.measured_discharge_mw);
        let time_to_full_minutes = estimate_time_to_full(&source, self.measured_charge_mw);

        Battery {
            level: source.battery,
            plugged_in: source.plugged_in,
            charging: source.charging,
            remaining_minutes,
            time_to_full_minutes,
            current_mwh: source.current_mwh,
            full_charge_mwh: source.full_charge_mwh,
            design_mwh: source.design_mwh,
            health_percent,
            rate_mw: source.rate_mw,
        }
    }
}

fn blend(prev: Option<f64>, next: f64) -> f64 {
    match prev {
        Some(old) => old * 0.6 + next * 0.4,
        None => next,
    }
}

fn clamp_minutes(minutes: f64) -> Option<u32> {
    if !minutes.is_finite() || minutes < 1.0 {
        return None;
    }
    let rounded = minutes.round() as u32;
    (1..=MAX_ESTIMATE_MINUTES).contains(&rounded).then_some(rounded)
}

pub(crate) fn health_of(full_mwh: Option<u32>, design_mwh: Option<u32>) -> Option<u8> {
    let (full, design) = (full_mwh?, design_mwh?);
    if full == 0 || design == 0 {
        return None;
    }
    let pct = ((u64::from(full) * 100 + u64::from(design) / 2) / u64::from(design)).clamp(1, 100);
    u8::try_from(pct).ok()
}

fn estimate_remaining(source: &PowerSource, measured_discharge_mw: Option<f64>) -> Option<u32> {
    if source.plugged_in {
        return None;
    }
    if let Some(os_min) = source.remaining_minutes.filter(|&m| (1..=MAX_ESTIMATE_MINUTES).contains(&m)) {
        return Some(os_min);
    }
    let current = source.current_mwh.filter(|&v| v > 0)?;
    let rate = source
        .rate_mw
        .filter(|&r| r < 0)
        .map(|r| f64::from(r.unsigned_abs()))
        .filter(|&r| r >= MIN_RATE_MW)
        .or(measured_discharge_mw)?;
    clamp_minutes(f64::from(current) * 60.0 / rate)
}

fn estimate_time_to_full(source: &PowerSource, measured_charge_mw: Option<f64>) -> Option<u32> {
    if !source.plugged_in || !source.charging {
        return None;
    }
    if source.battery == Some(100) {
        return None;
    }
    if let Some(os_min) = source.time_to_full_minutes.filter(|&m| (1..=MAX_ESTIMATE_MINUTES).contains(&m)) {
        return Some(os_min);
    }
    let (current, full) = (source.current_mwh?, source.full_charge_mwh?);
    let missing = full.checked_sub(current).filter(|&m| m > 0)?;
    if source.rate_mw.is_some_and(|r| r <= 0) {
        return None;
    }
    let rate = source
        .rate_mw
        .filter(|&r| r > 0)
        .map(f64::from)
        .filter(|&r| r >= MIN_RATE_MW)
        .or(measured_charge_mw)?;
    clamp_minutes(f64::from(missing) * 60.0 / rate)
}

static ESTIMATOR: Mutex<Option<Estimator>> = Mutex::new(None);

pub(crate) fn evaluate(source: PowerSource) -> Battery {
    let mut guard = ESTIMATOR.lock().unwrap_or_else(PoisonError::into_inner);
    guard.get_or_insert_with(Estimator::default).update(source, Instant::now())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample(plugged_in: bool, charging: bool, battery: u8, current_mwh: Option<u32>, full_charge_mwh: Option<u32>, rate_mw: Option<i32>) -> PowerSource {
        PowerSource {
            plugged_in,
            charging,
            battery: Some(battery),
            remaining_minutes: None,
            time_to_full_minutes: None,
            current_mwh,
            full_charge_mwh,
            design_mwh: Some(60_000),
            rate_mw,
        }
    }

    #[test]
    fn prefers_os_remaining_and_falls_back_to_driver_rate_on_first_read() {
        let now = Instant::now();
        let mut est = Estimator::default();
        let mut os = sample(false, false, 80, Some(40_000), Some(50_000), Some(-10_000));
        os.remaining_minutes = Some(195);
        assert_eq!(est.update(os, now).remaining_minutes, Some(195));

        let mut est2 = Estimator::default();
        let drv = sample(false, false, 80, Some(40_000), Some(50_000), Some(-10_000));
        let out = est2.update(drv, now);
        assert_eq!(out.remaining_minutes, Some(240));
        assert_eq!(out.health_percent, Some(83));
    }

    #[test]
    fn charging_estimates_on_first_read_and_ignores_weak_adapter() {
        let now = Instant::now();
        let mut est = Estimator::default();
        let first = est.update(sample(true, true, 50, Some(25_000), Some(50_000), Some(25_000)), now);
        assert_eq!(first.time_to_full_minutes, Some(60));

        let mut weak = Estimator::default();
        let drain = weak.update(sample(true, true, 50, Some(25_000), Some(50_000), Some(-3_000)), now);
        assert_eq!(drain.time_to_full_minutes, None);
    }

    #[test]
    fn measured_rate_works_without_driver_rate_and_resets_on_gap_or_plug_change() {
        let t0 = Instant::now();
        let mut est = Estimator::default();
        assert_eq!(est.update(sample(false, false, 80, Some(40_000), Some(50_000), None), t0).remaining_minutes, None);
        let t1 = t0 + Duration::from_secs(120);
        let out = est.update(sample(false, false, 79, Some(39_500), Some(50_000), None), t1);
        assert_eq!(out.remaining_minutes, Some(158));

        let t2 = t1 + Duration::from_secs(700);
        let after_gap = est.update(sample(false, false, 70, Some(35_000), Some(50_000), None), t2);
        assert_eq!(after_gap.remaining_minutes, None);

        let t3 = t2 + Duration::from_secs(60);
        let plugged = est.update(sample(true, true, 70, Some(35_500), Some(50_000), None), t3);
        assert_eq!(plugged.time_to_full_minutes, None);
    }
}
