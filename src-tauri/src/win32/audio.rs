use std::{
    collections::HashMap,
    ffi::c_void,
    sync::{
        atomic::{AtomicU32, AtomicU64, Ordering},
        Arc,
    },
};
use windows::{
    core::{GUID, HRESULT, IUnknown, IUnknown_Vtbl, Interface, Result, PCWSTR},
    Win32::{
        Foundation::{E_NOINTERFACE, E_POINTER, PROPERTYKEY, S_OK},
        Media::Audio::{
            eConsole, eMultimedia, eRender, AudioSessionStateActive, AudioSessionStateExpired,
            DEVICE_STATE, EDataFlow, ERole,
            Endpoints::{
                IAudioEndpointVolume, IAudioEndpointVolumeCallback,
                IAudioEndpointVolumeCallback_Vtbl, IAudioMeterInformation,
            },
            IAudioSessionControl2, IAudioSessionManager2, IMMDevice, IMMDeviceEnumerator,
            IMMNotificationClient, IMMNotificationClient_Vtbl, MMDeviceEnumerator,
            AUDIO_VOLUME_NOTIFICATION_DATA,
        },
        System::Com::{CoCreateInstance, CLSCTX_ALL, CLSCTX_INPROC_SERVER},
    },
};

#[derive(Debug, Clone, Copy)]
pub(crate) enum OutputRole {
    Multimedia,
    Console,
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
        }
    }
}

pub(crate) struct AudioDevices(pub(super) IMMDeviceEnumerator);

impl AudioDevices {
    pub(crate) fn open() -> Result<Self> {
        unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_INPROC_SERVER) }.map(Self)
    }

    pub(crate) fn default_output(&self, role: OutputRole) -> Result<AudioOutput> {
        unsafe { self.0.GetDefaultAudioEndpoint(eRender, role.erole()) }.map(AudioOutput)
    }

    pub(crate) fn default_render_output(&self) -> Result<AudioOutput> {
        self.default_output(OutputRole::Multimedia)
            .or_else(|_| self.default_output(OutputRole::Console))
    }

    pub(crate) fn subscribe_endpoints(
        &self,
    ) -> Result<(EndpointNotificationSubscription, Arc<EndpointEpochs>)> {
        let epochs = Arc::new(EndpointEpochs::new());
        let boxed = Box::new(RawEndpointNotificationClient {
            vtable: &ENDPOINT_NOTIFICATION_VTBL,
            refs: AtomicU32::new(1),
            epochs: Arc::clone(&epochs),
        });
        let raw = Box::into_raw(boxed) as *mut c_void;
        let callback = unsafe { IMMNotificationClient::from_raw(raw) };
        unsafe { self.0.RegisterEndpointNotificationCallback(&callback) }?;
        Ok((
            EndpointNotificationSubscription {
                enumerator: self.0.clone(),
                callback,
            },
            epochs,
        ))
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
    fn activate<T: Interface>(&self) -> Result<T> {
        unsafe { self.0.Activate::<T>(CLSCTX_INPROC_SERVER, None) }
            .or_else(|_| unsafe { self.0.Activate::<T>(CLSCTX_ALL, None) })
    }

    pub(crate) fn volume(&self) -> Result<OutputVolume> {
        self.activate::<IAudioEndpointVolume>().map(OutputVolume)
    }

    pub(crate) fn peak_meter(&self) -> Result<PeakMeter> {
        self.activate::<IAudioMeterInformation>().map(PeakMeter)
    }

    pub(crate) fn sessions(&self) -> Vec<ProcessAudioSession> {
        let Ok(manager) = self.activate::<IAudioSessionManager2>() else {
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

pub(crate) struct EndpointEpochs {
    default_render: AtomicU64,
    topology: AtomicU64,
}

impl EndpointEpochs {
    fn new() -> Self {
        Self {
            default_render: AtomicU64::new(1),
            topology: AtomicU64::new(1),
        }
    }

    pub(crate) fn default_render_epoch(&self) -> u64 {
        self.default_render.load(Ordering::Acquire)
    }

    pub(crate) fn topology_epoch(&self) -> u64 {
        self.topology.load(Ordering::Acquire)
    }
}

pub(crate) struct EndpointNotificationSubscription {
    enumerator: IMMDeviceEnumerator,
    callback: IMMNotificationClient,
}

impl Drop for EndpointNotificationSubscription {
    fn drop(&mut self) {
        let _ = unsafe { self.enumerator.UnregisterEndpointNotificationCallback(&self.callback) };
    }
}

#[repr(C)]
struct RawEndpointNotificationClient {
    vtable: *const IMMNotificationClient_Vtbl,
    refs: AtomicU32,
    epochs: Arc<EndpointEpochs>,
}

static ENDPOINT_NOTIFICATION_VTBL: IMMNotificationClient_Vtbl = IMMNotificationClient_Vtbl {
    base__: IUnknown_Vtbl {
        QueryInterface: endpoint_query_interface,
        AddRef: endpoint_add_ref,
        Release: endpoint_release,
    },
    OnDeviceStateChanged: endpoint_on_state_changed,
    OnDeviceAdded: endpoint_on_device_added,
    OnDeviceRemoved: endpoint_on_device_removed,
    OnDefaultDeviceChanged: endpoint_on_default_changed,
    OnPropertyValueChanged: endpoint_on_property_changed,
};

unsafe extern "system" fn endpoint_query_interface(
    this: *mut c_void,
    iid: *const GUID,
    interface: *mut *mut c_void,
) -> HRESULT {
    if interface.is_null() || iid.is_null() {
        return E_POINTER;
    }
    let requested = unsafe { &*iid };
    if *requested == IUnknown::IID || *requested == IMMNotificationClient::IID {
        unsafe {
            *interface = this;
            endpoint_add_ref(this);
        }
        S_OK
    } else {
        unsafe {
            *interface = std::ptr::null_mut();
        }
        E_NOINTERFACE
    }
}

unsafe extern "system" fn endpoint_add_ref(this: *mut c_void) -> u32 {
    let raw = unsafe { &*(this as *const RawEndpointNotificationClient) };
    raw.refs.fetch_add(1, Ordering::Relaxed) + 1
}

unsafe extern "system" fn endpoint_release(this: *mut c_void) -> u32 {
    let raw = unsafe { &*(this as *const RawEndpointNotificationClient) };
    let prev = raw.refs.fetch_sub(1, Ordering::Release);
    if prev == 1 {
        std::sync::atomic::fence(Ordering::Acquire);
        unsafe {
            drop(Box::from_raw(this as *mut RawEndpointNotificationClient));
        }
    }
    prev - 1
}

unsafe extern "system" fn endpoint_on_state_changed(
    this: *mut c_void,
    _device_id: PCWSTR,
    _new_state: DEVICE_STATE,
) -> HRESULT {
    let raw = unsafe { &*(this as *const RawEndpointNotificationClient) };
    raw.epochs.topology.fetch_add(1, Ordering::AcqRel);
    raw.epochs.default_render.fetch_add(1, Ordering::AcqRel);
    S_OK
}

unsafe extern "system" fn endpoint_on_device_added(
    this: *mut c_void,
    _device_id: PCWSTR,
) -> HRESULT {
    let raw = unsafe { &*(this as *const RawEndpointNotificationClient) };
    raw.epochs.topology.fetch_add(1, Ordering::AcqRel);
    S_OK
}

unsafe extern "system" fn endpoint_on_device_removed(
    this: *mut c_void,
    _device_id: PCWSTR,
) -> HRESULT {
    let raw = unsafe { &*(this as *const RawEndpointNotificationClient) };
    raw.epochs.topology.fetch_add(1, Ordering::AcqRel);
    raw.epochs.default_render.fetch_add(1, Ordering::AcqRel);
    S_OK
}

unsafe extern "system" fn endpoint_on_default_changed(
    this: *mut c_void,
    flow: EDataFlow,
    role: ERole,
    _default_device_id: PCWSTR,
) -> HRESULT {
    if flow == eRender {
        let raw = unsafe { &*(this as *const RawEndpointNotificationClient) };
        raw.epochs.topology.fetch_add(1, Ordering::AcqRel);
        if role == eMultimedia || role == eConsole {
            raw.epochs.default_render.fetch_add(1, Ordering::AcqRel);
        }
    }
    S_OK
}

unsafe extern "system" fn endpoint_on_property_changed(
    _this: *mut c_void,
    _device_id: PCWSTR,
    _key: PROPERTYKEY,
) -> HRESULT {
    S_OK
}

pub(crate) struct CachedRenderAudio {
    meter: Option<PeakMeter>,
    meter_epoch: u64,
    volume: Option<OutputVolume>,
    volume_epoch: u64,
    subscription: Option<EndpointNotificationSubscription>,
    epochs: Option<Arc<EndpointEpochs>>,
    devices: AudioDevices,
}

impl CachedRenderAudio {
    pub(crate) fn open() -> Result<Self> {
        let devices = AudioDevices::open()?;
        let (subscription, epochs) = match devices.subscribe_endpoints() {
            Ok((sub, ep)) => (Some(sub), Some(ep)),
            Err(_) => (None, None),
        };
        Ok(Self {
            meter: None,
            meter_epoch: 0,
            volume: None,
            volume_epoch: 0,
            subscription,
            epochs,
            devices,
        })
    }

    pub(crate) fn devices(&self) -> &AudioDevices {
        &self.devices
    }

    fn current_epoch(&self) -> Option<u64> {
        if self.subscription.is_some() {
            self.epochs.as_ref().map(|epochs| epochs.default_render_epoch())
        } else {
            None
        }
    }

    pub(crate) fn peak(&mut self) -> Result<f32> {
        let epoch = self.current_epoch();
        if let (Some(current), Some(meter)) = (epoch, self.meter.as_ref()) {
            if self.meter_epoch == current {
                match meter.peak() {
                    Ok(value) => return Ok(value.clamp(0.0, 1.0)),
                    Err(_) => self.meter = None,
                }
            }
        }
        let meter = self.devices.default_render_output()?.peak_meter()?;
        let value = meter.peak()?.clamp(0.0, 1.0);
        if let Some(current) = epoch {
            self.meter = Some(meter);
            self.meter_epoch = current;
        }
        Ok(value)
    }

    pub(crate) fn master_volume(&mut self) -> Result<f32> {
        let epoch = self.current_epoch();
        if let (Some(current), Some(volume)) = (epoch, self.volume.as_ref()) {
            if self.volume_epoch == current {
                match volume.level() {
                    Ok(value) => return Ok(value.clamp(0.0, 1.0)),
                    Err(_) => self.volume = None,
                }
            }
        }
        let volume = self.devices.default_render_output()?.volume()?;
        let value = volume.level()?.clamp(0.0, 1.0);
        if let Some(current) = epoch {
            self.volume = Some(volume);
            self.volume_epoch = current;
        }
        Ok(value)
    }

    pub(crate) fn set_master_volume(&mut self, level: f32) -> Result<()> {
        let clamped = level.clamp(0.0, 1.0);
        let epoch = self.current_epoch();
        if let (Some(current), Some(volume)) = (epoch, self.volume.as_ref()) {
            if self.volume_epoch == current {
                match volume.set_level(clamped) {
                    Ok(()) => return Ok(()),
                    Err(_) => self.volume = None,
                }
            }
        }
        let volume = self.devices.default_render_output()?.volume()?;
        volume.set_level(clamped)?;
        if let Some(current) = epoch {
            self.volume = Some(volume);
            self.volume_epoch = current;
        }
        Ok(())
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

    pub(crate) fn subscribe<F>(&self, on_change: F) -> Result<VolumeSubscription>
    where
        F: Fn(u32, bool) + Send + Sync + 'static,
    {
        let boxed = Box::new(RawVolumeCallback {
            vtable: &VOLUME_CALLBACK_VTBL,
            refs: AtomicU32::new(1),
            on_change: Box::new(on_change),
        });
        let raw = Box::into_raw(boxed) as *mut c_void;
        let callback = unsafe { IAudioEndpointVolumeCallback::from_raw(raw) };
        unsafe { self.0.RegisterControlChangeNotify(&callback) }?;
        Ok(VolumeSubscription {
            endpoint: self.0.clone(),
            callback,
        })
    }
}

pub(crate) struct VolumeSubscription {
    endpoint: IAudioEndpointVolume,
    callback: IAudioEndpointVolumeCallback,
}

impl Drop for VolumeSubscription {
    fn drop(&mut self) {
        let _ = unsafe { self.endpoint.UnregisterControlChangeNotify(&self.callback) };
    }
}

#[repr(C)]
struct RawVolumeCallback {
    vtable: *const IAudioEndpointVolumeCallback_Vtbl,
    refs: AtomicU32,
    on_change: Box<dyn Fn(u32, bool) + Send + Sync>,
}

static VOLUME_CALLBACK_VTBL: IAudioEndpointVolumeCallback_Vtbl = IAudioEndpointVolumeCallback_Vtbl {
    base__: IUnknown_Vtbl {
        QueryInterface: volume_query_interface,
        AddRef: volume_add_ref,
        Release: volume_release,
    },
    OnNotify: volume_on_notify,
};

unsafe extern "system" fn volume_query_interface(
    this: *mut c_void,
    iid: *const GUID,
    interface: *mut *mut c_void,
) -> HRESULT {
    if interface.is_null() || iid.is_null() {
        return E_POINTER;
    }
    let requested = unsafe { &*iid };
    if *requested == IUnknown::IID || *requested == IAudioEndpointVolumeCallback::IID {
        unsafe {
            *interface = this;
            volume_add_ref(this);
        }
        S_OK
    } else {
        unsafe {
            *interface = std::ptr::null_mut();
        }
        E_NOINTERFACE
    }
}

unsafe extern "system" fn volume_add_ref(this: *mut c_void) -> u32 {
    let raw = unsafe { &*(this as *const RawVolumeCallback) };
    raw.refs.fetch_add(1, Ordering::Relaxed) + 1
}

unsafe extern "system" fn volume_release(this: *mut c_void) -> u32 {
    let raw = unsafe { &*(this as *const RawVolumeCallback) };
    let prev = raw.refs.fetch_sub(1, Ordering::Release);
    if prev == 1 {
        std::sync::atomic::fence(Ordering::Acquire);
        unsafe {
            drop(Box::from_raw(this as *mut RawVolumeCallback));
        }
    }
    prev - 1
}

unsafe extern "system" fn volume_on_notify(
    this: *mut c_void,
    data: *mut AUDIO_VOLUME_NOTIFICATION_DATA,
) -> HRESULT {
    if !data.is_null() {
        let raw = unsafe { &*(this as *const RawVolumeCallback) };
        let info = unsafe { &*data };
        let percent = (info.fMasterVolume.clamp(0.0, 1.0) * 100.0).round() as u32;
        let muted = info.bMuted.as_bool();
        (raw.on_change)(percent, muted);
    }
    S_OK
}

pub(crate) struct PeakMeter(IAudioMeterInformation);

impl PeakMeter {
    pub(crate) fn peak(&self) -> Result<f32> {
        unsafe { self.0.GetPeakValue() }
    }
}
