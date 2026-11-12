#[cfg(windows)]
#[path = "../src/wechat_reminders/source.rs"]
mod wechat_reminder_source;

#[cfg(windows)]
#[path = "../src/win32/message_window.rs"]
#[allow(dead_code)]
mod win32_message_window;
#[cfg(windows)]
#[path = "../src/win32/process.rs"]
mod win32_process;
#[cfg(windows)]
#[path = "../src/win32/registry.rs"]
#[allow(dead_code)]
mod win32_registry;
#[cfg(windows)]
#[path = "../src/win32/shell_hook.rs"]
mod win32_shell_hook;
#[cfg(windows)]
#[path = "../src/win32/window.rs"]
#[allow(dead_code)]
mod win32_window;

#[cfg(windows)]
mod win32 {
    pub(crate) use super::win32_message_window as message_window;
    pub(crate) use super::win32_process as process;
    pub(crate) use super::win32_registry as registry;
    pub(crate) use super::win32_shell_hook as shell_hook;
    pub(crate) use super::win32_window as window;
}

#[cfg(windows)]
#[path = "probes/wechat_reminder.rs"]
mod probe;

#[cfg(windows)]
fn main() -> std::process::ExitCode {
    probe::main()
}

#[cfg(not(windows))]
fn main() {
    eprintln!("This probe only runs on Windows.");
}
