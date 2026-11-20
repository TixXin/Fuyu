#[cfg(target_os = "macos")]
pub(crate) use crate::macos::{icon, input, job, ocr, private_memory, process, process_env, process_times, power, process_tree, session, system_stats};
#[cfg(windows)]
pub(crate) use crate::win32::{icon, input, job, ocr, private_memory, process, process_env, process_times, power, process_tree, session, system_stats};
