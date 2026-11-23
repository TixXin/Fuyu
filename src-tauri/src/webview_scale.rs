use tauri::{Runtime, Webview, Window};

use crate::win32::webview_scale;

fn usable(scale: f64) -> bool {
    scale.is_finite() && scale > 0.0
}

fn apply<R: Runtime>(webview: &Webview<R>, scale: f64) {
    if !usable(scale) {
        return;
    }
    let label = webview.label().to_string();
    let result = webview.with_webview(move |platform| {
        if let Err(error) = webview_scale::pin(&platform.controller(), scale) {
            eprintln!("webview scale for {label}: {error}");
        }
    });
    if let Err(error) = result {
        eprintln!("webview scale: {error}");
    }
}

pub(crate) fn attach<R: Runtime>(webview: &Webview<R>) {
    match webview.window().scale_factor() {
        Ok(scale) => apply(webview, scale),
        Err(error) => eprintln!("webview scale for {}: {error}", webview.label()),
    }
}

pub(crate) fn follow<R: Runtime>(window: &Window<R>, scale: f64) {
    for webview in window.webviews() {
        apply(&webview, scale);
    }
}

#[cfg(test)]
mod tests {
    use super::usable;

    #[test]
    fn only_a_real_scale_is_applied() {
        assert!(usable(1.0));
        assert!(usable(1.5));
        assert!(!usable(0.0));
        assert!(!usable(-1.0));
        assert!(!usable(f64::NAN));
        assert!(!usable(f64::INFINITY));
    }
}
