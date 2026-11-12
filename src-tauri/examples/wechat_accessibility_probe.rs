#[cfg(windows)]
#[path = "probes/wechat_accessibility.rs"]
mod probe;

#[cfg(windows)]
fn main() -> std::process::ExitCode {
    probe::main()
}

#[cfg(not(windows))]
fn main() {
    eprintln!("This probe only runs on Windows.");
}
