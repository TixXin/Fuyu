use windows::{
    core::Result,
    Win32::{
        Media::Audio::{
            eCommunications, eConsole, eMultimedia, eRender, ERole,
            Endpoints::{IAudioEndpointVolume, IAudioMeterInformation},
            IMMDevice, IMMDeviceEnumerator, MMDeviceEnumerator,
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
}

pub(crate) struct AudioOutput(IMMDevice);

impl AudioOutput {
    pub(crate) fn volume(&self) -> Result<OutputVolume> {
        unsafe { self.0.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None) }.map(OutputVolume)
    }

    pub(crate) fn peak_meter(&self) -> Result<PeakMeter> {
        unsafe { self.0.Activate::<IAudioMeterInformation>(CLSCTX_ALL, None) }.map(PeakMeter)
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
