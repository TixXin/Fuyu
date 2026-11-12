#[cfg(windows)]
#[path = "probes/qq_notification.rs"]
mod probe;

#[cfg(windows)]
fn main() -> std::process::ExitCode {
    probe::main()
}

#[cfg(not(windows))]
fn main() {
    eprintln!("This probe only runs on Windows.");
}
