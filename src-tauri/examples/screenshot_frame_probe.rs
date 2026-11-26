use std::{
    borrow::Cow,
    io::Cursor,
    sync::{Arc, Mutex, OnceLock, PoisonError},
    time::Instant,
};

use image::{
    codecs::{
        bmp::BmpEncoder,
        png::{CompressionType, FilterType, PngEncoder},
        webp::WebPEncoder,
    },
    ExtendedColorType, ImageEncoder,
};
use serde::Serialize;
use tauri::{
    http::{Request, Response},
    WebviewUrl, WebviewWindowBuilder,
};

const DEFAULT_SIZE: (u32, u32) = (3840, 2160);
const COMPACT_SIZE: (u32, u32) = (3072, 1728);

struct Frame {
    width: u32,
    height: u32,
    rgba: Vec<u8>,
    png: Mutex<Option<(Vec<u8>, f64)>>,
    webp: Mutex<Option<(Vec<u8>, f64)>>,
    qoi: Mutex<Option<(Vec<u8>, f64)>>,
    bmp: Mutex<Option<(Vec<u8>, f64)>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ProbeSession {
    id: u64,
    mode: &'static str,
    width: u32,
    height: u32,
    under_pointer: bool,
}

struct RealProbeState {
    frame: Arc<Frame>,
    started: Mutex<Option<Instant>>,
}

static REAL_PROBE: OnceLock<RealProbeState> = OnceLock::new();

fn real_probe() -> &'static RealProbeState {
    REAL_PROBE.get_or_init(|| RealProbeState {
        frame: Arc::new(load(&[])),
        started: Mutex::new(None),
    })
}

fn elapsed_ms() -> f64 {
    real_probe()
        .started
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .map(|t| t.elapsed().as_secs_f64() * 1000.0)
        .unwrap_or(0.0)
}

#[tauri::command]
fn read_settings_file() -> Option<String> {
    None
}

#[tauri::command]
fn screenshot_session(window: tauri::WebviewWindow) -> Option<ProbeSession> {
    println!("real_overlay session_req [{}]: {:.1} ms", window.label(), elapsed_ms());
    let frame = &real_probe().frame;
    Some(ProbeSession { id: 1, mode: "region", width: frame.width, height: frame.height, under_pointer: true })
}

#[tauri::command]
async fn screenshot_frame() -> Result<tauri::ipc::Response, String> {
    let t0 = Instant::now();
    println!("real_overlay frame_start: {:.1} ms", elapsed_ms());
    let bytes = real_probe().frame.rgba.clone();
    println!("real_overlay frame_send: {:.1} ms (copy {:.1} ms)", elapsed_ms(), t0.elapsed().as_secs_f64() * 1000.0);
    Ok(tauri::ipc::Response::new(bytes))
}

#[tauri::command]
fn screenshot_targets() -> Vec<()> {
    Vec::new()
}

#[tauri::command]
fn screenshot_overlay_ready(window: tauri::WebviewWindow, _session: u64) {
    println!("real_overlay ready_cmd: {:.1} ms", elapsed_ms());
    let _ = window.show();
}

#[tauri::command]
fn probe_log(msg: String) {
    println!("real_overlay js @{:.1}ms: {msg}", elapsed_ms());
}

#[tauri::command]
fn probe_overlay_done(canvas_ms: f64, magnifier_ms: f64) {
    println!("real_overlay total: {:.1} ms (canvas_rel {:.1} ms, magnifier_rel {:.1} ms)", elapsed_ms(), canvas_ms, magnifier_ms);
    std::process::exit(0);
}

fn synthetic_desktop(width: u32, height: u32, pure_noise: bool) -> Vec<u8> {
    let mut rgba = vec![0u8; width as usize * height as usize * 4];
    for y in 0..height {
        let row_start = y as usize * width as usize * 4;
        for x in 0..width {
            let at = row_start + x as usize * 4;
            let px = if pure_noise {
                let noise = (x.wrapping_mul(2_654_435_761) ^ y.wrapping_mul(40_503)) as u8;
                [(x / 12) as u8, (y / 7) as u8, noise & 0x1f, 255]
            } else if y < 64 {
                [28, 30, 36, 255]
            } else if x > width / 6 && x < width * 5 / 6 && y > height / 8 && y < height * 7 / 8 {
                if x > width * 2 / 3 && y > height * 2 / 3 {
                    let noise = (x.wrapping_mul(2_654_435_761) ^ y.wrapping_mul(40_503)) as u8;
                    [((x * 255) / width) as u8, ((y * 255) / height) as u8, noise & 0x3f, 255]
                } else if y % 28 < 16 && x % 14 < 10 && x > width / 4 {
                    [232, 236, 244, 255]
                } else {
                    [22, 24, 29, 255]
                }
            } else {
                [((x * 160) / width + 20) as u8, ((y * 140) / height + 40) as u8, 130, 255]
            };
            rgba[at..at + 4].copy_from_slice(&px);
        }
    }
    rgba
}

fn load(args: &[String]) -> Frame {
    let mut path = None;
    let mut size = DEFAULT_SIZE;
    let mut pure_noise = false;
    for arg in args {
        if arg == "--3k" {
            size = COMPACT_SIZE;
        } else if arg == "--noise" {
            pure_noise = true;
        } else if !arg.starts_with("--") && path.is_none() {
            path = Some(arg.clone());
        }
    }
    let picture = path.and_then(|path| image::open(&path).map_err(|error| eprintln!("could not open {path}: {error}")).ok());
    let (width, height, rgba) = match picture {
        Some(picture) => {
            let rgba = picture.to_rgba8();
            (rgba.width(), rgba.height(), rgba.into_raw())
        }
        None => (size.0, size.1, synthetic_desktop(size.0, size.1, pure_noise)),
    };
    Frame {
        width,
        height,
        rgba,
        png: Mutex::new(None),
        webp: Mutex::new(None),
        qoi: Mutex::new(None),
        bmp: Mutex::new(None),
    }
}

fn encode_cached(slot: &Mutex<Option<(Vec<u8>, f64)>>, encode: impl FnOnce() -> Vec<u8>) -> (Vec<u8>, f64) {
    let mut cached = slot.lock().unwrap_or_else(PoisonError::into_inner);
    if let Some(done) = cached.as_ref() {
        return done.clone();
    }
    let started = Instant::now();
    let bytes = encode();
    let done = (bytes, started.elapsed().as_secs_f64() * 1000.0);
    *cached = Some(done.clone());
    done
}

fn encode_qoi(rgba: &[u8], width: u32, height: u32) -> Vec<u8> {
    let mut out = Vec::with_capacity(rgba.len() / 2 + 24);
    out.extend_from_slice(b"qoif");
    out.extend_from_slice(&width.to_be_bytes());
    out.extend_from_slice(&height.to_be_bytes());
    out.push(4);
    out.push(0);
    let mut index = [[0u8; 4]; 64];
    let mut prev = [0u8, 0u8, 0u8, 255u8];
    let mut run = 0u8;
    let pixels = rgba.as_chunks::<4>().0;
    for (idx, &px) in pixels.iter().enumerate() {
        if px == prev {
            run += 1;
            if run == 62 || idx + 1 == pixels.len() {
                out.push(0xc0 | (run - 1));
                run = 0;
            }
            continue;
        }
        if run > 0 {
            out.push(0xc0 | (run - 1));
            run = 0;
        }
        let hash = (px[0] as usize * 3 + px[1] as usize * 5 + px[2] as usize * 7 + px[3] as usize * 11) & 63;
        if index[hash] == px {
            out.push(hash as u8);
        } else {
            index[hash] = px;
            if px[3] == prev[3] {
                let dr = px[0].wrapping_sub(prev[0]) as i8;
                let dg = px[1].wrapping_sub(prev[1]) as i8;
                let db = px[2].wrapping_sub(prev[2]) as i8;
                let dr_dg = dr.wrapping_sub(dg);
                let db_dg = db.wrapping_sub(dg);
                if (-2..=1).contains(&dr) && (-2..=1).contains(&dg) && (-2..=1).contains(&db) {
                    out.push(0x40 | (((dr + 2) as u8) << 4) | (((dg + 2) as u8) << 2) | ((db + 2) as u8));
                } else if (-32..=31).contains(&dg) && (-8..=7).contains(&dr_dg) && (-8..=7).contains(&db_dg) {
                    out.push(0x80 | ((dg + 32) as u8));
                    out.push((((dr_dg + 8) as u8) << 4) | ((db_dg + 8) as u8));
                } else {
                    out.extend_from_slice(&[0xfe, px[0], px[1], px[2]]);
                }
            } else {
                out.extend_from_slice(&[0xff, px[0], px[1], px[2], px[3]]);
            }
        }
        prev = px;
    }
    out.extend_from_slice(&[0, 0, 0, 0, 0, 0, 0, 1]);
    out
}

fn png(frame: &Frame) -> (Vec<u8>, f64) {
    encode_cached(&frame.png, || {
        let mut bytes = Vec::with_capacity(frame.rgba.len() / 4);
        let encoder = PngEncoder::new_with_quality(Cursor::new(&mut bytes), CompressionType::Fast, FilterType::Adaptive);
        if let Err(error) = encoder.write_image(&frame.rgba, frame.width, frame.height, ExtendedColorType::Rgba8) {
            eprintln!("png failed: {error}");
        }
        bytes
    })
}

fn webp(frame: &Frame) -> (Vec<u8>, f64) {
    encode_cached(&frame.webp, || {
        let mut bytes = Vec::with_capacity(frame.rgba.len() / 4);
        let encoder = WebPEncoder::new_lossless(Cursor::new(&mut bytes));
        if let Err(error) = encoder.write_image(&frame.rgba, frame.width, frame.height, ExtendedColorType::Rgba8) {
            eprintln!("webp failed: {error}");
        }
        bytes
    })
}

fn qoi(frame: &Frame) -> (Vec<u8>, f64) {
    encode_cached(&frame.qoi, || encode_qoi(&frame.rgba, frame.width, frame.height))
}

fn bmp(frame: &Frame) -> (Vec<u8>, f64) {
    encode_cached(&frame.bmp, || {
        let mut bytes = Vec::with_capacity(frame.rgba.len() + 64);
        let encoder = BmpEncoder::new(&mut bytes);
        if let Err(error) = encoder.write_image(&frame.rgba, frame.width, frame.height, ExtendedColorType::Rgba8) {
            eprintln!("bmp failed: {error}");
        }
        bytes
    })
}

#[cfg(windows)]
fn send_shared_buffer(app: &tauri::AppHandle, frame: &Arc<Frame>) -> Result<(), String> {
    use tauri::Manager;
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        ICoreWebView2Environment12, ICoreWebView2_17, COREWEBVIEW2_SHARED_BUFFER_ACCESS_READ_ONLY,
    };
    use windows::core::{Interface, HSTRING};

    let window = app.get_webview_window("probe").ok_or_else(|| "probe window missing".to_string())?;
    let frame = Arc::clone(frame);
    window
        .with_webview(move |platform| {
            let started = Instant::now();
            let Ok(env12) = platform.environment().cast::<ICoreWebView2Environment12>() else { return };
            let Ok(shared) = (unsafe { env12.CreateSharedBuffer(frame.rgba.len() as u64) }) else { return };
            let mut ptr = std::ptr::null_mut();
            if unsafe { shared.Buffer(&mut ptr) }.is_err() || ptr.is_null() {
                return;
            }
            unsafe { std::ptr::copy_nonoverlapping(frame.rgba.as_ptr(), ptr, frame.rgba.len()) };
            let copy_ms = started.elapsed().as_secs_f64() * 1000.0;
            let Ok(core) = (unsafe { platform.controller().CoreWebView2() }) else { return };
            let Ok(core17) = core.cast::<ICoreWebView2_17>() else { return };
            let meta = HSTRING::from(format!(r#"{{"copyMs":{copy_ms:.2}}}"#));
            let _ = unsafe { core17.PostSharedBufferToScript(&shared, COREWEBVIEW2_SHARED_BUFFER_ACCESS_READ_ONLY, &meta) };
        })
        .map_err(|error| error.to_string())
}

#[cfg(not(windows))]
fn send_shared_buffer(_app: &tauri::AppHandle, _frame: &Arc<Frame>) -> Result<(), String> {
    Err("unsupported".to_string())
}

fn respond(
    app: &tauri::AppHandle,
    frame: &Arc<Frame>,
    request: &Request<Vec<u8>>,
    opened_at: Instant,
    spawn_time: &Arc<Mutex<Option<Instant>>>,
) -> Response<Cow<'static, [u8]>> {
    let path = request.uri().path().to_string();
    let builder = Response::builder()
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Expose-Headers", "*");
    let reply = |builder: tauri::http::response::Builder, kind: &str, body: Vec<u8>| {
        builder
            .header("Content-Type", kind)
            .body(Cow::Owned(body))
            .unwrap_or_else(|_| Response::new(Cow::Borrowed(&[][..])))
    };
    if path == "/warm-page" {
        return reply(builder, "text/html", WARM_PAGE.as_bytes().to_vec());
    }
    if path.starts_with("/raw") || path.starts_with("/async-raw") {
        let started = Instant::now();
        let body = frame.rgba.clone();
        let copy = started.elapsed().as_secs_f64() * 1000.0;
        return reply(builder.header("x-copy-ms", format!("{copy:.2}")), "application/octet-stream", body);
    }
    if path.starts_with("/part/") {
        let parts: Vec<usize> = path.trim_start_matches("/part/").split('-').filter_map(|part| part.parse().ok()).collect();
        let (index, count) = (parts.first().copied().unwrap_or(0), parts.get(1).copied().unwrap_or(1).max(1));
        let size = frame.rgba.len().div_ceil(count);
        let start = (index * size).min(frame.rgba.len());
        let end = (start + size).min(frame.rgba.len());
        return reply(builder, "application/octet-stream", frame.rgba[start..end].to_vec());
    }
    if path.starts_with("/png") {
        let (bytes, encode) = png(frame);
        return reply(builder.header("x-encode-ms", format!("{encode:.2}")), "image/png", bytes);
    }
    if path.starts_with("/webp") {
        let (bytes, encode) = webp(frame);
        return reply(builder.header("x-encode-ms", format!("{encode:.2}")), "image/webp", bytes);
    }
    if path.starts_with("/qoi") {
        let (bytes, encode) = qoi(frame);
        return reply(builder.header("x-encode-ms", format!("{encode:.2}")), "application/octet-stream", bytes);
    }
    if path.starts_with("/bmp") {
        let (bytes, encode) = bmp(frame);
        return reply(builder.header("x-encode-ms", format!("{encode:.2}")), "image/bmp", bytes);
    }
    if path.starts_with("/shared") {
        let ok = send_shared_buffer(app, frame).is_ok();
        return reply(builder, "text/plain", if ok { b"ok".to_vec() } else { b"unsupported".to_vec() });
    }
    if path.starts_with("/startup") {
        println!("window_build_to_js_ready: {:.1} ms", opened_at.elapsed().as_secs_f64() * 1000.0);
        return reply(builder, "text/plain", b"ok".to_vec());
    }
    if path.starts_with("/warm-ready") {
        let ms = spawn_time
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .map(|t| t.elapsed().as_secs_f64() * 1000.0)
            .unwrap_or(0.0);
        println!("second_window_build_to_js_ready: {ms:.1} ms");
        return reply(builder, "text/plain", b"ok".to_vec());
    }
    if path.starts_with("/spawn-second") {
        let app = app.clone();
        let spawn_time = Arc::clone(spawn_time);
        std::thread::spawn(move || {
            let t = Instant::now();
            *spawn_time.lock().unwrap_or_else(PoisonError::into_inner) = Some(t);
            let url_str = if cfg!(windows) { "http://probe.localhost/warm-page" } else { "probe://localhost/warm-page" };
            if let Ok(url) = url_str.parse() {
                let _ = WebviewWindowBuilder::new(&app, "probe-2", WebviewUrl::External(url))
                    .title("probe 2")
                    .inner_size(900.0, 600.0)
                    .visible(false)
                    .build();
            }
            println!("second_window_build_call: {:.1} ms", t.elapsed().as_secs_f64() * 1000.0);
        });
        return reply(builder, "text/plain", b"started".to_vec());
    }
    if path.starts_with("/log") {
        println!("{}", String::from_utf8_lossy(request.body()));
        return reply(builder, "text/plain", Vec::new());
    }
    if path.starts_with("/report") {
        std::process::exit(0);
    }
    let page = PAGE
        .replace("__WIDTH__", &frame.width.to_string())
        .replace("__HEIGHT__", &frame.height.to_string())
        .replace("__HAS_SHARED__", if cfg!(windows) { "true" } else { "false" });
    reply(builder, "text/html", page.into_bytes())
}

fn bench_bgra_to_rgba(width: usize, height: usize) {
    let bgra = vec![120u8; width * height * 4];
    let t1 = Instant::now();
    let cloned = bgra.to_vec();
    let mut out1 = vec![0u8; width * height * 4];
    for (out, line) in out1.chunks_exact_mut(width * 4).zip(cloned.chunks_exact(width * 4)) {
        for (pixel, &[blue, green, red, _]) in out.as_chunks_mut::<4>().0.iter_mut().zip(line.as_chunks::<4>().0) {
            *pixel = [red, green, blue, 255];
        }
    }
    let old_ms = t1.elapsed().as_secs_f64() * 1000.0;

    let t2 = Instant::now();
    let mut out2 = vec![0u8; width * height * 4];
    let (p_in, src_words, _) = unsafe { bgra.align_to::<u32>() };
    let (p_out, dst_words, _) = unsafe { out2.align_to_mut::<u32>() };
    assert!(p_in.is_empty() && p_out.is_empty());
    for (dst, &px) in dst_words.iter_mut().zip(src_words.iter()) {
        *dst = (px & 0x0000_ff00) | ((px & 0x00ff_0000) >> 16) | ((px & 0x0000_00ff) << 16) | 0xff00_0000;
    }
    let fast_ms = t2.elapsed().as_secs_f64() * 1000.0;
    assert_eq!(out1, out2);
    println!("bgra_to_rgba {width}x{height}: old_with_copy {old_ms:.2} ms  fast_u32_nocopy {fast_ms:.2} ms");
}

fn run_real_overlay(context: tauri::Context) {
    let _ = real_probe();
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_settings_file,
            screenshot_session,
            screenshot_frame,
            screenshot_targets,
            screenshot_overlay_ready,
            probe_log,
            probe_overlay_done
        ])
        .setup(|app| {
            let handle = app.handle().clone();
            WebviewWindowBuilder::new(app, "drag-grid", WebviewUrl::App("index.html?window=drag-grid".into()))
                .title("warm")
                .inner_size(400.0, 300.0)
                .visible(false)
                .build()?;
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(1200));
                let t0 = Instant::now();
                *real_probe().started.lock().unwrap_or_else(PoisonError::into_inner) = Some(t0);
                let _ = WebviewWindowBuilder::new(&handle, "screenshot-0", WebviewUrl::App("index.html?window=screenshot".into()))
                    .title("Fuyu")
                    .transparent(true)
                    .decorations(false)
                    .inner_size(1280.0, 720.0)
                    .visible(false)
                    .initialization_script(REAL_WATCH_JS)
                    .build();
                println!("real_overlay window_build_call: {:.1} ms", t0.elapsed().as_secs_f64() * 1000.0);
                std::thread::sleep(std::time::Duration::from_secs(5));
                eprintln!("real_overlay timed out");
                std::process::exit(1);
            });
            Ok(())
        })
        .run(context)
        .unwrap_or_else(|error| eprintln!("real overlay probe failed: {error}"));
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let context = tauri::generate_context!();
    if args.iter().any(|arg| arg == "--real-overlay") {
        run_real_overlay(context);
        return;
    }
    let frame = Arc::new(load(&args));
    bench_bgra_to_rgba(frame.width as usize, frame.height as usize);
    println!("frame {}x{} ({} bytes)", frame.width, frame.height, frame.rgba.len());
    let served = Arc::clone(&frame);
    let started_at = Instant::now();
    let spawn_time = Arc::new(Mutex::new(None::<Instant>));
    let spawn_req = Arc::clone(&spawn_time);
    tauri::Builder::default()
        .register_asynchronous_uri_scheme_protocol("probe", move |context, request, responder| {
            let app = context.app_handle().clone();
            let served = Arc::clone(&served);
            let spawn_req = Arc::clone(&spawn_req);
            if request.uri().path().starts_with("/async-raw") {
                tauri::async_runtime::spawn_blocking(move || responder.respond(respond(&app, &served, &request, started_at, &spawn_req)));
            } else {
                responder.respond(respond(&app, &served, &request, started_at, &spawn_req));
            }
        })
        .setup(move |app| {
            let url = if cfg!(windows) { "http://probe.localhost/" } else { "probe://localhost/" };
            let url = url.parse().map_err(|error| format!("{error}"))?;
            WebviewWindowBuilder::new(app, "probe", WebviewUrl::External(url))
                .title("frame probe")
                .inner_size(900.0, 600.0)
                .build()?;
            Ok(())
        })
        .run(context)
        .unwrap_or_else(|error| eprintln!("probe failed: {error}"));
}

const REAL_WATCH_JS: &str = r#"(() => {
  const t0 = performance.now();
  const rel = () => (performance.now() - t0).toFixed(1);
  let origInvoke = null;
  let canvasAt = 0;
  let moved = false;
  const log = (msg) => {
    const fn = origInvoke || window.__TAURI_INTERNALS__?.invoke;
    if (fn) void fn.call(window.__TAURI_INTERNALS__, "probe_log", { msg: `[${rel()}ms] ${msg}` });
  };
  const wrap = () => {
    const internals = window.__TAURI_INTERNALS__;
    if (!internals || internals.__probeWrapped) return false;
    origInvoke = internals.invoke;
    internals.__probeWrapped = true;
    internals.invoke = function(cmd, args, opts) {
      if (cmd !== "probe_log" && cmd !== "probe_overlay_done") {
        const start = rel();
        log(`invoke(${cmd}) start`);
        return origInvoke.call(this, cmd, args, opts).then((res) => {
          const extra = res && res.byteLength ? ` bytes=${res.byteLength}` : "";
          log(`invoke(${cmd}) done (started ${start}ms${extra})`);
          return res;
        });
      }
      return origInvoke.call(this, cmd, args, opts);
    };
    return true;
  };
  wrap();
  document.addEventListener("DOMContentLoaded", () => { wrap(); log("DOMContentLoaded"); });
  const check = () => {
    const overlay = document.querySelector(".screenshot-overlay");
    const canvas = document.querySelector(".screenshot-overlay__picture");
    if (canvas && canvas.width >= 1000 && !canvasAt) {
      canvasAt = performance.now() - t0;
      log(`canvas_drawn ${canvas.width}x${canvas.height}`);
    }
    if (overlay && canvasAt && !moved) {
      moved = true;
      log("dispatching pointermove");
      overlay.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: 200, clientY: 200, pointerId: 1, isPrimary: true }));
    }
    const mag = document.querySelector(".screenshot-magnifier");
    if (canvasAt && mag) {
      const magAt = performance.now() - t0;
      const fn = origInvoke || window.__TAURI_INTERNALS__?.invoke;
      if (fn) void fn.call(window.__TAURI_INTERNALS__, "probe_overlay_done", { canvasMs: canvasAt, magnifierMs: magAt });
      return true;
    }
    return false;
  };
  const obs = new MutationObserver(() => {
    if (check()) obs.disconnect();
  });
  if (document.documentElement) obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  const poll = setInterval(() => {
    if (check()) {
      clearInterval(poll);
      obs.disconnect();
    }
  }, 4);
})();"#;

const WARM_PAGE: &str = r#"<!doctype html><meta charset="utf-8"><script>
void fetch(location.origin + "/warm-ready");
</script>"#;

const PAGE: &str = r#"<!doctype html><meta charset="utf-8"><body style="font:13px monospace;background:#fff"><pre id="out">running…</pre><script>
const W = __WIDTH__, H = __HEIGHT__, HAS_SHARED = __HAS_SHARED__, ROUNDS = 6;
const base = location.origin + "/";
const out = document.getElementById("out");
const lines = [];
const log = (line) => {
  lines.push(line);
  out.textContent = lines.join("\n");
  void fetch(base + "log", { method: "POST", body: line });
};
const canvas = document.createElement("canvas");
canvas.width = W; canvas.height = H;
document.body.appendChild(canvas);
canvas.style.width = "300px";
const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: false });
const settle = () => new Promise((done) => {
  let left = 2;
  let timer = 0;
  const finish = () => { clearTimeout(timer); done(); };
  const tick = () => { if (--left <= 0) finish(); else requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  timer = setTimeout(finish, 1000);
});
const pixel = () => ctx.getImageData(0, 0, 1, 1).data[0];

function decodeQoi(bytes, width, height) {
  const out = new Uint8ClampedArray(width * height * 4);
  const index = new Uint8Array(256);
  let r = 0, g = 0, b = 0, a = 255, run = 0, p = 14;
  const end = bytes.length - 8, total = out.length;
  for (let i = 0; i < total; i += 4) {
    if (run > 0) { run -= 1; } else if (p < end) {
      const b1 = bytes[p++];
      if (b1 === 0xfe) { r = bytes[p++]; g = bytes[p++]; b = bytes[p++]; }
      else if (b1 === 0xff) { r = bytes[p++]; g = bytes[p++]; b = bytes[p++]; a = bytes[p++]; }
      else if ((b1 & 0xc0) === 0x00) { const idx = b1 << 2; r = index[idx]; g = index[idx + 1]; b = index[idx + 2]; a = index[idx + 3]; }
      else if ((b1 & 0xc0) === 0x40) { r = (r + ((b1 >> 4) & 3) - 2) & 0xff; g = (g + ((b1 >> 2) & 3) - 2) & 0xff; b = (b + (b1 & 3) - 2) & 0xff; }
      else if ((b1 & 0xc0) === 0x80) { const b2 = bytes[p++], vg = (b1 & 0x3f) - 32; r = (r + vg - 8 + ((b2 >> 4) & 0x0f)) & 0xff; g = (g + vg) & 0xff; b = (b + vg - 8 + (b2 & 0x0f)) & 0xff; }
      else { run = b1 & 0x3f; }
      const idx = ((r * 3 + g * 5 + b * 7 + a * 11) & 63) << 2;
      index[idx] = r; index[idx + 1] = g; index[idx + 2] = b; index[idx + 3] = a;
    }
    out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = a;
  }
  return out;
}

async function rawFrom(endpoint) {
  const a = performance.now();
  const response = await fetch(base + endpoint + "?" + Math.random());
  const buffer = await response.arrayBuffer();
  const b = performance.now();
  ctx.putImageData(new ImageData(new Uint8ClampedArray(buffer), W, H), 0, 0);
  pixel();
  const c = performance.now();
  await settle();
  return { fetch: b - a, draw: c - b, painted: performance.now() - a, rust: Number(response.headers.get("x-copy-ms")) };
}

async function rawBitmap() {
  const a = performance.now();
  const buffer = await (await fetch(base + "raw?" + Math.random())).arrayBuffer();
  const b = performance.now();
  const image = await createImageBitmap(new ImageData(new Uint8ClampedArray(buffer), W, H));
  ctx.drawImage(image, 0, 0);
  image.close();
  pixel();
  const c = performance.now();
  await settle();
  return { fetch: b - a, draw: c - b, painted: performance.now() - a };
}

async function parts(count) {
  const a = performance.now();
  const chunks = await Promise.all(Array.from({ length: count }, (_, index) => fetch(base + "part/" + index + "-" + count + "?" + Math.random()).then((r) => r.arrayBuffer())));
  const b = performance.now();
  const data = new Uint8ClampedArray(W * H * 4);
  let at = 0;
  for (const chunk of chunks) { data.set(new Uint8Array(chunk), at); at += chunk.byteLength; }
  ctx.putImageData(new ImageData(data, W, H), 0, 0);
  pixel();
  const c = performance.now();
  await settle();
  return { fetch: b - a, draw: c - b, painted: performance.now() - a };
}

async function encodedBitmap(endpoint) {
  const a = performance.now();
  const response = await fetch(base + endpoint + "?" + Math.random());
  const blob = await response.blob();
  const b = performance.now();
  const image = await createImageBitmap(blob);
  ctx.drawImage(image, 0, 0);
  image.close();
  pixel();
  const c = performance.now();
  await settle();
  const d = performance.now();
  ctx.getImageData(0, 0, W, H);
  return { fetch: b - a, draw: c - b, painted: d - a, readback: performance.now() - d, rust: Number(response.headers.get("x-encode-ms")), bytes: blob.size };
}

async function qoiPut() {
  const a = performance.now();
  const response = await fetch(base + "qoi?" + Math.random());
  const buf = await response.arrayBuffer();
  const b = performance.now();
  const rgba = decodeQoi(new Uint8Array(buf), W, H);
  const b2 = performance.now();
  ctx.putImageData(new ImageData(rgba, W, H), 0, 0);
  pixel();
  const c = performance.now();
  await settle();
  return { fetch: b - a, decode: b2 - b, draw: c - b2, painted: performance.now() - a, rust: Number(response.headers.get("x-encode-ms")), bytes: buf.byteLength };
}

async function sharedPut() {
  const a = performance.now();
  let meta = {};
  const buf = await new Promise((resolve) => {
    const onMsg = (e) => {
      window.chrome.webview.removeEventListener("sharedbufferreceived", onMsg);
      meta = e.additionalData || {};
      resolve(e.getBuffer());
    };
    window.chrome.webview.addEventListener("sharedbufferreceived", onMsg);
    void fetch(base + "shared?" + Math.random());
  });
  const b = performance.now();
  ctx.putImageData(new ImageData(new Uint8ClampedArray(buf), W, H), 0, 0);
  pixel();
  const c = performance.now();
  await settle();
  window.chrome.webview.releaseBuffer(buf);
  return { recv: b - a, draw: c - b, painted: performance.now() - a, rust: Number(meta.copyMs || 0) };
}

function summary(name, runs) {
  const keys = Object.keys(runs[0]);
  const median = (key) => { const sorted = runs.map((run) => run[key]).sort((x, y) => x - y); return sorted[Math.floor(sorted.length / 2)]; };
  log(name.padEnd(14) + keys.map((key) => key + " " + median(key).toFixed(1)).join("  "));
}

(async () => {
  try {
    await fetch(base + "startup");
    log("frame " + W + "x" + H + ", median of " + ROUNDS + " rounds (ms), " + navigator.userAgent);
    const cases = [
      ["raw+put", () => rawFrom("raw")],
      ["async+put", () => rawFrom("async-raw")],
      ["raw+bitmap", rawBitmap],
      ["parts4+put", () => parts(4)],
      ["bmp+bitmap", () => encodedBitmap("bmp")],
      ["qoi+put", qoiPut],
      ["png+bitmap", () => encodedBitmap("png")],
      ["webp+bitmap", () => encodedBitmap("webp")],
    ];
    if (HAS_SHARED && window.chrome?.webview?.addEventListener) {
      cases.unshift(["shared+put", sharedPut]);
    }
    for (const [name, run] of cases) {
      try {
        await run();
        const runs = [];
        for (let round = 0; round < ROUNDS; round += 1) runs.push(await run());
        summary(name, runs);
      } catch (err) {
        log(name.padEnd(14) + "ERROR " + String(err));
      }
    }
    await fetch(base + "spawn-second");
    await new Promise((r) => setTimeout(r, 1500));
  } finally {
    await fetch(base + "report", { method: "POST", body: lines.join("\n") });
  }
})();
</script>"#;
