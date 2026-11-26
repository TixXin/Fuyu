use std::{
    sync::{mpsc, Arc},
    time::Duration,
};

use tauri::WebviewWindow;
use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2Environment12, ICoreWebView2_17, COREWEBVIEW2_SHARED_BUFFER_ACCESS_READ_ONLY,
};
use windows::core::{Interface, HSTRING};

const POST_WAIT: Duration = Duration::from_millis(800);

pub(crate) fn post_rgba(
    window: &WebviewWindow,
    id: u64,
    width: u32,
    height: u32,
    bytes: Arc<Vec<u8>>,
) -> Result<(), String> {
    if bytes.is_empty() {
        return Err("empty frame".to_string());
    }
    let (sender, receiver) = mpsc::sync_channel::<Result<(), String>>(1);
    window
        .with_webview(move |platform| {
            let outcome = post_on_ui_thread(&platform, id, width, height, &bytes);
            let _ = sender.send(outcome);
        })
        .map_err(|error| error.to_string())?;
    receiver
        .recv_timeout(POST_WAIT)
        .map_err(|error| error.to_string())
        .and_then(|outcome| outcome)
}

fn post_on_ui_thread(
    platform: &tauri::webview::PlatformWebview,
    id: u64,
    width: u32,
    height: u32,
    bytes: &[u8],
) -> Result<(), String> {
    let env12 = platform.environment().cast::<ICoreWebView2Environment12>().map_err(|error| error.to_string())?;
    let shared = unsafe { env12.CreateSharedBuffer(bytes.len() as u64) }.map_err(|error| error.to_string())?;
    let mut ptr = std::ptr::null_mut();
    if let Err(error) = unsafe { shared.Buffer(&mut ptr) } {
        let _ = unsafe { shared.Close() };
        return Err(error.to_string());
    }
    if ptr.is_null() {
        let _ = unsafe { shared.Close() };
        return Err("null shared buffer pointer".to_string());
    }
    unsafe { std::ptr::copy_nonoverlapping(bytes.as_ptr(), ptr, bytes.len()) };
    let core = unsafe { platform.controller().CoreWebView2() }.map_err(|error| {
        let _ = unsafe { shared.Close() };
        error.to_string()
    })?;
    let core17 = core.cast::<ICoreWebView2_17>().map_err(|error| {
        let _ = unsafe { shared.Close() };
        error.to_string()
    })?;
    let meta = HSTRING::from(format!(r#"{{"id":{id},"width":{width},"height":{height}}}"#));
    let posted = unsafe { core17.PostSharedBufferToScript(&shared, COREWEBVIEW2_SHARED_BUFFER_ACCESS_READ_ONLY, &meta) };
    let _ = unsafe { shared.Close() };
    posted.map_err(|error| error.to_string())
}
