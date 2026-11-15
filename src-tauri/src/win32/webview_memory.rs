use webview2_com::Microsoft::Web::WebView2::Win32::{
    ICoreWebView2Controller, ICoreWebView2_19, COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW,
    COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL,
};
use windows::core::Interface;

pub(crate) fn set_low(controller: &ICoreWebView2Controller, low: bool) -> Result<(), String> {
    let webview = unsafe { controller.CoreWebView2() }.map_err(|error| format!("Could not reach the WebView: {error}"))?;
    let webview = webview
        .cast::<ICoreWebView2_19>()
        .map_err(|error| format!("This WebView2 runtime has no memory usage level: {error}"))?;
    let level = if low { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_LOW } else { COREWEBVIEW2_MEMORY_USAGE_TARGET_LEVEL_NORMAL };
    unsafe { webview.SetMemoryUsageTargetLevel(level) }.map_err(|error| format!("Could not set the memory usage level: {error}"))
}
