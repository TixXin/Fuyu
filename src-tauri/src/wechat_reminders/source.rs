use crate::win32::{
    message_window::{self, WindowMessages},
    process, registry, shell_hook, window,
};
use std::{
    cell::RefCell,
    path::PathBuf,
    sync::atomic::{AtomicUsize, Ordering},
};
use windows::Win32::{
    Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, WPARAM},
    System::Registry::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE},
    UI::WindowsAndMessaging::{HSHELL_REDRAW, HSHELL_WINDOWACTIVATED, HSHELL_WINDOWCREATED},
};

const CLASS_PREFIX: &str = "FuyuShellReminderSource";
const HSHELL_FLASH: u32 = HSHELL_REDRAW | 0x8000;
const HSHELL_RUDEAPPACTIVATED: u32 = HSHELL_WINDOWACTIVATED | 0x8000;

static NEXT_CLASS_ID: AtomicUsize = AtomicUsize::new(1);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ReminderSignal {
    Attention,
    Activated,
    ActivatedElsewhere,
    Redraw,
    WindowCreated,
}

#[derive(Clone, Copy, Default)]
#[allow(dead_code)]
pub struct SourceStats {
    pub shell_events: u64,
    pub metadata_errors: u64,
}

#[derive(Clone, Debug, PartialEq, Eq)]
#[allow(dead_code)]
pub enum ShellMatcher {
    ExactPath(String),
    FileNames(Vec<String>),
}

#[allow(dead_code)]
impl ShellMatcher {
    pub fn exact_path(path: &str) -> Self {
        Self::ExactPath(normalized_path(path))
    }

    pub fn file_names(names: &[&str]) -> Self {
        Self::FileNames(
            names
                .iter()
                .map(|name| name.trim())
                .filter(|name| !name.is_empty())
                .map(ToOwned::to_owned)
                .collect(),
        )
    }

    pub fn matches_path(&self, raw_path: &str) -> bool {
        match self {
            Self::ExactPath(expected) => normalized_path(raw_path) == *expected,
            Self::FileNames(names) => extract_file_name(raw_path).is_some_and(|actual| {
                names
                    .iter()
                    .any(|expected| actual.eq_ignore_ascii_case(expected))
            }),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum TargetWindow {
    Invalid,
    Unreadable,
    Path(String),
}

#[allow(dead_code)]
pub fn route_window_signal(
    signal: ReminderSignal,
    target: &TargetWindow,
    foreground_path: Option<&str>,
    matcher: &ShellMatcher,
) -> Option<ReminderSignal> {
    match target {
        TargetWindow::Unreadable => None,
        TargetWindow::Invalid => {
            (signal == ReminderSignal::Activated).then_some(ReminderSignal::ActivatedElsewhere)
        }
        TargetWindow::Path(path) => {
            if matcher.matches_path(path) {
                if signal == ReminderSignal::Attention
                    && foreground_path.is_some_and(|fg| matcher.matches_path(fg))
                {
                    None
                } else {
                    Some(signal)
                }
            } else if signal == ReminderSignal::Activated {
                Some(ReminderSignal::ActivatedElsewhere)
            } else {
                None
            }
        }
    }
}

#[allow(dead_code)]
pub fn route_multi_signals<'a, I>(
    signal: ReminderSignal,
    target: &TargetWindow,
    foreground_path: Option<&str>,
    matchers: I,
) -> Vec<(usize, ReminderSignal)>
where
    I: IntoIterator<Item = (usize, &'a ShellMatcher)>,
{
    let mut out = Vec::new();
    for (id, matcher) in matchers {
        if let Some(routed) = route_window_signal(signal, target, foreground_path, matcher) {
            out.push((id, routed));
        }
    }
    out
}

type RawCallback = Box<dyn FnMut(ReminderSignal, TargetWindow, Option<String>)>;

struct ListenerContext {
    message: u32,
    callback: RawCallback,
    stats: SourceStats,
}

thread_local! {
    static CONTEXT: RefCell<Option<ListenerContext>> = const { RefCell::new(None) };
}

const EXECUTABLES: [(&str, &str); 2] = [("Weixin", "Weixin.exe"), ("WeChat", "WeChat.exe")];

pub fn installed_executable() -> Result<PathBuf, String> {
    let existing = |path: PathBuf, name: &str| {
        let named = path
            .file_name()
            .is_some_and(|file| file.to_string_lossy().eq_ignore_ascii_case(name));
        (path.is_absolute() && named && path.is_file()).then_some(path)
    };
    for root in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
        for (product, name) in EXECUTABLES {
            for key in [
                format!("Software\\Tencent\\{product}"),
                format!("Software\\WOW6432Node\\Tencent\\{product}"),
            ] {
                if let Some(path) =
                    registry::read_string(root, &key, "InstallPath").and_then(|folder| {
                        existing(PathBuf::from(folder.trim_matches('"')).join(name), name)
                    })
                {
                    return Ok(path);
                }
            }
            for key in [
                format!("Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{product}"),
                format!("Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{product}"),
            ] {
                let from_icon = registry::read_string(root, &key, "DisplayIcon")
                    .and_then(|icon| existing(PathBuf::from(registry::display_icon_path(&icon)), name));
                let from_folder = || {
                    registry::read_string(root, &key, "InstallLocation")
                        .and_then(|folder| existing(PathBuf::from(folder.trim_matches('"')).join(name), name))
                };
                if let Some(path) = from_icon.or_else(from_folder) {
                    return Ok(path);
                }
            }
        }
    }
    let names = EXECUTABLES.map(|(_, name)| name);
    process::running_executable(&names)
        .map(PathBuf::from)
        .ok_or_else(|| "未找到微信安装路径。打开微信后会自动连接。".into())
}

pub fn normalized_path(path: &str) -> String {
    path.trim_start_matches(r"\\?\")
        .replace('/', "\\")
        .to_lowercase()
}

fn extract_file_name(path: &str) -> Option<&str> {
    path.rsplit(['\\', '/'])
        .next()
        .filter(|name| !name.is_empty())
}

fn inspect_window(handle: HWND) -> TargetWindow {
    if handle.is_invalid() {
        return TargetWindow::Invalid;
    }
    match process::image_path(process::window_process_id(handle)) {
        Some(path) => TargetWindow::Path(path),
        None => TargetWindow::Unreadable,
    }
}

fn foreground_image_path() -> Option<String> {
    let fg = window::foreground_window();
    if fg.is_invalid() {
        return None;
    }
    process::image_path(process::window_process_id(fg))
}

struct ReminderWindow;

impl WindowMessages for ReminderWindow {
    fn handle(_: HWND, message: u32, kind: WPARAM, target: LPARAM) -> Option<LRESULT> {
        CONTEXT.with(|slot| {
            let Ok(mut context) = slot.try_borrow_mut() else {
                return;
            };
            let Some(context) = context.as_mut() else {
                return;
            };
            if message != context.message {
                return;
            }
            context.stats.shell_events += 1;
            let signal = match kind.0 as u32 {
                HSHELL_FLASH => ReminderSignal::Attention,
                HSHELL_WINDOWACTIVATED | HSHELL_RUDEAPPACTIVATED => ReminderSignal::Activated,
                HSHELL_REDRAW => ReminderSignal::Redraw,
                HSHELL_WINDOWCREATED => ReminderSignal::WindowCreated,
                _ => return,
            };
            let inspected = inspect_window(HWND(target.0 as *mut _));
            if inspected == TargetWindow::Unreadable {
                context.stats.metadata_errors += 1;
            }
            let foreground = (signal == ReminderSignal::Attention)
                .then(foreground_image_path)
                .flatten();
            (context.callback)(signal, inspected, foreground);
        });
        None
    }
}

pub struct ReminderListener {
    window: HWND,
    instance: HINSTANCE,
    class_name: String,
}

impl ReminderListener {
    #[allow(dead_code)]
    pub fn new(
        executable: PathBuf,
        callback: impl FnMut(ReminderSignal) + 'static,
    ) -> Result<Self, String> {
        let executable = executable
            .canonicalize()
            .map_err(|error| format!("无法确认微信安装路径：{error}"))?;
        let matcher = ShellMatcher::exact_path(&executable.to_string_lossy());
        Self::for_matcher(matcher, callback)
    }

    #[allow(dead_code)]
    pub fn for_executables(
        names: &[&str],
        callback: impl FnMut(ReminderSignal) + 'static,
    ) -> Result<Self, String> {
        Self::for_matcher(ShellMatcher::file_names(names), callback)
    }

    #[allow(dead_code)]
    pub fn for_matcher(
        matcher: ShellMatcher,
        mut callback: impl FnMut(ReminderSignal) + 'static,
    ) -> Result<Self, String> {
        Self::raw(move |signal, target, foreground| {
            if let Some(routed) =
                route_window_signal(signal, &target, foreground.as_deref(), &matcher)
            {
                callback(routed);
            }
        })
    }

    #[allow(dead_code)]
    pub fn raw(
        callback: impl FnMut(ReminderSignal, TargetWindow, Option<String>) + 'static,
    ) -> Result<Self, String> {
        if CONTEXT.with(|slot| slot.borrow().is_some()) {
            return Err("任务栏提醒监听器已在此线程运行。".into());
        }
        let message =
            shell_hook::hook_message().map_err(|error| format!("无法注册任务栏提醒事件：{error}"))?;
        let instance = message_window::module_instance().map_err(|error| error.to_string())?;
        let class_name = format!(
            "{CLASS_PREFIX}-{}",
            NEXT_CLASS_ID.fetch_add(1, Ordering::Relaxed)
        );
        message_window::register_class::<ReminderWindow>(instance, &class_name)
            .map_err(|error| error.to_string())?;
        let window = match message_window::create_tool_popup_window(instance, &class_name, "") {
            Ok(window) => window,
            Err(error) => {
                let _ = message_window::unregister_class(instance, &class_name);
                return Err(format!("无法创建任务栏提醒接收器：{error}"));
            }
        };
        CONTEXT.with(|slot| {
            *slot.borrow_mut() = Some(ListenerContext {
                message,
                callback: Box::new(callback),
                stats: SourceStats::default(),
            })
        });
        let listener = Self {
            window,
            instance,
            class_name,
        };
        shell_hook::register_window(window)
            .map_err(|error| format!("无法监听任务栏提醒：{error}"))?;
        Ok(listener)
    }

    #[allow(dead_code)]
    pub fn hwnd(&self) -> HWND {
        self.window
    }

    #[allow(dead_code)]
    pub fn poll(&self) {
        message_window::dispatch_pending_messages();
    }

    #[allow(dead_code)]
    pub fn stats(&self) -> SourceStats {
        CONTEXT.with(|slot| {
            slot.borrow()
                .as_ref()
                .map(|context| context.stats)
                .unwrap_or_default()
        })
    }
}

impl Drop for ReminderListener {
    fn drop(&mut self) {
        let _ = shell_hook::deregister_window(self.window);
        let _ = message_window::destroy_window(self.window);
        let _ = message_window::unregister_class(self.instance, &self.class_name);
        CONTEXT.with(|slot| *slot.borrow_mut() = None);
    }
}
