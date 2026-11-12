pub(crate) const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(windows)]
pub(crate) use std::os::windows::process::CommandExt;

#[cfg(not(windows))]
pub(crate) trait CommandExt {
    fn creation_flags(&mut self, flags: u32) -> &mut Self;
}

#[cfg(not(windows))]
impl CommandExt for std::process::Command {
    fn creation_flags(&mut self, _flags: u32) -> &mut Self {
        self
    }
}
