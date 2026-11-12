use std::collections::HashMap;

use serde::Serialize;

const LOW_BATTERY: [u8; 2] = [20, 10];
const RECHARGED: u8 = 30;
pub(crate) const BATTERY_WAIT_POLLS: u32 = 3;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) enum AudioKind {
    Headphones,
    Headset,
    Speaker,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Output {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) kind: AudioKind,
    pub(crate) device: String,
    pub(crate) bluetooth: bool,
}

impl Output {
    pub(crate) fn classify(id: String, name: String, form_factor: u32, enumerator: &str, device: Option<String>) -> Option<Self> {
        let bluetooth = enumerator.starts_with("BTH");
        let kind = match form_factor {
            3 => AudioKind::Headphones,
            5 => AudioKind::Headset,
            _ if bluetooth => AudioKind::Speaker,
            _ => return None,
        };
        let device = device.unwrap_or_else(|| id.clone());
        Some(Self { id, name, kind, device, bluetooth })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub(crate) enum DeviceAlert {
    #[serde(rename_all = "camelCase")]
    AudioConnected { name: String, device: AudioKind, battery: Option<u8> },
    #[serde(rename_all = "camelCase")]
    AudioDisconnected { name: String, device: AudioKind },
    #[serde(rename_all = "camelCase")]
    BatteryLow { name: String, battery: u8 },
    #[serde(rename_all = "camelCase")]
    PowerConnected { battery: Option<u8> },
    #[serde(rename_all = "camelCase")]
    PowerDisconnected { battery: Option<u8> },
}

#[derive(Debug, Default)]
pub(crate) struct OutputTracker {
    known: Option<Vec<Output>>,
    waiting: Vec<(Output, u32)>,
    warned: HashMap<String, u8>,
}

impl OutputTracker {
    pub(crate) fn wants_batteries(&self) -> bool {
        !self.waiting.is_empty()
    }

    pub(crate) fn reset(&mut self) {
        *self = Self::default();
    }

    pub(crate) fn update(&mut self, outputs: Vec<Output>, batteries: &HashMap<String, u8>) -> Vec<DeviceAlert> {
        let mut alerts = Vec::new();
        let Some(known) = self.known.replace(outputs.clone()) else {
            for output in &outputs {
                self.note_level(output, batteries);
            }
            return alerts;
        };
        let present = |list: &[Output], device: &str| list.iter().any(|output| output.device == device);

        let mut gone: Vec<&Output> = Vec::new();
        for output in known.iter().filter(|output| !present(&outputs, &output.device)) {
            if gone.iter().any(|seen| seen.device == output.device) {
                continue;
            }
            gone.push(output);
            if let Some(index) = self.waiting.iter().position(|(waiting, _)| waiting.device == output.device) {
                self.waiting.remove(index);
                continue;
            }
            self.warned.remove(&output.device);
            alerts.push(DeviceAlert::AudioDisconnected { name: output.name.clone(), device: output.kind });
        }

        let mut new: Vec<&Output> = outputs.iter().filter(|output| !present(&known, &output.device)).collect();
        new.sort_by_key(|output| output.kind != AudioKind::Headphones);
        for output in new {
            if self.waiting.iter().any(|(waiting, _)| waiting.device == output.device) {
                continue;
            }
            self.waiting.push((output.clone(), 0));
        }
        let waiting = std::mem::take(&mut self.waiting);
        for (output, polls) in waiting {
            let battery = batteries.get(&output.device).copied();
            if battery.is_none() && output.bluetooth && polls < BATTERY_WAIT_POLLS {
                self.waiting.push((output, polls + 1));
                continue;
            }
            self.note_level(&output, batteries);
            alerts.push(DeviceAlert::AudioConnected { name: output.name.clone(), device: output.kind, battery });
        }

        let mut checked: Vec<&str> = Vec::new();
        for output in &outputs {
            if checked.contains(&output.device.as_str()) || self.waiting.iter().any(|(waiting, _)| waiting.device == output.device) {
                continue;
            }
            checked.push(&output.device);
            let Some(&battery) = batteries.get(&output.device) else { continue };
            let warned = self.warned.get(&output.device).copied().unwrap_or(u8::MAX);
            if battery >= RECHARGED {
                self.warned.remove(&output.device);
            } else if let Some(level) = LOW_BATTERY.iter().copied().filter(|&level| battery <= level && level < warned).min() {
                self.warned.insert(output.device.clone(), level);
                alerts.push(DeviceAlert::BatteryLow { name: output.name.clone(), battery });
            }
        }
        alerts
    }

    fn note_level(&mut self, output: &Output, batteries: &HashMap<String, u8>) {
        if let Some(level) = batteries
            .get(&output.device)
            .and_then(|&battery| LOW_BATTERY.iter().copied().filter(|&level| battery <= level).min())
        {
            self.warned.insert(output.device.clone(), level);
        }
    }
}

#[derive(Debug, Default)]
pub(crate) struct PowerTracker {
    plugged_in: Option<bool>,
}

impl PowerTracker {
    pub(crate) fn reset(&mut self) {
        self.plugged_in = None;
    }

    pub(crate) fn update(&mut self, plugged_in: Option<bool>, battery: Option<u8>) -> Option<DeviceAlert> {
        let now = plugged_in?;
        let before = self.plugged_in.replace(now)?;
        match (before, now) {
            (false, true) => Some(DeviceAlert::PowerConnected { battery }),
            (true, false) => Some(DeviceAlert::PowerDisconnected { battery }),
            _ => None,
        }
    }
}
