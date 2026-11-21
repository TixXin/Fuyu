use std::{
    fs,
    path::{Path, PathBuf},
};

const FOLDER: &str = "kept";

pub(super) fn folder(history: &Path) -> PathBuf {
    history.join(FOLDER)
}

fn free_name(folder: &Path, source: &Path) -> PathBuf {
    let stem = source.file_stem().and_then(|stem| stem.to_str()).filter(|stem| !stem.is_empty()).unwrap_or("Fuyu");
    let mut path = folder.join(format!("{stem}.png"));
    let mut next = 2;
    while path.exists() {
        path = folder.join(format!("{stem}_{next}.png"));
        next += 1;
    }
    path
}

pub(super) fn keep(history: &Path, source: &Path) -> Result<PathBuf, String> {
    let folder = folder(history);
    if source.parent() == Some(folder.as_path()) && source.is_file() {
        return Ok(source.to_path_buf());
    }
    fs::create_dir_all(&folder).map_err(|error| format!("Failed to create {}: {error}", folder.display()))?;
    let target = free_name(&folder, source);
    fs::copy(source, &target).map_err(|error| format!("Failed to keep {}: {error}", source.display()))?;
    Ok(target)
}

pub(super) fn kept_file(history: &Path, path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);
    let inside = path.parent() == Some(folder(history).as_path()) && path.extension().is_some_and(|extension| extension.eq_ignore_ascii_case("png"));
    if inside && path.is_file() {
        Ok(path)
    } else {
        Err("This picture is gone.".to_string())
    }
}
