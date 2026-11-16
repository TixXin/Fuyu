use super::{expand, Args, NO_APP_HANDLE};

fn expanded(attr: &str, item: &str) -> Result<String, String> {
    let args: Args = syn::parse_str(attr).map_err(|error| error.to_string())?;
    let function: syn::ItemFn = syn::parse_str(item).map_err(|error| error.to_string())?;
    expand(args, function).map(|tokens| tokens.to_string()).map_err(|error| error.to_string())
}

fn refused(attr: &str, item: &str) -> String {
    match expanded(attr, item) {
        Ok(tokens) => panic!("{attr} on {item} must be refused, got {tokens}"),
        Err(error) => error,
    }
}

#[test]
fn inject_app_is_refused_and_the_error_names_the_replacement() {
    let error = refused(r#""cal.events", inject(app)"#, "fn events(app: AppHandle) {}");
    assert_eq!(error, NO_APP_HANDLE);
    assert!(error.contains("crate::home_dir::current()"), "{error}");
    assert!(error.contains("docs/architecture/plugins/v3-services.md"), "{error}");
    assert_eq!(refused(r#""cal.events", timeout_ms = 1000, inject(state, app)"#, "fn events(state: State, app: Handle) {}"), NO_APP_HANDLE);
}

#[test]
fn an_app_handle_parameter_is_refused_whatever_it_is_called() {
    assert_eq!(refused(r#""cal.events", inject(handle)"#, "fn events(handle: tauri::AppHandle) {}"), NO_APP_HANDLE);
    assert_eq!(refused(r#""cal.events""#, "fn events(handle: AppHandle<Wry>, refresh: bool) {}"), NO_APP_HANDLE);
    assert_eq!(refused(r#""cal.events""#, "async fn events(handle: &AppHandle) {}"), NO_APP_HANDLE);
}

#[test]
fn injecting_other_state_still_works() {
    let tokens = expanded(r#""test.count", inject(counter)"#, "fn count(counter: Counter, by: u64) -> u64 { by }").unwrap_or_else(|error| panic!("{error}"));
    assert!(tokens.contains("state :: < Counter >"), "{tokens}");
}
