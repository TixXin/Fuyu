use std::{
    path::Path,
    ptr::NonNull,
    sync::{mpsc, Mutex, OnceLock, PoisonError},
    time::Duration,
};

use block2::{Block, RcBlock};
use objc2::{
    define_class, msg_send,
    rc::Retained,
    runtime::{AnyClass, AnyObject, Bool},
    AllocAnyThread,
};
use objc2_foundation::{NSObject, NSObjectProtocol, NSString};

#[link(name = "UserNotifications", kind = "framework")]
extern "C" {}

const AUTH_SOUND: usize = 1 << 1;
const AUTH_ALERT: usize = 1 << 2;
const PRESENT_SOUND: usize = 1 << 1;
const PRESENT_BANNER: usize = 1 << 4;
const STATUS_NOT_DETERMINED: isize = 0;
const STATUS_AUTHORIZED: isize = 2;
const STATUS_PROVISIONAL: isize = 3;
const AUTH_WAIT: Duration = Duration::from_secs(15);
const SEND_WAIT: Duration = Duration::from_secs(5);

type OpenCallback = Box<dyn Fn(String) + Send + Sync>;

static ON_OPEN: Mutex<Option<OpenCallback>> = Mutex::new(None);
static DELEGATE: OnceLock<DelegateSlot> = OnceLock::new();

struct DelegateSlot(Retained<NotificationDelegate>);

unsafe impl Send for DelegateSlot {}
unsafe impl Sync for DelegateSlot {}

define_class!(
    #[unsafe(super(NSObject))]
    #[name = "FuyuAgentNotificationDelegate"]
    struct NotificationDelegate;

    unsafe impl NSObjectProtocol for NotificationDelegate {}

    impl NotificationDelegate {
        #[unsafe(method(userNotificationCenter:willPresentNotification:withCompletionHandler:))]
        fn will_present(
            &self,
            _center: &AnyObject,
            _notification: &AnyObject,
            completion_handler: &Block<dyn Fn(usize)>,
        ) {
            completion_handler.call((PRESENT_BANNER | PRESENT_SOUND,));
        }

        #[unsafe(method(userNotificationCenter:didReceiveNotificationResponse:withCompletionHandler:))]
        fn did_receive_response(
            &self,
            _center: &AnyObject,
            response: &AnyObject,
            completion_handler: &Block<dyn Fn()>,
        ) {
            let tag = response_identifier(response);
            if let Some(tag) = tag {
                let guard = ON_OPEN.lock().unwrap_or_else(PoisonError::into_inner);
                if let Some(callback) = guard.as_ref() {
                    callback(tag);
                }
            }
            completion_handler.call(());
        }
    }
);

impl NotificationDelegate {
    fn new() -> Retained<Self> {
        unsafe { msg_send![Self::alloc(), init] }
    }
}

fn response_identifier(response: &AnyObject) -> Option<String> {
    let notification: Option<Retained<AnyObject>> = unsafe { msg_send![response, notification] };
    let request: Option<Retained<AnyObject>> = unsafe { msg_send![&*notification?, request] };
    let identifier: Option<Retained<NSString>> = unsafe { msg_send![&*request?, identifier] };
    identifier.map(|value| value.to_string()).filter(|value| !value.is_empty())
}

pub(crate) fn is_app_bundle_path(path: &Path) -> bool {
    let mut saw_macos = false;
    let mut saw_contents = false;
    for component in path.components().rev() {
        let name = component.as_os_str().to_string_lossy();
        if !saw_macos {
            if name == "MacOS" {
                saw_macos = true;
            }
            continue;
        }
        if !saw_contents {
            if name == "Contents" {
                saw_contents = true;
                continue;
            }
            return false;
        }
        return name.ends_with(".app");
    }
    false
}

fn in_app_bundle() -> bool {
    let exe_in_bundle = std::env::current_exe().ok().is_some_and(|path| is_app_bundle_path(&path));
    if !exe_in_bundle {
        return false;
    }
    let Some(bundle_cls) = AnyClass::get(c"NSBundle") else {
        return false;
    };
    let bundle: Option<Retained<AnyObject>> = unsafe { msg_send![bundle_cls, mainBundle] };
    let Some(bundle) = bundle else {
        return false;
    };
    let identifier: Option<Retained<NSString>> = unsafe { msg_send![&*bundle, bundleIdentifier] };
    identifier.is_some_and(|id| !id.to_string().is_empty())
}

fn current_center() -> Option<Retained<AnyObject>> {
    if !in_app_bundle() {
        return None;
    }
    let cls = AnyClass::get(c"UNUserNotificationCenter")?;
    unsafe { msg_send![cls, currentNotificationCenter] }
}

fn attach_delegate(center: &AnyObject) {
    let slot = DELEGATE.get_or_init(|| DelegateSlot(NotificationDelegate::new()));
    let delegate: &NotificationDelegate = &slot.0;
    unsafe {
        let _: () = msg_send![center, setDelegate: delegate];
    }
}

pub(crate) fn install_delegate(on_open: impl Fn(String) + Send + Sync + 'static) {
    *ON_OPEN.lock().unwrap_or_else(PoisonError::into_inner) = Some(Box::new(on_open));
    if let Some(center) = current_center() {
        attach_delegate(&center);
    }
}

fn authorization_status(center: &AnyObject) -> Option<isize> {
    let (sender, receiver) = mpsc::channel();
    let handler = RcBlock::new(move |settings: *mut AnyObject| {
        let status = NonNull::new(settings).map(|ptr| unsafe {
            let status: isize = msg_send![ptr.as_ptr(), authorizationStatus];
            status
        });
        let _ = sender.send(status);
    });
    unsafe {
        let _: () = msg_send![center, getNotificationSettingsWithCompletionHandler: &*handler];
    }
    receiver.recv_timeout(SEND_WAIT).ok().flatten()
}

fn request_authorization(center: &AnyObject) -> bool {
    let (sender, receiver) = mpsc::channel();
    let handler = RcBlock::new(move |granted: Bool, _error: *mut AnyObject| {
        let _ = sender.send(granted.as_bool());
    });
    unsafe {
        let _: () = msg_send![
            center,
            requestAuthorizationWithOptions: AUTH_ALERT | AUTH_SOUND,
            completionHandler: &*handler
        ];
    }
    receiver.recv_timeout(AUTH_WAIT).unwrap_or(false)
}

fn ensure_authorized(center: &AnyObject) -> bool {
    match authorization_status(center) {
        Some(STATUS_AUTHORIZED | STATUS_PROVISIONAL) => true,
        Some(STATUS_NOT_DETERMINED) => request_authorization(center),
        _ => false,
    }
}

pub(crate) fn notify(tag: &str, title: &str, body: &str, on_open: impl Fn(String) + Send + Sync + 'static) -> bool {
    *ON_OPEN.lock().unwrap_or_else(PoisonError::into_inner) = Some(Box::new(on_open));
    let Some(center) = current_center() else {
        return false;
    };
    attach_delegate(&center);
    if !ensure_authorized(&center) {
        return false;
    }
    let Some(content_cls) = AnyClass::get(c"UNMutableNotificationContent") else {
        return false;
    };
    let Some(request_cls) = AnyClass::get(c"UNNotificationRequest") else {
        return false;
    };
    let content: Option<Retained<AnyObject>> = unsafe { msg_send![content_cls, new] };
    let Some(content) = content else {
        return false;
    };
    let ns_title = NSString::from_str(title);
    let ns_body = NSString::from_str(body);
    let ns_tag = NSString::from_str(tag);
    unsafe {
        let _: () = msg_send![&*content, setTitle: &*ns_title];
        let _: () = msg_send![&*content, setBody: &*ns_body];
        if let Some(sound_cls) = AnyClass::get(c"UNNotificationSound") {
            let sound: Option<Retained<AnyObject>> = msg_send![sound_cls, defaultSound];
            if let Some(sound) = sound {
                let _: () = msg_send![&*content, setSound: &*sound];
            }
        }
    }
    let null_trigger: *const AnyObject = std::ptr::null();
    let request: Option<Retained<AnyObject>> = unsafe {
        msg_send![
            request_cls,
            requestWithIdentifier: &*ns_tag,
            content: &*content,
            trigger: null_trigger
        ]
    };
    let Some(request) = request else {
        return false;
    };
    let (sender, receiver) = mpsc::channel();
    let handler = RcBlock::new(move |error: *mut AnyObject| {
        let _ = sender.send(error.is_null());
    });
    unsafe {
        let _: () = msg_send![&*center, addNotificationRequest: &*request, withCompletionHandler: &*handler];
    }
    receiver.recv_timeout(SEND_WAIT).unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::{is_app_bundle_path, notify};
    use std::path::Path;

    #[test]
    fn recognizes_executables_inside_an_app_bundle() {
        assert!(is_app_bundle_path(Path::new("/Applications/Fuyu.app/Contents/MacOS/fuyu")));
        assert!(is_app_bundle_path(Path::new("/Users/me/Fuyu.app/Contents/MacOS/fuyu")));
        assert!(!is_app_bundle_path(Path::new("/Users/me/Fuyu/src-tauri/target/debug/fuyu")));
        assert!(!is_app_bundle_path(Path::new("/tmp/Contents/MacOS/fuyu")));
        assert!(!is_app_bundle_path(Path::new("/Applications/Fuyu.app/fuyu")));
    }

    #[test]
    fn returns_false_without_crashing_outside_an_app_bundle() {
        assert!(!notify("claude:1", "Claude", "Waiting", |_| {}));
    }
}
