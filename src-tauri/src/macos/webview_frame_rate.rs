use objc2::{
    msg_send,
    rc::Retained,
    runtime::{AnyClass, AnyObject, NSObject},
    sel,
};
use objc2_foundation::{NSArray, NSString};
use tauri::{Runtime, Webview};

const NEAR_60FPS_FEATURE: &str = "PreferPageRenderingUpdatesNear60FPSEnabled";

pub(crate) fn follow_display_rate<R: Runtime>(webview: &Webview<R>, follow: bool) {
    let label = webview.label().to_string();
    let result = webview.with_webview(move |platform| {
        let view = platform.inner().cast::<AnyObject>();
        if let Err(error) = prefer_near_60fps(view, !follow) {
            eprintln!("webview frame rate for {label}: {error}");
        }
    });
    if let Err(error) = result {
        eprintln!("webview frame rate: {error}");
    }
}

fn prefer_near_60fps(view: *mut AnyObject, prefer: bool) -> Result<(), &'static str> {
    let view = unsafe { view.as_ref() }.ok_or("no WKWebView")?;
    let class = AnyClass::get(c"WKPreferences").ok_or("no WKPreferences")?;
    let listed: bool = unsafe { msg_send![class, respondsToSelector: sel!(_features)] };
    if !listed {
        return Err("WKPreferences has no feature list");
    }
    let configuration: Option<Retained<NSObject>> = unsafe { msg_send![view, configuration] };
    let configuration = configuration.ok_or("no configuration")?;
    let preferences: Option<Retained<NSObject>> = unsafe { msg_send![&*configuration, preferences] };
    let preferences = preferences.ok_or("no preferences")?;
    let settable: bool = unsafe { msg_send![&*preferences, respondsToSelector: sel!(_setEnabled:forFeature:)] };
    if !settable {
        return Err("cannot set features");
    }
    let features: Option<Retained<NSArray<NSObject>>> = unsafe { msg_send![class, _features] };
    let features = features.ok_or("no features")?;
    for feature in features.iter() {
        let key: Option<Retained<NSString>> = unsafe { msg_send![&*feature, key] };
        if key.is_some_and(|key| key.to_string() == NEAR_60FPS_FEATURE) {
            let _: () = unsafe { msg_send![&*preferences, _setEnabled: prefer, forFeature: &*feature] };
            return Ok(());
        }
    }
    Err("feature not found")
}
