use std::path::Path;

use super::{apps, proc_info};

pub(crate) fn image_path(process_id: u32) -> Option<String> {
    proc_info::executable_path(process_id)
}

pub(crate) fn running_executable(file_names: &[&str]) -> Option<String> {
    proc_info::all_pids().into_iter().filter_map(proc_info::executable_path).find(|path| {
        Path::new(path).file_name().and_then(|name| name.to_str()).is_some_and(|name| file_names.iter().any(|wanted| wanted.eq_ignore_ascii_case(name)))
    })
}

pub(crate) fn app_bundle_running(bundle_id: &str) -> bool {
    let Some(bundle) = apps::path_for_bundle_id(bundle_id) else {
        return false;
    };
    let executables = format!("{}/Contents/MacOS/", bundle.trim_end_matches('/'));
    proc_info::all_pids().into_iter().filter_map(proc_info::executable_path).any(|path| path.starts_with(&executables))
}

#[cfg(test)]
mod tests {
    use super::app_bundle_running;

    #[test]
    fn an_app_that_is_not_installed_is_not_running() {
        assert!(!app_bundle_running("com.example.not-installed-anywhere"));
    }
}
