use webview2_com::Microsoft::Web::WebView2::Win32::{ICoreWebView2Controller, ICoreWebView2Controller4};
use windows::core::Interface;

pub(crate) fn set_allow_external_drop(controller: &ICoreWebView2Controller, allowed: bool) -> Result<(), String> {
    let controller4 = controller
        .cast::<ICoreWebView2Controller4>()
        .map_err(|error| format!("This WebView2 runtime cannot toggle external drop: {error}"))?;
    unsafe { controller4.SetAllowExternalDrop(allowed) }
        .map_err(|error| format!("Could not update external drop state: {error}"))
}
