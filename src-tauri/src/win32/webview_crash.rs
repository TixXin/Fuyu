use webview2_com::{
    Microsoft::Web::WebView2::Win32::{
        ICoreWebView2, ICoreWebView2Controller, ICoreWebView2ProcessFailedEventArgs, ICoreWebView2ProcessFailedEventArgs2,
        COREWEBVIEW2_PROCESS_FAILED_KIND, COREWEBVIEW2_PROCESS_FAILED_KIND_GPU_PROCESS_EXITED,
        COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED, COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_UNRESPONSIVE,
    },
    ProcessFailedEventHandler,
};
use windows::core::Interface;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum FailureKind {
    RendererExited,
    RendererUnresponsive,
    GpuExited,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct Failure {
    pub kind: FailureKind,
    pub exit_code: Option<i32>,
}

pub(crate) struct Watched {
    webview: ICoreWebView2,
}

impl Watched {
    pub(crate) fn identity(&self) -> usize {
        self.webview.as_raw() as usize
    }
}

pub(crate) fn webview_of(controller: &ICoreWebView2Controller) -> Result<Watched, String> {
    let webview = unsafe { controller.CoreWebView2() }.map_err(|error| format!("Could not reach the WebView: {error}"))?;
    Ok(Watched { webview })
}

pub(crate) fn watch(watched: Watched, on_failure: impl Fn(Failure) -> bool + 'static) -> Result<(), String> {
    let handler = ProcessFailedEventHandler::create(Box::new(move |sender, args| {
        let (Some(sender), Some(args)) = (sender, args) else { return Ok(()) };
        let Some(failure) = read_failure(&args) else { return Ok(()) };
        if on_failure(failure) {
            unsafe { sender.Reload()? };
        }
        Ok(())
    }));
    let mut token = 0;
    unsafe { watched.webview.add_ProcessFailed(&handler, &mut token) }
        .map_err(|error| format!("Could not watch the WebView for crashes: {error}"))
}

fn classify_kind(kind: COREWEBVIEW2_PROCESS_FAILED_KIND) -> Option<FailureKind> {
    match kind {
        COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED => Some(FailureKind::RendererExited),
        COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_UNRESPONSIVE => Some(FailureKind::RendererUnresponsive),
        COREWEBVIEW2_PROCESS_FAILED_KIND_GPU_PROCESS_EXITED => Some(FailureKind::GpuExited),
        _ => None,
    }
}

fn read_failure(args: &ICoreWebView2ProcessFailedEventArgs) -> Option<Failure> {
    let mut kind = COREWEBVIEW2_PROCESS_FAILED_KIND::default();
    unsafe { args.ProcessFailedKind(&mut kind) }.ok()?;
    let kind = classify_kind(kind)?;
    let exit_code = args.cast::<ICoreWebView2ProcessFailedEventArgs2>().ok().and_then(|args2| {
        let mut code = 0;
        unsafe { args2.ExitCode(&mut code) }.ok().map(|()| code)
    });
    Some(Failure { kind, exit_code })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_renderer_and_gpu_failures_and_ignores_unrelated_processes() {
        assert_eq!(classify_kind(COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED), Some(FailureKind::RendererExited));
        assert_eq!(classify_kind(COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_UNRESPONSIVE), Some(FailureKind::RendererUnresponsive));
        assert_eq!(classify_kind(COREWEBVIEW2_PROCESS_FAILED_KIND_GPU_PROCESS_EXITED), Some(FailureKind::GpuExited));
        assert_eq!(classify_kind(COREWEBVIEW2_PROCESS_FAILED_KIND(4)), None);
    }
}
