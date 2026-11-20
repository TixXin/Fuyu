use std::{
    borrow::Cow,
    io::Cursor,
    sync::{Arc, Mutex, PoisonError},
    time::Instant,
};

use image::{
    codecs::png::{CompressionType, FilterType, PngEncoder},
    ExtendedColorType, ImageEncoder,
};
use tauri::{
    http::{Request, Response},
    WebviewUrl, WebviewWindowBuilder,
};

const DEFAULT_SIZE: (u32, u32) = (3072, 1728);

struct Frame {
    width: u32,
    height: u32,
    rgba: Vec<u8>,
    png: Mutex<Option<(Vec<u8>, f64)>>,
}

fn load(path: Option<String>) -> Frame {
    let picture = path.and_then(|path| image::open(&path).map_err(|error| eprintln!("could not open {path}: {error}")).ok());
    let (width, height, rgba) = match picture {
        Some(picture) => {
            let rgba = picture.to_rgba8();
            (rgba.width(), rgba.height(), rgba.into_raw())
        }
        None => {
            let (width, height) = DEFAULT_SIZE;
            let mut rgba = Vec::with_capacity(width as usize * height as usize * 4);
            for y in 0..height {
                for x in 0..width {
                    let noise = (x.wrapping_mul(2_654_435_761) ^ y.wrapping_mul(40_503)) as u8;
                    rgba.extend_from_slice(&[(x / 12) as u8, (y / 7) as u8, noise & 0x1f, 255]);
                }
            }
            (width, height, rgba)
        }
    };
    Frame { width, height, rgba, png: Mutex::new(None) }
}

fn png(frame: &Frame) -> (Vec<u8>, f64) {
    let mut cached = frame.png.lock().unwrap_or_else(PoisonError::into_inner);
    if let Some(done) = cached.as_ref() {
        return done.clone();
    }
    let started = Instant::now();
    let mut bytes = Vec::new();
    let encoder = PngEncoder::new_with_quality(Cursor::new(&mut bytes), CompressionType::Fast, FilterType::Adaptive);
    if let Err(error) = encoder.write_image(&frame.rgba, frame.width, frame.height, ExtendedColorType::Rgba8) {
        eprintln!("png failed: {error}");
    }
    let done = (bytes, started.elapsed().as_secs_f64() * 1000.0);
    *cached = Some(done.clone());
    done
}

fn respond(frame: &Frame, request: &Request<Vec<u8>>) -> Response<Cow<'static, [u8]>> {
    let path = request.uri().path().to_string();
    let builder = Response::builder().header("Access-Control-Allow-Origin", "*").header("Access-Control-Expose-Headers", "*");
    let reply = |builder: tauri::http::response::Builder, kind: &str, body: Vec<u8>| {
        builder.header("Content-Type", kind).body(Cow::Owned(body)).unwrap_or_else(|_| Response::new(Cow::Borrowed(&[][..])))
    };
    if path.starts_with("/raw") {
        let started = Instant::now();
        let body = frame.rgba.clone();
        let copy = started.elapsed().as_secs_f64() * 1000.0;
        return reply(builder.header("x-copy-ms", format!("{copy:.1}")), "application/octet-stream", body);
    }
    if path.starts_with("/part/") {
        let parts: Vec<usize> = path.trim_start_matches("/part/").split('-').filter_map(|part| part.parse().ok()).collect();
        let (index, count) = (parts.first().copied().unwrap_or(0), parts.get(1).copied().unwrap_or(1).max(1));
        let size = frame.rgba.len().div_ceil(count);
        let start = (index * size).min(frame.rgba.len());
        let end = (start + size).min(frame.rgba.len());
        return reply(builder, "application/octet-stream", frame.rgba[start..end].to_vec());
    }
    if path.starts_with("/report") {
        println!("{}", String::from_utf8_lossy(request.body()));
        std::process::exit(0);
    }
    if path.starts_with("/png") {
        let (bytes, encode) = png(frame);
        return reply(builder.header("x-encode-ms", format!("{encode:.1}")), "image/png", bytes);
    }
    let page = PAGE.replace("__WIDTH__", &frame.width.to_string()).replace("__HEIGHT__", &frame.height.to_string());
    reply(builder, "text/html", page.into_bytes())
}

fn main() {
    let frame = Arc::new(load(std::env::args().nth(1)));
    println!("frame {}x{} ({} bytes)", frame.width, frame.height, frame.rgba.len());
    let served = Arc::clone(&frame);
    tauri::Builder::default()
        .register_uri_scheme_protocol("probe", move |_, request| respond(&served, &request))
        .setup(|app| {
            let url = if cfg!(windows) { "http://probe.localhost/" } else { "probe://localhost/" };
            let url = url.parse().map_err(|error| format!("{error}"))?;
            WebviewWindowBuilder::new(app, "probe", WebviewUrl::External(url)).title("frame probe").inner_size(900.0, 600.0).build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .unwrap_or_else(|error| eprintln!("probe failed: {error}"));
}

const PAGE: &str = r#"<!doctype html><meta charset="utf-8"><body style="font:13px monospace;background:#fff"><pre id="out">running…</pre><script>
const W = __WIDTH__, H = __HEIGHT__, ROUNDS = 6;
const base = location.origin + "/";
const out = document.getElementById("out");
const lines = [];
const log = (line) => { lines.push(line); out.textContent = lines.join("\n"); };
const canvas = document.createElement("canvas");
canvas.width = W; canvas.height = H;
document.body.appendChild(canvas);
canvas.style.width = "300px";
const ctx = canvas.getContext("2d", { willReadFrequently: false });
const settle = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
const pixel = () => ctx.getImageData(0, 0, 1, 1).data[0];
async function raw() {
  const a = performance.now();
  const response = await fetch(base + "raw?" + Math.random());
  const buffer = await response.arrayBuffer();
  const b = performance.now();
  ctx.putImageData(new ImageData(new Uint8ClampedArray(buffer), W, H), 0, 0);
  pixel();
  const c = performance.now();
  await settle();
  return { fetch: b - a, draw: c - b, painted: performance.now() - a, rust: Number(response.headers.get("x-copy-ms")) };
}
async function bitmap() {
  const a = performance.now();
  const buffer = await (await fetch(base + "raw?" + Math.random())).arrayBuffer();
  const b = performance.now();
  const image = await createImageBitmap(new ImageData(new Uint8ClampedArray(buffer), W, H));
  ctx.drawImage(image, 0, 0);
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
async function png() {
  const a = performance.now();
  const response = await fetch(base + "png?" + Math.random());
  const blob = await response.blob();
  const b = performance.now();
  const image = await createImageBitmap(blob);
  ctx.drawImage(image, 0, 0);
  pixel();
  const c = performance.now();
  await settle();
  const d = performance.now();
  ctx.getImageData(0, 0, W, H);
  return { fetch: b - a, draw: c - b, painted: d - a, readback: performance.now() - d, rust: Number(response.headers.get("x-encode-ms")), bytes: blob.size };
}
function summary(name, runs) {
  const keys = Object.keys(runs[0]);
  const median = (key) => { const sorted = runs.map((run) => run[key]).sort((x, y) => x - y); return sorted[Math.floor(sorted.length / 2)]; };
  log(name.padEnd(14) + keys.map((key) => key + " " + median(key).toFixed(1)).join("  "));
}
(async () => {
  log("frame " + W + "x" + H + ", median of " + ROUNDS + " rounds (ms), " + navigator.userAgent);
  const cases = [["raw+put", raw], ["raw+bitmap", bitmap], ["parts4+put", () => parts(4)], ["png+bitmap", png]];
  for (const [name, run] of cases) {
    await run();
    const runs = [];
    for (let round = 0; round < ROUNDS; round += 1) runs.push(await run());
    summary(name, runs);
  }
  await fetch(base + "report", { method: "POST", body: lines.join("\n") });
})();
</script>"#;
