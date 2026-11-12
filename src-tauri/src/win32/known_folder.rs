use std::path::PathBuf;
use windows::{
    core::GUID,
    Win32::{
        System::Com::CoTaskMemFree,
        UI::Shell::{FOLDERID_Downloads, FOLDERID_Pictures, SHGetKnownFolderPath, KF_FLAG_DEFAULT},
    },
};

pub(crate) fn downloads() -> Option<PathBuf> {
    known_folder(&FOLDERID_Downloads)
}

pub(crate) fn pictures() -> Option<PathBuf> {
    known_folder(&FOLDERID_Pictures)
}

fn known_folder(id: &GUID) -> Option<PathBuf> {
    let path = unsafe { SHGetKnownFolderPath(id, KF_FLAG_DEFAULT, None) }.ok()?;
    let text = unsafe { path.to_string() };
    unsafe { CoTaskMemFree(Some(path.0.cast())) };
    text.ok().filter(|text| !text.is_empty()).map(PathBuf::from)
}

#[cfg(test)]
mod tests {
    use super::{downloads, pictures};

    #[test]
    fn the_downloads_and_pictures_folders_are_absolute_paths() {
        for path in [downloads().expect("Downloads"), pictures().expect("Pictures")] {
            assert!(path.is_absolute(), "{path:?}");
        }
    }
}
