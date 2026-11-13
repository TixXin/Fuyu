use std::path::Path;

use super::proc_info;

pub(crate) fn image_path(process_id: u32) -> Option<String> {
    proc_info::executable_path(process_id)
}

pub(crate) fn running_executable(file_names: &[&str]) -> Option<String> {
    proc_info::all_pids().into_iter().filter_map(proc_info::executable_path).find(|path| {
        Path::new(path).file_name().and_then(|name| name.to_str()).is_some_and(|name| file_names.iter().any(|wanted| wanted.eq_ignore_ascii_case(name)))
    })
}
