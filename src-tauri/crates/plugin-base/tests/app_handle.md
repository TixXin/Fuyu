# `#[host_service]` refuses an `AppHandle`

A service that injects some other state compiles:

```rust
#[derive(Clone)]
struct Counter(u64);

#[plugin_base::host_service("doc.count", inject(counter))]
fn count(counter: Counter, by: u64) -> u64 {
    counter.0 + by
}

fn main() {
    assert_eq!(count(Counter(1), 2), 3);
}
```

The same service written with `inject(app)` does not, because a statically registered `AppHandle` links the tauri runtime into every Rust test binary and those binaries do not start on Windows (`0xc0000139`). Use `crate::home_dir::current()` instead, see `docs/architecture/plugins/v3-services.md`.

```rust,compile_fail
#[derive(Clone)]
struct AppHandle(u64);

#[plugin_base::host_service("doc.count", inject(app))]
fn count(app: AppHandle, by: u64) -> u64 {
    app.0 + by
}

fn main() {
    assert_eq!(count(AppHandle(1), 2), 3);
}
```

Calling the parameter something else does not help:

```rust,compile_fail
#[derive(Clone)]
struct AppHandle(u64);

#[plugin_base::host_service("doc.count", inject(handle))]
fn count(handle: AppHandle, by: u64) -> u64 {
    handle.0 + by
}

fn main() {
    assert_eq!(count(AppHandle(1), 2), 3);
}
```
