use std::{
    ffi::{c_char, c_void, CString},
    time::{Duration, Instant},
};

type CFTypeRef = *const c_void;
type CFIndex = isize;

const UTF8: u32 = 0x0800_0100;
const NUMBER_SINT32: CFIndex = 3;
const RUN_SLICE_SECONDS: f64 = 0.25;
const MODE_NAME: &[u8] = b"com.tixxin.fuyu.pac\0";

#[repr(C)]
struct StreamClientContext {
    version: CFIndex,
    info: *mut c_void,
    retain: Option<extern "C" fn(*const c_void) -> *const c_void>,
    release: Option<extern "C" fn(*const c_void)>,
    copy_description: Option<extern "C" fn(*const c_void) -> CFTypeRef>,
}

#[link(name = "CoreFoundation", kind = "framework")]
extern "C" {
    fn CFStringCreateWithCString(allocator: CFTypeRef, text: *const c_char, encoding: u32) -> CFTypeRef;
    fn CFURLCreateWithString(allocator: CFTypeRef, text: CFTypeRef, base: CFTypeRef) -> CFTypeRef;
    fn CFRelease(value: CFTypeRef);
    fn CFEqual(left: CFTypeRef, right: CFTypeRef) -> u8;
    fn CFRunLoopGetCurrent() -> CFTypeRef;
    fn CFRunLoopAddSource(run_loop: CFTypeRef, source: CFTypeRef, mode: CFTypeRef);
    fn CFRunLoopRemoveSource(run_loop: CFTypeRef, source: CFTypeRef, mode: CFTypeRef);
    fn CFRunLoopSourceInvalidate(source: CFTypeRef);
    fn CFRunLoopRunInMode(mode: CFTypeRef, seconds: f64, return_after_source_handled: u8) -> i32;
    fn CFArrayGetCount(array: CFTypeRef) -> CFIndex;
    fn CFArrayGetValueAtIndex(array: CFTypeRef, index: CFIndex) -> CFTypeRef;
    fn CFDictionaryGetValue(dictionary: CFTypeRef, key: CFTypeRef) -> CFTypeRef;
    fn CFStringGetCString(text: CFTypeRef, buffer: *mut c_char, size: CFIndex, encoding: u32) -> u8;
    fn CFNumberGetValue(number: CFTypeRef, kind: CFIndex, value: *mut c_void) -> u8;
    fn CFErrorGetCode(error: CFTypeRef) -> CFIndex;
}

#[link(name = "CFNetwork", kind = "framework")]
extern "C" {
    static kCFProxyTypeKey: CFTypeRef;
    static kCFProxyHostNameKey: CFTypeRef;
    static kCFProxyPortNumberKey: CFTypeRef;
    static kCFProxyTypeNone: CFTypeRef;
    static kCFProxyTypeHTTP: CFTypeRef;
    static kCFProxyTypeHTTPS: CFTypeRef;
    static kCFProxyTypeSOCKS: CFTypeRef;
    fn CFNetworkExecuteProxyAutoConfigurationURL(
        script_url: CFTypeRef,
        target_url: CFTypeRef,
        callback: extern "C" fn(*mut c_void, CFTypeRef, CFTypeRef),
        context: *mut StreamClientContext,
    ) -> CFTypeRef;
}

struct Owned(CFTypeRef);

impl Drop for Owned {
    fn drop(&mut self) {
        if !self.0.is_null() {
            unsafe { CFRelease(self.0) };
        }
    }
}

fn cf_string(text: &str) -> Option<Owned> {
    let text = CString::new(text).ok()?;
    let value = unsafe { CFStringCreateWithCString(std::ptr::null(), text.as_ptr(), UTF8) };
    (!value.is_null()).then_some(Owned(value))
}

fn cf_url(text: &str) -> Option<Owned> {
    let string = cf_string(text)?;
    let value = unsafe { CFURLCreateWithString(std::ptr::null(), string.0, std::ptr::null()) };
    (!value.is_null()).then_some(Owned(value))
}

struct Outcome {
    done: bool,
    result: Result<String, String>,
}

extern "C" fn on_result(client: *mut c_void, list: CFTypeRef, error: CFTypeRef) {
    let outcome = unsafe { &mut *client.cast::<Outcome>() };
    outcome.done = true;
    outcome.result = if !error.is_null() {
        Err(format!("CFNetwork error {}", unsafe { CFErrorGetCode(error) }))
    } else if list.is_null() {
        Ok("DIRECT".to_string())
    } else {
        Ok(describe_list(list))
    };
}

fn describe_list(list: CFTypeRef) -> String {
    let count = unsafe { CFArrayGetCount(list) };
    let mut entries = Vec::new();
    for index in 0..count {
        let entry = unsafe { CFArrayGetValueAtIndex(list, index) };
        if let Some(text) = describe_entry(entry) {
            entries.push(text);
        }
    }
    entries.join("; ")
}

fn describe_entry(entry: CFTypeRef) -> Option<String> {
    if entry.is_null() {
        return None;
    }
    let kind = unsafe { CFDictionaryGetValue(entry, kCFProxyTypeKey) };
    if kind.is_null() {
        return None;
    }
    let is = |other: CFTypeRef| unsafe { CFEqual(kind, other) } != 0;
    let keyword = if is(unsafe { kCFProxyTypeNone }) {
        return Some("DIRECT".to_string());
    } else if is(unsafe { kCFProxyTypeHTTP }) || is(unsafe { kCFProxyTypeHTTPS }) {
        "PROXY"
    } else if is(unsafe { kCFProxyTypeSOCKS }) {
        "SOCKS"
    } else {
        return None;
    };
    let host = read_string(unsafe { CFDictionaryGetValue(entry, kCFProxyHostNameKey) })?;
    let port = read_port(unsafe { CFDictionaryGetValue(entry, kCFProxyPortNumberKey) })?;
    let host = if host.contains(':') && !host.starts_with('[') { format!("[{host}]") } else { host };
    Some(format!("{keyword} {host}:{port}"))
}

fn read_string(value: CFTypeRef) -> Option<String> {
    if value.is_null() {
        return None;
    }
    let mut buffer = vec![0 as c_char; 1024];
    let ok = unsafe { CFStringGetCString(value, buffer.as_mut_ptr(), buffer.len() as CFIndex, UTF8) };
    if ok == 0 {
        return None;
    }
    let bytes: Vec<u8> = buffer.iter().take_while(|byte| **byte != 0).map(|byte| *byte as u8).collect();
    String::from_utf8(bytes).ok().filter(|text| !text.is_empty())
}

fn read_port(value: CFTypeRef) -> Option<u16> {
    if value.is_null() {
        return None;
    }
    let mut port: i32 = 0;
    let ok = unsafe { CFNumberGetValue(value, NUMBER_SINT32, (&mut port as *mut i32).cast::<c_void>()) };
    if ok == 0 {
        return None;
    }
    u16::try_from(port).ok().filter(|port| *port > 0)
}

pub(crate) fn proxy_for_url(script_url: &str, url: &str, timeout: Duration) -> Result<String, String> {
    let script = cf_url(script_url).ok_or_else(|| "invalid PAC script URL".to_string())?;
    let target = cf_url(url).ok_or_else(|| "invalid target URL".to_string())?;
    let mode = unsafe { CFStringCreateWithCString(std::ptr::null(), MODE_NAME.as_ptr().cast::<c_char>(), UTF8) };
    if mode.is_null() {
        return Err("could not create run loop mode".to_string());
    }
    let mode = Owned(mode);
    let mut outcome = Outcome {
        done: false,
        result: Err("PAC evaluation timed out".to_string()),
    };
    let mut context = StreamClientContext {
        version: 0,
        info: (&mut outcome as *mut Outcome).cast::<c_void>(),
        retain: None,
        release: None,
        copy_description: None,
    };
    let source = unsafe { CFNetworkExecuteProxyAutoConfigurationURL(script.0, target.0, on_result, &mut context) };
    if source.is_null() {
        return Err("CFNetwork could not start PAC evaluation".to_string());
    }
    let source = Owned(source);
    let run_loop = unsafe { CFRunLoopGetCurrent() };
    unsafe { CFRunLoopAddSource(run_loop, source.0, mode.0) };
    let started = Instant::now();
    while !outcome.done && started.elapsed() < timeout {
        unsafe { CFRunLoopRunInMode(mode.0, RUN_SLICE_SECONDS, 1) };
    }
    unsafe {
        CFRunLoopRemoveSource(run_loop, source.0, mode.0);
        CFRunLoopSourceInvalidate(source.0);
    }
    outcome.result
}

#[cfg(test)]
mod tests {
    use std::{
        io::{Read, Write},
        net::{Shutdown, TcpListener, TcpStream},
        thread,
        time::Duration,
    };

    const SCRIPT: &str = "function FindProxyForURL(url, host) { if (shExpMatch(host, \"*.example.com\")) return \"PROXY 10.1.2.3:8080; SOCKS 10.1.2.4:1080; DIRECT\"; return \"DIRECT\"; }";

    fn serve(mut socket: TcpStream) {
        let _ = socket.set_read_timeout(Some(Duration::from_secs(5)));
        let mut request = Vec::new();
        let mut buffer = [0u8; 1024];
        while !request.windows(4).any(|window| window == b"\r\n\r\n") {
            match socket.read(&mut buffer) {
                Ok(0) | Err(_) => return,
                Ok(read) => request.extend_from_slice(&buffer[..read]),
            }
        }
        let response = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/x-ns-proxy-autoconfig\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{SCRIPT}",
            SCRIPT.len()
        );
        let _ = socket.write_all(response.as_bytes());
        let _ = socket.shutdown(Shutdown::Write);
        let _ = socket.read(&mut buffer);
    }

    #[test]
    fn evaluates_a_pac_script_per_target_host() {
        let listener = TcpListener::bind("127.0.0.1:0").expect("bind pac server");
        let port = listener.local_addr().expect("addr").port();
        thread::spawn(move || {
            for socket in listener.incoming().flatten() {
                thread::spawn(move || serve(socket));
            }
        });
        let script_url = format!("http://127.0.0.1:{port}/proxy.pac");
        let routed = super::proxy_for_url(&script_url, "https://imap.example.com:993/", Duration::from_secs(10)).expect("evaluate");
        assert_eq!(routed, "PROXY 10.1.2.3:8080; SOCKS 10.1.2.4:1080; DIRECT");
        let direct = super::proxy_for_url(&script_url, "https://other.test/", Duration::from_secs(10)).expect("evaluate");
        assert_eq!(direct, "DIRECT");
        let missing = super::proxy_for_url("http://127.0.0.1:9/none.pac", "https://imap.example.com:993/", Duration::from_secs(10));
        assert!(missing.is_err());
    }
}
