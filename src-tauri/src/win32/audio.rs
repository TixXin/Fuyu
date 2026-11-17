use std::collections::HashMap;
use windows::{
    core::{Interface, Result},
    Win32::{
        Foundation::S_OK,
        Media::Audio::{
            eCommunications, eConsole, eMultimedia, eRender, AudioSessionStateActive,
            AudioSessionStateExpired, ERole,
            Endpoints::{IAudioEndpointVolume, IAudioMeterInformation},
            IAudioSessionControl2, IAudioSessionManager2, IMMDevice, IMMDeviceEnumerator,
            MMDeviceEnumerator,
        },
        System::Com::{CoCreateInstance, CLSCTX_ALL},
    },
};

#[derive(Debug, Clone, Copy)]
pub(crate) enum OutputRole {
    Multimedia,
    Console,
    Communications,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub(crate) struct ProcessAudioSession {
    pub(crate) process_id: u32,
    pub(crate) active: bool,
    pub(crate) peak: f32,
}

impl OutputRole {
    fn erole(self) -> ERole {
        match self {
            Self::Multimedia => eMultimedia,
            Self::Console => eConsole,
            Self::Communications => eCommunications,
        }
    }
}

pub(crate) struct AudioDevices(IMMDeviceEnumerator);

impl AudioDevices {
    pub(crate) fn open() -> Result<Self> {
        unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) }.map(Self)
    }

    pub(crate) fn default_output(&self, role: OutputRole) -> Result<AudioOutput> {
        unsafe { self.0.GetDefaultAudioEndpoint(eRender, role.erole()) }.map(AudioOutput)
    }

    pub(crate) fn process_sessions(&self) -> Vec<ProcessAudioSession> {
        let mut by_pid: HashMap<u32, ProcessAudioSession> = HashMap::new();
        for role in [OutputRole::Multimedia, OutputRole::Console] {
            let Ok(output) = self.default_output(role) else {
                continue;
            };
            for session in output.sessions() {
                by_pid
                    .entry(session.process_id)
                    .and_modify(|existing| {
                        existing.active |= session.active;
                        existing.peak = existing.peak.max(session.peak);
                    })
                    .or_insert(session);
            }
        }
        by_pid.into_values().collect()
    }
}

pub(crate) struct AudioOutput(IMMDevice);

impl AudioOutput {
    pub(crate) fn volume(&self) -> Result<OutputVolume> {
        unsafe { self.0.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None) }.map(OutputVolume)
    }

    pub(crate) fn peak_meter(&self) -> Result<PeakMeter> {
        unsafe { self.0.Activate::<IAudioMeterInformation>(CLSCTX_ALL, None) }.map(PeakMeter)
    }

    pub(crate) fn sessions(&self) -> Vec<ProcessAudioSession> {
        let Ok(manager) = (unsafe { self.0.Activate::<IAudioSessionManager2>(CLSCTX_ALL, None) }) else {
            return Vec::new();
        };
        let Ok(enumerator) = (unsafe { manager.GetSessionEnumerator() }) else {
            return Vec::new();
        };
        let Ok(count) = (unsafe { enumerator.GetCount() }) else {
            return Vec::new();
        };
        let mut list = Vec::new();
        for index in 0..count {
            let Ok(control) = (unsafe { enumerator.GetSession(index) }) else {
                continue;
            };
            let Ok(state) = (unsafe { control.GetState() }) else {
                continue;
            };
            if state == AudioSessionStateExpired {
                continue;
            }
            let Ok(control2) = control.cast::<IAudioSessionControl2>() else {
                continue;
            };
            if unsafe { control2.IsSystemSoundsSession() } == S_OK {
                continue;
            }
            let Ok(process_id) = (unsafe { control2.GetProcessId() }) else {
                continue;
            };
            if process_id == 0 {
                continue;
            }
            let peak = control
                .cast::<IAudioMeterInformation>()
                .ok()
                .and_then(|meter| unsafe { meter.GetPeakValue() }.ok())
                .unwrap_or(0.0)
                .clamp(0.0, 1.0);
            list.push(ProcessAudioSession {
                process_id,
                active: state == AudioSessionStateActive,
                peak,
            });
        }
        list
    }
}

pub(crate) struct OutputVolume(IAudioEndpointVolume);

impl OutputVolume {
    pub(crate) fn level(&self) -> Result<f32> {
        unsafe { self.0.GetMasterVolumeLevelScalar() }
    }

    pub(crate) fn muted(&self) -> Result<bool> {
        unsafe { self.0.GetMute() }.map(|muted| muted.as_bool())
    }

    pub(crate) fn set_level(&self, level: f32) -> Result<()> {
        unsafe { self.0.SetMasterVolumeLevelScalar(level, std::ptr::null()) }
    }
}

pub(crate) struct PeakMeter(IAudioMeterInformation);

impl PeakMeter {
    pub(crate) fn peak(&self) -> Result<f32> {
        unsafe { self.0.GetPeakValue() }
    }
}
