use webview2_com::Microsoft::Web::WebView2::Win32::{ICoreWebView2Controller, ICoreWebView2Controller3};
use windows::core::Interface;

pub(crate) fn pin(controller: &ICoreWebView2Controller, scale: f64) -> Result<(), String> {
    let controller = controller
        .cast::<ICoreWebView2Controller3>()
        .map_err(|error| format!("This WebView2 runtime cannot set the rasterization scale: {error}"))?;
    unsafe { controller.SetShouldDetectMonitorScaleChanges(false) }
        .map_err(|error| format!("Could not stop the WebView following the system scale: {error}"))?;
    unsafe { controller.SetRasterizationScale(scale) }.map_err(|error| format!("Could not set the WebView scale: {error}"))
}
