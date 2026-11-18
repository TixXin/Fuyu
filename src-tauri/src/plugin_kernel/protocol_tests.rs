use plugin_base::{Event, HostState};
use serde_json::json;
use tauri::http::{Method, Request, Response, StatusCode};

use super::{client_paths, observe, registered, serve, Allowed, CSP};

fn get(root: Option<&std::path::Path>, allowed: &Allowed, path: &str, method: Method) -> Response<Vec<u8>> {
    let request = Request::builder().method(method).uri(format!("fuyu-plugin://localhost{path}")).body(Vec::new()).unwrap();
    serve(root, allowed, &request)
}

fn status(root: &std::path::Path, allowed: &Allowed, path: &str) -> StatusCode {
    get(Some(root), allowed, path, Method::GET).status()
}

fn scratch(name: &str) -> std::path::PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-plugin-protocol-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&dir);
    for folder in ["hello", "packages/@acme/clock/dist", "data/timer", "data/@acme/clock", "loose"] {
        std::fs::create_dir_all(dir.join(folder)).unwrap();
    }
    for (file, text) in [
        ("hello/island.js", "export default () => {};"),
        ("hello/style.css", "a{}"),
        ("hello/icon.svg", "<svg/>"),
        ("packages/@acme/clock/dist/island.js", "export default 1;"),
        ("packages/@acme/clock/package.json", "{}"),
        ("data/timer/timers.json", "[]"),
        ("data/@acme/clock/state.json", "{}"),
        ("plugins.yml", "- id: hello\n  name: ./hello/host.mjs\n"),
        ("plugins.yml.bak", "[]\n"),
        ("safe-mode.json", "{}"),
        ("bisect.json", "{}"),
        ("solo-island.js", "export default 2;"),
        ("other.js", "export default 3;"),
        ("loose/island.js", "export default 4;"),
    ] {
        std::fs::write(dir.join(file), text).unwrap();
    }
    dir
}

fn demo() -> Allowed {
    Allowed::from_paths(["hello/island.js", "packages/@acme/clock/dist/island.js", "solo-island.js"])
}

#[test]
fn registered_plugin_code_is_served_with_its_type_and_cors() {
    let dir = scratch("served");
    let allowed = demo();
    let ok = get(Some(&dir), &allowed, "/hello/island.js", Method::GET);
    assert_eq!(ok.status(), StatusCode::OK);
    assert_eq!(ok.headers()["content-type"], "text/javascript; charset=utf-8");
    assert_eq!(ok.headers()["access-control-allow-origin"], "*");
    assert_eq!(ok.body(), b"export default () => {};");
    assert_eq!(get(Some(&dir), &allowed, "/hello/style.css", Method::GET).headers()["content-type"], "text/css; charset=utf-8");
    assert_eq!(status(&dir, &allowed, "/hello/icon.svg"), StatusCode::OK, "the rest of a registered folder loads too");
    assert_eq!(status(&dir, &allowed, "/packages/@acme/clock/dist/island.js"), StatusCode::OK);
    assert_eq!(status(&dir, &allowed, "/packages/@acme/clock/package.json"), StatusCode::OK);
    assert_eq!(status(&dir, &Allowed::default(), "/packages/@acme/clock/dist/island.js"), StatusCode::OK, "installed packages need no registration");
    assert_eq!(status(&dir, &allowed, "/solo-island.js"), StatusCode::OK, "a single file at the top is served when it is the registered one");
    let head = get(Some(&dir), &allowed, "/hello/island.js", Method::HEAD);
    assert_eq!((head.status(), head.body().len()), (StatusCode::OK, 0));
    assert_eq!(get(None, &allowed, "/hello/island.js", Method::GET).status(), StatusCode::NOT_FOUND, "nothing is served while the host is off");
    assert_eq!(get(Some(&dir), &allowed, "/hello/island.js", Method::POST).status(), StatusCode::METHOD_NOT_ALLOWED);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn plugin_data_config_and_state_files_are_never_served() {
    let dir = scratch("private");
    let greedy = Allowed::from_paths(["data/timer/timers.json", "data/@acme/clock/state.json", "plugins.yml", "plugins.yml.bak", "safe-mode.json", "bisect.json", "Data/timer/timers.json", "PLUGINS.YML"]);
    for allowed in [demo(), greedy] {
        for path in [
            "/data/timer/timers.json",
            "/data/@acme/clock/state.json",
            "/Data/timer/timers.json",
            "/plugins.yml",
            "/plugins.yml.bak",
            "/PLUGINS.YML",
            "/safe-mode.json",
            "/bisect.json",
            "/other.js",
            "/loose/island.js",
            "/hello/missing.js",
            "/dev/hello/island.js",
            "/builtin/timer/island.js",
            "/__shared/missing.js",
            "/",
        ] {
            let response = get(Some(&dir), &allowed, path, Method::GET);
            assert_eq!(response.status(), StatusCode::NOT_FOUND, "{path}");
            assert_eq!(response.headers()["content-type"], "text/plain; charset=utf-8");
        }
    }
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn paths_that_climb_out_or_use_backslashes_are_refused() {
    let dir = scratch("climb");
    std::fs::write(dir.with_extension("secret"), "secret").unwrap();
    let allowed = demo();
    for path in ["/../secret", "/hello/..%2F..%2Fsecret", "/hello/..%2Fdata%2Ftimer%2Ftimers.json", "/hello\\island.js", "/hello%5Cisland.js", "/packages/..%2Fplugins.yml"] {
        assert_eq!(status(&dir, &allowed, path), StatusCode::NOT_FOUND, "{path}");
    }
    let _ = std::fs::remove_dir_all(&dir);
    let _ = std::fs::remove_file(dir.with_extension("secret"));
}

#[cfg(unix)]
#[test]
fn symlinks_are_checked_where_they_land() {
    let dir = scratch("links");
    let outside = dir.with_extension("outside");
    std::fs::create_dir_all(&outside).unwrap();
    std::fs::write(outside.join("island.js"), "outside").unwrap();
    std::os::unix::fs::symlink(&outside, dir.join("hello/out")).unwrap();
    std::os::unix::fs::symlink(dir.join("data/timer"), dir.join("hello/timer")).unwrap();
    std::os::unix::fs::symlink(dir.join("plugins.yml"), dir.join("packages/@acme/clock/config.yml")).unwrap();
    std::os::unix::fs::symlink(dir.join("hello/island.js"), dir.join("packages/@acme/clock/linked.js")).unwrap();
    let allowed = demo();
    assert_eq!(status(&dir, &allowed, "/hello/out/island.js"), StatusCode::NOT_FOUND, "a link out of the folder");
    assert_eq!(status(&dir, &allowed, "/hello/timer/timers.json"), StatusCode::NOT_FOUND, "a link into data/");
    assert_eq!(status(&dir, &allowed, "/packages/@acme/clock/config.yml"), StatusCode::NOT_FOUND, "a link to plugins.yml");
    assert_eq!(status(&dir, &allowed, "/packages/@acme/clock/linked.js"), StatusCode::OK, "a link to other registered code");
    let _ = std::fs::remove_dir_all(&dir);
    let _ = std::fs::remove_dir_all(&outside);
}

#[test]
fn the_shared_react_modules_come_from_the_app_itself() {
    let dir = std::env::temp_dir();
    let react = get(Some(&dir), &Allowed::default(), "/__shared/react.js", Method::GET);
    assert_eq!(react.status(), StatusCode::OK);
    assert!(String::from_utf8_lossy(react.body()).contains("__FUYU_SHARED__.react"));
    assert_eq!(get(Some(&dir), &Allowed::default(), "/__shared/react-jsx-runtime.js", Method::GET).status(), StatusCode::OK);
}

#[test]
fn registration_keeps_folders_and_single_files_but_not_reserved_names() {
    let allowed = client_paths(&json!({ "paths": ["hello/island.js", "hello/settings.js", "dev-tools/dist/a.js", "solo.js", "packages/@a/b/x.js", "dev/x/a.js", "builtin/timer/a.js", "__shared/react.js", "data/x/a.js", "DATA/x/a.js", "plugins.yml", "../up.js", "/abs.js", "", 3] }));
    assert_eq!(allowed, Allowed::from_paths(["hello/island.js", "dev-tools/dist/a.js", "solo.js"]));
    assert!(allowed.permits("hello/anything.png") && allowed.permits("dev-tools/src/b.js") && allowed.permits("solo.js"));
    assert!(!allowed.permits("hello") && !allowed.permits("solo-other.js") && !allowed.permits("data/x/a.js"));
    assert_eq!(client_paths(&json!({})), Allowed::default());
    assert_eq!(client_paths(&json!({ "paths": "hello/island.js" })), Allowed::default());
}

#[test]
fn the_host_hands_over_its_window_code_and_a_restart_forgets_it() {
    let clients = |paths: serde_json::Value| Event::Notification { method: "clients".into(), params: json!({ "paths": paths }) };
    observe(&Event::State(HostState::Starting { generation: 1 }));
    assert_eq!(registered(), Allowed::default());
    observe(&clients(json!(["hello/island.js"])));
    observe(&Event::State(HostState::Ready { generation: 1, pid: 9, ready: json!({}) }));
    observe(&Event::Notification { method: "log".into(), params: json!({ "paths": ["other/a.js"] }) });
    observe(&Event::Stderr("hello".into()));
    assert_eq!(registered(), Allowed::from_paths(["hello/island.js"]));
    observe(&clients(json!(["solo.js"])));
    assert_eq!(registered(), Allowed::from_paths(["solo.js"]), "each notification replaces the list");
    observe(&Event::State(HostState::Down { generation: 1, reason: "gone".into(), retry_in: std::time::Duration::from_millis(1) }));
    assert_eq!(registered(), Allowed::default());
    observe(&clients(json!(["hello/island.js"])));
    observe(&Event::State(HostState::Stopped));
    assert_eq!(registered(), Allowed::default());
}

#[test]
fn private_files_stay_closed_even_when_the_list_names_them() {
    let dir = scratch("untrusted");
    let names = |items: &[&str]| items.iter().map(|item| (*item).to_owned()).collect();
    let forged = Allowed { dirs: names(&["data", "Data", "hello"]), files: names(&["plugins.yml", "plugins.yml.bak", "safe-mode.json", "bisect.json"]) };
    for path in ["/data/timer/timers.json", "/Data/timer/timers.json", "/plugins.yml", "/plugins.yml.bak", "/safe-mode.json", "/bisect.json"] {
        assert_eq!(status(&dir, &forged, path), StatusCode::NOT_FOUND, "{path}");
    }
    assert_eq!(status(&dir, &forged, "/hello/island.js"), StatusCode::OK);
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn listed_paths_with_parent_steps_are_ignored() {
    let allowed = client_paths(&json!({ "paths": ["../outside/island.js", "hello/../../outside/island.js", "hello/../data/timer/timers.json", "./../plugins.yml", ".."] }));
    assert_eq!(allowed, Allowed::default());
}

#[test]
fn listed_absolute_paths_are_ignored() {
    let allowed = client_paths(&json!({ "paths": ["/etc/passwd", "/Users/someone/plugin/island.js", "\\\\server\\share\\island.js", "C:\\plugins\\island.js", "/"] }));
    assert_eq!(allowed, Allowed::default());
}

#[cfg(unix)]
#[test]
fn a_listed_folder_that_leads_out_of_the_data_folder_is_refused() {
    let dir = scratch("escape");
    let outside = dir.with_extension("escape-target");
    std::fs::create_dir_all(&outside).unwrap();
    std::fs::write(outside.join("island.js"), "outside").unwrap();
    std::os::unix::fs::symlink(&outside, dir.join("escape")).unwrap();
    std::os::unix::fs::symlink(dir.join("data"), dir.join("into-data")).unwrap();
    let allowed = Allowed::from_paths(["escape/island.js", "into-data/timer/timers.json"]);
    assert_eq!(status(&dir, &allowed, "/escape/island.js"), StatusCode::NOT_FOUND);
    assert_eq!(status(&dir, &allowed, "/into-data/timer/timers.json"), StatusCode::NOT_FOUND);
    let _ = std::fs::remove_dir_all(&dir);
    let _ = std::fs::remove_dir_all(&outside);
}

#[test]
fn before_the_host_sends_its_list_only_shared_modules_and_packages_load() {
    let dir = scratch("unlisted");
    let nothing = Allowed::default();
    assert_eq!(status(&dir, &nothing, "/__shared/react.js"), StatusCode::OK);
    assert_eq!(status(&dir, &nothing, "/packages/@acme/clock/dist/island.js"), StatusCode::OK);
    for path in ["/hello/island.js", "/solo-island.js", "/loose/island.js"] {
        assert_eq!(status(&dir, &nothing, path), StatusCode::NOT_FOUND, "{path}");
    }
    let _ = std::fs::remove_dir_all(&dir);
}

#[test]
fn every_plugin_protocol_response_sets_strict_csp_and_nosniff_headers() {
    let dir = scratch("csp");
    let allowed = demo();
    for (path, method) in [
        ("/hello/island.js", Method::GET),
        ("/__shared/react.js", Method::GET),
        ("/hello/missing.js", Method::GET),
        ("/hello/island.js", Method::POST),
    ] {
        let response = get(Some(&dir), &allowed, path, method.clone());
        let csp = response.headers()["content-security-policy"].to_str().unwrap();
        assert_eq!(csp, CSP, "{method} {path}");
        assert_eq!(response.headers()["x-content-type-options"], "nosniff", "{method} {path}");
        let directives: std::collections::BTreeMap<&str, Vec<&str>> = csp
            .split(';')
            .filter_map(|part| {
                let mut tokens = part.split_whitespace();
                Some((tokens.next()?, tokens.collect()))
            })
            .collect();
        assert_eq!(directives["default-src"], ["'none'"]);
        let scripts = &directives["script-src"];
        assert!(!scripts.contains(&"'unsafe-eval'"));
        assert!(!scripts.contains(&"'unsafe-inline'"));
        assert!(!scripts.iter().any(|source| source.starts_with("https:") || *source == "http:"));
        assert!(scripts.contains(&"'self'") && scripts.contains(&"fuyu-plugin:") && scripts.contains(&"http://fuyu-plugin.localhost"));
    }
    let _ = std::fs::remove_dir_all(&dir);
}
