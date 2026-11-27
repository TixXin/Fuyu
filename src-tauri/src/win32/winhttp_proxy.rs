use std::{ffi::c_void, time::Duration};

use windows::core::{HSTRING, PCWSTR, PWSTR};
use windows::Win32::Foundation::{GlobalFree, HGLOBAL};
use windows::Win32::Networking::WinHttp::{
    WinHttpCloseHandle, WinHttpGetIEProxyConfigForCurrentUser, WinHttpGetProxyForUrl, WinHttpOpen, WinHttpSetTimeouts,
    WINHTTP_ACCESS_TYPE_NO_PROXY, WINHTTP_AUTOPROXY_AUTO_DETECT, WINHTTP_AUTOPROXY_CONFIG_URL, WINHTTP_AUTOPROXY_OPTIONS,
    WINHTTP_AUTO_DETECT_TYPE_DHCP, WINHTTP_AUTO_DETECT_TYPE_DNS_A, WINHTTP_CURRENT_USER_IE_PROXY_CONFIG, WINHTTP_PROXY_INFO,
};

pub(crate) struct IeProxyConfig {
    pub(crate) auto_detect: bool,
    pub(crate) script_url: Option<String>,
    pub(crate) proxy: Option<String>,
    pub(crate) bypass: Option<String>,
}

pub(crate) fn ie_proxy_config() -> Option<IeProxyConfig> {
    let mut config = WINHTTP_CURRENT_USER_IE_PROXY_CONFIG::default();
    let result = unsafe { WinHttpGetIEProxyConfigForCurrentUser(&mut config) };
    let script_url = take_string(config.lpszAutoConfigUrl);
    let proxy = take_string(config.lpszProxy);
    let bypass = take_string(config.lpszProxyBypass);
    result.ok()?;
    Some(IeProxyConfig {
        auto_detect: config.fAutoDetect.as_bool(),
        script_url,
        proxy,
        bypass,
    })
}

fn take_string(value: PWSTR) -> Option<String> {
    if value.is_null() {
        return None;
    }
    let text = unsafe { value.to_string() }.ok();
    let _ = unsafe { GlobalFree(Some(HGLOBAL(value.0.cast::<c_void>()))) };
    text.map(|text| text.trim().to_string()).filter(|text| !text.is_empty())
}

struct Session(*mut c_void);

impl Drop for Session {
    fn drop(&mut self) {
        let _ = unsafe { WinHttpCloseHandle(self.0) };
    }
}

pub(crate) fn proxy_for_url(script_url: Option<&str>, url: &str, timeout: Duration) -> Result<String, String> {
    let agent = HSTRING::from(concat!("Fuyu/", env!("CARGO_PKG_VERSION")));
    let handle = unsafe { WinHttpOpen(&agent, WINHTTP_ACCESS_TYPE_NO_PROXY, PCWSTR::null(), PCWSTR::null(), 0) };
    if handle.is_null() {
        return Err(format!("WinHttpOpen failed: {}", windows::core::Error::from_thread()));
    }
    let session = Session(handle);
    let millis = i32::try_from(timeout.as_millis()).unwrap_or(i32::MAX);
    let _ = unsafe { WinHttpSetTimeouts(session.0, millis, millis, millis, millis) };
    let script = script_url.map(HSTRING::from);
    let mut options = WINHTTP_AUTOPROXY_OPTIONS {
        fAutoLogonIfChallenged: true.into(),
        ..Default::default()
    };
    match &script {
        Some(script) => {
            options.dwFlags = WINHTTP_AUTOPROXY_CONFIG_URL;
            options.lpszAutoConfigUrl = PCWSTR(script.as_ptr());
        }
        None => {
            options.dwFlags = WINHTTP_AUTOPROXY_AUTO_DETECT;
            options.dwAutoDetectFlags = WINHTTP_AUTO_DETECT_TYPE_DHCP | WINHTTP_AUTO_DETECT_TYPE_DNS_A;
        }
    }
    let target = HSTRING::from(url);
    let mut info = WINHTTP_PROXY_INFO::default();
    let result = unsafe { WinHttpGetProxyForUrl(session.0, &target, &mut options, &mut info) };
    let proxy = take_string(info.lpszProxy);
    let _ = take_string(info.lpszProxyBypass);
    if let Err(error) = result {
        return Err(format!("WinHttpGetProxyForUrl failed: {} ({})", error.message(), error.code().0 & 0xFFFF));
    }
    match proxy {
        Some(proxy) if info.dwAccessType != WINHTTP_ACCESS_TYPE_NO_PROXY => Ok(proxy),
        _ => Ok("DIRECT".to_string()),
    }
}
