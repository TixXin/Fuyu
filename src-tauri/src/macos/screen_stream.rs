use std::{ptr::NonNull, sync::mpsc, time::Duration};

use block2::RcBlock;
use dispatch2::{DispatchQueue, DispatchRetained};
use objc2::{define_class, msg_send, rc::Retained, runtime::ProtocolObject, AllocAnyThread, DefinedClass};
use objc2_core_foundation::{CFArray, CFDictionary, CFNumber, CFType, CGPoint, CGRect, CGSize};
use objc2_core_graphics::{CGDisplayCopyDisplayMode, CGDisplayMode};
use objc2_core_media::{CMClock, CMSampleBuffer, CMTime, CMTimeFlags};
use objc2_foundation::{NSArray, NSError, NSObject, NSObjectProtocol};
use objc2_screen_capture_kit::{
    SCContentFilter, SCDisplay, SCFrameStatus, SCRunningApplication, SCShareableContent, SCStream, SCStreamConfiguration, SCStreamFrameInfoStatus,
    SCStreamOutput, SCStreamOutputType, SCWindow,
};

const WAIT: Duration = Duration::from_secs(4);
const PIXEL_FORMAT_BGRA: u32 = 0x4247_5241;
const QUEUE_DEPTH: isize = 6;
const AUDIO_RATE: isize = 48_000;
const AUDIO_CHANNELS: isize = 2;
const NANOS: i32 = 1_000_000_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Output {
    Screen,
    Audio,
    Microphone,
}

pub(crate) struct Spec {
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) width: f64,
    pub(crate) height: f64,
    pub(crate) output: (u32, u32),
    pub(crate) fps: u32,
    pub(crate) system_audio: bool,
    pub(crate) microphone: bool,
    pub(crate) own_windows: bool,
}

pub(crate) struct Area {
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) width: f64,
    pub(crate) height: f64,
}

type Handler = Box<dyn Fn(&CMSampleBuffer, Output) + Send + Sync>;

define_class!(
    #[unsafe(super(NSObject))]
    #[name = "FuyuRecordingOutput"]
    #[ivars = Handler]
    struct StreamOutput;

    unsafe impl NSObjectProtocol for StreamOutput {}

    unsafe impl SCStreamOutput for StreamOutput {
        #[unsafe(method(stream:didOutputSampleBuffer:ofType:))]
        fn did_output(&self, _stream: &SCStream, buffer: &CMSampleBuffer, kind: SCStreamOutputType) {
            let output = if kind == SCStreamOutputType::Screen {
                Output::Screen
            } else if kind == SCStreamOutputType::Audio {
                Output::Audio
            } else if kind == SCStreamOutputType::Microphone {
                Output::Microphone
            } else {
                return;
            };
            (self.ivars())(buffer, output);
        }
    }
);

impl StreamOutput {
    fn new(handler: Handler) -> Retained<Self> {
        let this = Self::alloc().set_ivars(handler);
        unsafe { msg_send![super(this), init] }
    }
}

pub(crate) struct ScreenStream {
    stream: Retained<SCStream>,
    _output: Retained<StreamOutput>,
    _queue: DispatchRetained<DispatchQueue>,
}

unsafe impl Send for ScreenStream {}

fn content() -> Option<Retained<SCShareableContent>> {
    let (sender, receiver) = mpsc::channel();
    let handler = RcBlock::new(move |content: *mut SCShareableContent, _error: *mut NSError| {
        let content = NonNull::new(content).and_then(|content| unsafe { Retained::retain(content.as_ptr()) });
        let _ = sender.send(content.map(Shared));
    });
    unsafe { SCShareableContent::getShareableContentExcludingDesktopWindows_onScreenWindowsOnly_completionHandler(false, true, &handler) };
    receiver.recv_timeout(WAIT).ok().flatten().map(|shared| shared.0)
}

struct Shared<T>(Retained<T>);

unsafe impl<T> Send for Shared<T> {}

fn contains(frame: CGRect, point: (f64, f64)) -> bool {
    point.0 >= frame.origin.x && point.0 < frame.origin.x + frame.size.width && point.1 >= frame.origin.y && point.1 < frame.origin.y + frame.size.height
}

fn display_at(content: &SCShareableContent, point: (f64, f64)) -> Option<Retained<SCDisplay>> {
    unsafe { content.displays() }.iter().find(|display| contains(unsafe { display.frame() }, point))
}

fn scale_of(display: &SCDisplay) -> f64 {
    let mode = CGDisplayCopyDisplayMode(unsafe { display.displayID() });
    let (pixels, points) = (CGDisplayMode::pixel_width(mode.as_deref()), CGDisplayMode::width(mode.as_deref()));
    if pixels == 0 || points == 0 {
        return 1.0;
    }
    pixels as f64 / points as f64
}

pub(crate) fn area_at(x: f64, y: f64, pixel_width: u32, pixel_height: u32) -> Option<Area> {
    let content = content()?;
    let display = display_at(&content, (x, y))?;
    let scale = scale_of(&display);
    Some(Area { x, y, width: f64::from(pixel_width) / scale, height: f64::from(pixel_height) / scale })
}

fn is_own(pid: i32) -> bool {
    u32::try_from(pid).ok() == Some(std::process::id())
}

impl ScreenStream {
    pub(crate) fn start(spec: &Spec, handler: impl Fn(&CMSampleBuffer, Output) + Send + Sync + 'static) -> Result<Self, String> {
        let content = content().ok_or("Could not list the screens. Check the Screen Recording permission.")?;
        let centre = (spec.x + spec.width / 2.0, spec.y + spec.height / 2.0);
        let display = display_at(&content, centre).ok_or("The area is not on a screen.")?;
        let frame = unsafe { display.frame() };
        let ours: Vec<_> = if spec.own_windows {
            Vec::new()
        } else {
            unsafe { content.applications() }.iter().filter(|app| is_own(unsafe { app.processID() })).collect()
        };
        let filter = unsafe {
            SCContentFilter::initWithDisplay_excludingApplications_exceptingWindows(
                SCContentFilter::alloc(),
                &display,
                &NSArray::<SCRunningApplication>::from_retained_slice(&ours),
                &NSArray::<SCWindow>::new(),
            )
        };
        let config = unsafe { SCStreamConfiguration::new() };
        unsafe {
            config.setSourceRect(CGRect::new(CGPoint::new(spec.x - frame.origin.x, spec.y - frame.origin.y), CGSize::new(spec.width, spec.height)));
            config.setWidth(spec.output.0 as usize);
            config.setHeight(spec.output.1 as usize);
            config.setMinimumFrameInterval(CMTime { value: 1, timescale: spec.fps.max(1) as i32, flags: CMTimeFlags::Valid, epoch: 0 });
            config.setPixelFormat(PIXEL_FORMAT_BGRA);
            config.setShowsCursor(true);
            config.setQueueDepth(QUEUE_DEPTH);
            config.setCapturesAudio(spec.system_audio);
            config.setSampleRate(AUDIO_RATE);
            config.setChannelCount(AUDIO_CHANNELS);
            config.setExcludesCurrentProcessAudio(true);
            config.setCaptureMicrophone(spec.microphone);
        }
        let stream = unsafe { SCStream::initWithFilter_configuration_delegate(SCStream::alloc(), &filter, &config, None) };
        let output = StreamOutput::new(Box::new(handler));
        let queue = DispatchQueue::new("com.tixxin.fuyu.recording", None);
        let protocol = ProtocolObject::from_ref(&*output);
        let mut kinds = vec![SCStreamOutputType::Screen];
        if spec.system_audio {
            kinds.push(SCStreamOutputType::Audio);
        }
        if spec.microphone {
            kinds.push(SCStreamOutputType::Microphone);
        }
        for kind in kinds {
            unsafe { stream.addStreamOutput_type_sampleHandlerQueue_error(protocol, kind, Some(&queue)) }.map_err(|error| error.localizedDescription().to_string())?;
        }
        wait(|done| unsafe { stream.startCaptureWithCompletionHandler(Some(done)) })?;
        Ok(Self { stream, _output: output, _queue: queue })
    }

    pub(crate) fn stop(self) {
        let _ = wait(|done| unsafe { self.stream.stopCaptureWithCompletionHandler(Some(done)) });
    }
}

fn wait(call: impl FnOnce(&block2::DynBlock<dyn Fn(*mut NSError)>)) -> Result<(), String> {
    let (sender, receiver) = mpsc::channel();
    let done = RcBlock::new(move |error: *mut NSError| {
        let message = unsafe { error.as_ref() }.map(|error| error.localizedDescription().to_string());
        let _ = sender.send(message);
    });
    call(&done);
    match receiver.recv_timeout(WAIT) {
        Ok(None) => Ok(()),
        Ok(Some(message)) => Err(message),
        Err(_) => Err("The screen capture did not answer.".to_string()),
    }
}

pub(crate) use objc2_core_media::CMSampleBuffer as SampleBuffer;

pub(crate) trait Sample {
    fn presentation_nanos(&self) -> Option<i64>;
    fn is_complete_frame(&self) -> bool;
}

impl Sample for CMSampleBuffer {
    fn presentation_nanos(&self) -> Option<i64> {
        nanos(unsafe { self.presentation_time_stamp() })
    }

    fn is_complete_frame(&self) -> bool {
        is_complete_frame(self)
    }
}

fn is_complete_frame(buffer: &CMSampleBuffer) -> bool {
    if unsafe { buffer.image_buffer() }.is_none() {
        return false;
    }
    let Some(attachments) = (unsafe { buffer.sample_attachments_array(false) }) else {
        return false;
    };
    let attachments: &CFArray<CFDictionary<CFType, CFType>> = unsafe { attachments.cast_unchecked() };
    let Some(info) = attachments.get(0) else {
        return false;
    };
    let key: &CFType = unsafe { &*(SCStreamFrameInfoStatus as *const objc2_screen_capture_kit::SCStreamFrameInfo).cast::<CFType>() };
    let status = info.get(key).and_then(|value| value.downcast_ref::<CFNumber>().and_then(|number| number.as_i64()));
    status == Some(SCFrameStatus::Complete.0 as i64)
}

fn nanos(time: CMTime) -> Option<i64> {
    if !time.flags.contains(CMTimeFlags::Valid) || time.timescale <= 0 {
        return None;
    }
    Some((i128::from(time.value) * i128::from(NANOS) / i128::from(time.timescale)) as i64)
}

pub(crate) fn host_now() -> i64 {
    nanos(unsafe { CMClock::host_time_clock().time() }).unwrap_or(0)
}
