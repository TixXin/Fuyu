pub(crate) struct IconPixels {
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) rgba: Vec<u8>,
}

pub(crate) fn exe_icon(_path: &str) -> Option<IconPixels> {
    None
}
