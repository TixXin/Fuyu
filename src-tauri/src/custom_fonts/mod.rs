#[cfg(test)]
mod tests;

use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use serde::{Deserialize, Serialize};
use tauri::{ipc::Response, AppHandle, Emitter, Manager};

use crate::user_error::UserError;

const FONTS_DIR: &str = "fonts";
const EXTENSIONS: [&str; 4] = ["ttf", "otf", "woff", "woff2"];
const MAX_FONT_BYTES: usize = 32 * 1024 * 1024;
const MAX_NAME_CHARS: usize = 80;
pub const CUSTOM_FONTS_CHANGED: &str = "custom-fonts-changed";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CustomFont {
    pub id: String,
    pub name: String,
    pub file: String,
    pub format: String,
    pub size: usize,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomFontImport {
    pub name: Option<String>,
    pub file_name: String,
    pub bytes: Vec<u8>,
}

fn fonts_dir(app: &AppHandle) -> Result<PathBuf, UserError> {
    crate::home_dir::fuyu_home(app.path())
        .map(|dir| dir.join(FONTS_DIR))
        .map_err(|error| UserError::new("customFont.noDataDir", "Could not find the app data folder.").detail(error))
}

fn clean_name(value: &str) -> String {
    value.trim().chars().filter(|c| !c.is_control()).take(MAX_NAME_CHARS).collect()
}

pub(crate) fn is_valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && !id.starts_with('-')
        && !id.ends_with('-')
        && id.bytes().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || b == b'-')
}

pub(crate) fn font_extension(name: &str) -> Option<String> {
    let extension = Path::new(name).extension()?.to_str()?.to_ascii_lowercase();
    EXTENSIONS.contains(&extension.as_str()).then_some(extension)
}

pub(crate) fn has_valid_font_signature(extension: &str, bytes: &[u8]) -> bool {
    if bytes.len() < 4 {
        return false;
    }
    let magic = &bytes[..4];
    match extension {
        "ttf" => matches!(magic, b"\x00\x01\x00\x00" | b"true" | b"typ1" | b"OTTO"),
        "otf" => matches!(magic, b"OTTO" | b"\x00\x01\x00\x00"),
        "woff" => magic == b"wOFF",
        "woff2" => magic == b"wOF2",
        _ => false,
    }
}

pub(crate) fn font_id(name: &str, now_ms: u128) -> String {
    let mut slug = String::new();
    for c in name.chars() {
        if c.is_ascii_alphanumeric() {
            slug.push(c.to_ascii_lowercase());
        } else if !slug.ends_with('-') && !slug.is_empty() {
            slug.push('-');
        }
        if slug.len() >= 32 {
            break;
        }
    }
    let slug = slug.trim_matches('-');
    let slug = if slug.is_empty() { "font" } else { slug };
    format!("{slug}-{now_ms:x}")
}

fn stem_name(file_name: &str) -> String {
    let stem = Path::new(file_name)
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(file_name);
    clean_name(stem)
}

pub(crate) fn plan_import(input: CustomFontImport, id: String) -> Result<(CustomFont, Vec<u8>), UserError> {
    let extension = font_extension(&input.file_name).ok_or_else(|| {
        UserError::new("customFont.format", format!("Unsupported font format: {}.", input.file_name))
            .arg("name", input.file_name.as_str())
    })?;
    if input.bytes.is_empty() || input.bytes.len() > MAX_FONT_BYTES {
        return Err(UserError::new(
            "customFont.sizeOrEmpty",
            format!("The font file is empty or too large: {} (at most 32 MB).", input.file_name),
        )
        .arg("name", input.file_name.as_str()));
    }
    if !has_valid_font_signature(&extension, &input.bytes) {
        return Err(UserError::new(
            "customFont.invalidData",
            format!("The file does not appear to be a valid font: {}.", input.file_name),
        )
        .arg("name", input.file_name.as_str()));
    }
    let fallback = stem_name(&input.file_name);
    let requested = input.name.as_deref().map(clean_name).unwrap_or_default();
    let name = if !requested.is_empty() {
        requested
    } else if !fallback.is_empty() {
        fallback
    } else {
        "Custom Font".into()
    };
    let file = format!("{id}.{extension}");
    let font = CustomFont {
        id,
        name,
        file,
        format: extension,
        size: input.bytes.len(),
    };
    Ok((font, input.bytes))
}

fn manifest_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{id}.json"))
}

fn is_matching_font_file(font: &CustomFont) -> bool {
    let Some(ext) = font_extension(&font.file) else {
        return false;
    };
    font.format == ext && font.file == format!("{}.{ext}", font.id)
}

pub(crate) fn read_font_manifest(dir: &Path, id: &str) -> Option<CustomFont> {
    if !is_valid_id(id) {
        return None;
    }
    let bytes = fs::read(manifest_path(dir, id)).ok()?;
    let font: CustomFont = serde_json::from_slice(&bytes).ok()?;
    if font.id != id || !is_matching_font_file(&font) {
        return None;
    }
    let font_path = dir.join(&font.file);
    font_path.is_file().then_some(font)
}

pub(crate) fn list_fonts_in(dir: &Path) -> Vec<CustomFont> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut fonts: Vec<CustomFont> = entries
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().into_string().ok()?;
            let id = name.strip_suffix(".json")?;
            read_font_manifest(dir, id)
        })
        .collect();
    fonts.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()).then_with(|| a.id.cmp(&b.id)));
    fonts
}

pub(crate) fn import_font_in(dir: &Path, input: CustomFontImport, now_ms: u128) -> Result<CustomFont, UserError> {
    let base_name = input
        .name
        .as_deref()
        .map(clean_name)
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| stem_name(&input.file_name));
    let id = font_id(&base_name, now_ms);
    let (font, bytes) = plan_import(input, id)?;
    fs::create_dir_all(dir).map_err(|error| {
        UserError::new("file.create", format!("Could not create {}.", dir.display()))
            .arg("path", dir.display().to_string())
            .detail(error)
    })?;
    let font_dest = dir.join(&font.file);
    let font_tmp = dir.join(format!("{}.importing", font.file));
    let manifest_dest = manifest_path(dir, &font.id);
    let manifest_tmp = dir.join(format!("{}.json.importing", font.id));
    let write = || -> Result<(), UserError> {
        fs::write(&font_tmp, &bytes).map_err(|error| {
            UserError::new("customFont.save", "Could not save the font file.").detail(error)
        })?;
        fs::rename(&font_tmp, &font_dest).map_err(|error| {
            UserError::new("customFont.save", "Could not save the font file.").detail(error)
        })?;
        let manifest = serde_json::to_vec_pretty(&font)
            .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?;
        fs::write(&manifest_tmp, manifest).map_err(|error| {
            UserError::new("customFont.save", "Could not save the font file.").detail(error)
        })?;
        fs::rename(&manifest_tmp, &manifest_dest).map_err(|error| {
            UserError::new("customFont.save", "Could not save the font file.").detail(error)
        })
    };
    if let Err(error) = write() {
        let _ = fs::remove_file(&font_tmp);
        let _ = fs::remove_file(&manifest_tmp);
        let _ = fs::remove_file(&font_dest);
        return Err(error);
    }
    Ok(font)
}

pub(crate) fn remove_font_in(dir: &Path, id: &str) -> Result<(), UserError> {
    if !is_valid_id(id) {
        return Err(UserError::new("customFont.badId", "The font id is not valid."));
    }
    let font = read_font_manifest(dir, id)
        .ok_or_else(|| UserError::new("customFont.notFound", "This font was not found."))?;
    let _ = fs::remove_file(dir.join(&font.file));
    fs::remove_file(manifest_path(dir, id))
        .map_err(|error| UserError::new("customFont.delete", "Could not delete the font.").detail(error))
}

pub(crate) fn read_font_bytes_in(dir: &Path, id: &str) -> Result<Vec<u8>, UserError> {
    if !is_valid_id(id) {
        return Err(UserError::new("customFont.badId", "The font id is not valid."));
    }
    let font = read_font_manifest(dir, id)
        .ok_or_else(|| UserError::new("customFont.notFound", "This font was not found."))?;
    let bytes = fs::read(dir.join(&font.file)).map_err(|error| {
        UserError::new("customFont.read", format!("Could not read font {}.", font.name))
            .arg("name", font.name.as_str())
            .detail(error)
    })?;
    if bytes.len() > MAX_FONT_BYTES {
        return Err(UserError::new(
            "customFont.tooLarge",
            format!("The font file is too large: {} (at most 32 MB).", font.name),
        )
        .arg("name", font.name.as_str()));
    }
    Ok(bytes)
}

#[tauri::command]
pub async fn list_custom_fonts(app: AppHandle) -> Result<Vec<CustomFont>, UserError> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = fonts_dir(&app)?;
        Ok(list_fonts_in(&dir))
    })
    .await
    .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?
}

#[tauri::command]
pub async fn import_custom_font(app: AppHandle, font: CustomFontImport) -> Result<CustomFont, UserError> {
    let emit_app = app.clone();
    let imported = tauri::async_runtime::spawn_blocking(move || {
        let now_ms = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or_default();
        let dir = fonts_dir(&app)?;
        import_font_in(&dir, font, now_ms)
    })
    .await
    .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))??;
    let _ = emit_app.emit(CUSTOM_FONTS_CHANGED, ());
    Ok(imported)
}

#[tauri::command]
pub async fn remove_custom_font(app: AppHandle, id: String) -> Result<(), UserError> {
    let emit_app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let dir = fonts_dir(&app)?;
        remove_font_in(&dir, &id)
    })
    .await
    .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))??;
    let _ = emit_app.emit(CUSTOM_FONTS_CHANGED, ());
    Ok(())
}

#[tauri::command]
pub async fn read_custom_font_file(app: AppHandle, id: String) -> Result<Response, UserError> {
    let bytes = tauri::async_runtime::spawn_blocking(move || {
        let dir = fonts_dir(&app)?;
        read_font_bytes_in(&dir, &id)
    })
    .await
    .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))??;
    Ok(Response::new(bytes))
}

#[tauri::command]
pub async fn open_custom_fonts_folder(app: AppHandle) -> Result<(), UserError> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = fonts_dir(&app)?;
        fs::create_dir_all(&dir).map_err(|error| {
            UserError::new("file.create", format!("Could not create {}.", dir.display()))
                .arg("path", dir.display().to_string())
                .detail(error)
        })?;
        tauri_plugin_opener::open_path(&dir, None::<&str>)
            .map_err(|error| UserError::new("customFont.openFolder", "Could not open the fonts folder.").detail(error))
    })
    .await
    .map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::custom_fonts::list_custom_fonts,
            crate::custom_fonts::import_custom_font,
            crate::custom_fonts::remove_custom_font,
            crate::custom_fonts::read_custom_font_file,
            crate::custom_fonts::open_custom_fonts_folder,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
