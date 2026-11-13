use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Arc,
    },
    thread::JoinHandle,
    time::Duration,
};

use windows::{
    core::Result,
    Win32::{
        Media::Audio::{
            eCapture, eConsole, eRender, IAudioCaptureClient, IAudioClient, IAudioRenderClient, IMMDeviceEnumerator,
            MMDeviceEnumerator, AUDCLNT_BUFFERFLAGS_SILENT, AUDCLNT_SHAREMODE_SHARED, AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM,
            AUDCLNT_STREAMFLAGS_LOOPBACK, AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY, WAVEFORMATEX,
        },
        System::Com::{CoCreateInstance, CoTaskMemFree, CLSCTX_ALL},
    },
};

use super::com::ComApartment;

pub(crate) const SAMPLE_RATE: u32 = 48_000;
pub(crate) const CHANNELS: u16 = 2;
const BUFFER: i64 = 2_000_000;
const WAVE_FORMAT_IEEE_FLOAT: u16 = 3;
const POLL: Duration = Duration::from_millis(5);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum AudioSource {
    System,
    Microphone,
}

fn float_format() -> WAVEFORMATEX {
    let block = CHANNELS * 4;
    WAVEFORMATEX {
        wFormatTag: WAVE_FORMAT_IEEE_FLOAT,
        nChannels: CHANNELS,
        nSamplesPerSec: SAMPLE_RATE,
        nAvgBytesPerSec: SAMPLE_RATE * u32::from(block),
        nBlockAlign: block,
        wBitsPerSample: 32,
        cbSize: 0,
    }
}

struct Silence {
    client: IAudioClient,
    render: IAudioRenderClient,
    size: u32,
}

impl Silence {
    fn open(devices: &IMMDeviceEnumerator) -> Result<Self> {
        let device = unsafe { devices.GetDefaultAudioEndpoint(eRender, eConsole) }?;
        let client: IAudioClient = unsafe { device.Activate(CLSCTX_ALL, None) }?;
        let mix = unsafe { client.GetMixFormat() }?;
        let initialized = unsafe { client.Initialize(AUDCLNT_SHAREMODE_SHARED, 0, BUFFER, 0, mix, None) };
        unsafe { CoTaskMemFree(Some(mix.cast())) };
        initialized?;
        let render: IAudioRenderClient = unsafe { client.GetService() }?;
        let size = unsafe { client.GetBufferSize() }?;
        let silence = Self { client, render, size };
        silence.fill()?;
        unsafe { silence.client.Start() }?;
        Ok(silence)
    }

    fn fill(&self) -> Result<()> {
        let free = self.size.saturating_sub(unsafe { self.client.GetCurrentPadding() }?);
        if free == 0 {
            return Ok(());
        }
        unsafe {
            self.render.GetBuffer(free)?;
            self.render.ReleaseBuffer(free, AUDCLNT_BUFFERFLAGS_SILENT.0 as u32)
        }
    }
}

impl Drop for Silence {
    fn drop(&mut self) {
        let _ = unsafe { self.client.Stop() };
    }
}

struct Stream {
    client: IAudioClient,
    capture: IAudioCaptureClient,
    silence: Option<Silence>,
}

impl Stream {
    fn open(source: AudioSource) -> Result<Self> {
        let devices: IMMDeviceEnumerator = unsafe { CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL) }?;
        let (flow, loopback) = match source {
            AudioSource::System => (eRender, AUDCLNT_STREAMFLAGS_LOOPBACK),
            AudioSource::Microphone => (eCapture, 0),
        };
        let device = unsafe { devices.GetDefaultAudioEndpoint(flow, eConsole) }?;
        let client: IAudioClient = unsafe { device.Activate(CLSCTX_ALL, None) }?;
        let format = float_format();
        let flags = loopback | AUDCLNT_STREAMFLAGS_AUTOCONVERTPCM | AUDCLNT_STREAMFLAGS_SRC_DEFAULT_QUALITY;
        unsafe { client.Initialize(AUDCLNT_SHAREMODE_SHARED, flags, BUFFER, 0, &format, None) }?;
        let capture: IAudioCaptureClient = unsafe { client.GetService() }?;
        let silence = match source {
            AudioSource::System => Some(Silence::open(&devices)?),
            AudioSource::Microphone => None,
        };
        unsafe { client.Start() }?;
        Ok(Self { client, capture, silence })
    }

    fn drain(&self, on_packet: &mut impl FnMut(Vec<f32>, i64)) -> Result<()> {
        if let Some(silence) = &self.silence {
            silence.fill()?;
        }
        while unsafe { self.capture.GetNextPacketSize() }? > 0 {
            let (mut data, mut frames, mut flags, mut qpc) = (std::ptr::null_mut(), 0u32, 0u32, 0u64);
            unsafe { self.capture.GetBuffer(&mut data, &mut frames, &mut flags, None, Some(&mut qpc)) }?;
            let count = frames as usize * usize::from(CHANNELS);
            let silent = flags & AUDCLNT_BUFFERFLAGS_SILENT.0 as u32 != 0;
            let samples = if silent || data.is_null() {
                vec![0.0; count]
            } else {
                unsafe { std::slice::from_raw_parts(data.cast::<f32>(), count) }.to_vec()
            };
            unsafe { self.capture.ReleaseBuffer(frames) }?;
            on_packet(samples, qpc as i64);
        }
        Ok(())
    }
}

impl Drop for Stream {
    fn drop(&mut self) {
        let _ = unsafe { self.client.Stop() };
    }
}

pub(crate) struct AudioCapture {
    stop: Arc<AtomicBool>,
    thread: Option<JoinHandle<()>>,
}

impl AudioCapture {
    pub(crate) fn start<F>(source: AudioSource, mut on_packet: F) -> std::result::Result<Self, String>
    where
        F: FnMut(Vec<f32>, i64) + Send + 'static,
    {
        let stop = Arc::new(AtomicBool::new(false));
        let flag = Arc::clone(&stop);
        let (ready, started) = mpsc::channel();
        let thread = std::thread::Builder::new()
            .name("fuyu-recording-audio".into())
            .spawn(move || {
                let _apartment = match ComApartment::multithreaded() {
                    Ok(apartment) => apartment,
                    Err(error) => {
                        let _ = ready.send(Err(error.to_string()));
                        return;
                    }
                };
                let stream = match Stream::open(source) {
                    Ok(stream) => stream,
                    Err(error) => {
                        let _ = ready.send(Err(error.to_string()));
                        return;
                    }
                };
                let _ = ready.send(Ok(()));
                while !flag.load(Ordering::Relaxed) {
                    if stream.drain(&mut on_packet).is_err() {
                        break;
                    }
                    std::thread::sleep(POLL);
                }
            })
            .map_err(|error| error.to_string())?;
        match started.recv() {
            Ok(Ok(())) => Ok(Self { stop, thread: Some(thread) }),
            Ok(Err(error)) => {
                let _ = thread.join();
                Err(error)
            }
            Err(_) => {
                let _ = thread.join();
                Err("The audio thread stopped.".to_string())
            }
        }
    }
}

impl Drop for AudioCapture {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(thread) = self.thread.take() {
            let _ = thread.join();
        }
    }
}
