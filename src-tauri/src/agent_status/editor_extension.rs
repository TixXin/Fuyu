use crate::system::CommandExt;
use std::{
    env, fs,
    io::{Cursor, Write},
    path::{Path, PathBuf},
    process::Command,
};

use serde_json::Value;
use zip::write::SimpleFileOptions;

use super::editor_terminal::{editor_of_app, installed_extension};
use super::window_focus;
use crate::system::{windows_home_dir, CREATE_NO_WINDOW};
use crate::user_error::UserError;

const PACKAGE_JSON: &str = include_str!("../../../packages/vscode-extension/package.json");

const FILES: &[(&str, &[u8])] = &[
    ("extension/package.json", PACKAGE_JSON.as_bytes()),
    ("extension/extension.js", include_bytes!("../../../packages/vscode-extension/extension.js")),
    ("extension/match.js", include_bytes!("../../../packages/vscode-extension/match.js")),
    ("extension/README.md", include_bytes!("../../../packages/vscode-extension/README.md")),
    ("extension/CHANGELOG.md", include_bytes!("../../../packages/vscode-extension/CHANGELOG.md")),
    ("extension/LICENSE.txt", include_bytes!("../../../packages/vscode-extension/LICENSE")),
    ("extension/icon.png", include_bytes!("../../../packages/vscode-extension/icon.png")),
];

const CONTENT_TYPES: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension=".json" ContentType="application/json"/><Default Extension=".js" ContentType="application/javascript"/><Default Extension=".md" ContentType="text/markdown"/><Default Extension=".txt" ContentType="text/plain"/><Default Extension=".png" ContentType="image/png"/><Default Extension=".vsixmanifest" ContentType="text/xml"/></Types>"#;

const EDITORS: &[(&str, &str, &str, &str)] = &[
    ("code", "VS Code", "code.cmd", "Microsoft VS Code"),
    ("code - insiders", "VS Code Insiders", "code-insiders.cmd", "Microsoft VS Code Insiders"),
    ("cursor", "Cursor", "cursor.cmd", "cursor"),
    ("windsurf", "Windsurf", "windsurf.cmd", "Windsurf"),
    ("vscodium", "VSCodium", "codium.cmd", "VSCodium"),
    ("trae", "Trae", "trae.cmd", "Trae"),
    ("kiro", "Kiro", "kiro.cmd", "Kiro"),
];

pub(super) struct Package {
    name: String,
    publisher: String,
    version: String,
    display_name: String,
    description: String,
}

impl Package {
    pub(super) fn read() -> Self {
        let manifest = serde_json::from_str::<Value>(PACKAGE_JSON).unwrap_or(Value::Null);
        let field = |key: &str| xml_escape(manifest[key].as_str().unwrap_or_default());
        Self {
            name: field("name"),
            publisher: field("publisher"),
            version: field("version"),
            display_name: field("displayName"),
            description: field("description"),
        }
    }

    pub(super) fn id(&self) -> String {
        format!("{}.{}", self.publisher, self.name).to_lowercase()
    }
}

fn xml_escape(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;").replace('"', "&quot;")
}

fn manifest(package: &Package) -> String {
    let Package { name, publisher, version, display_name, description } = package;
    format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">
  <Metadata>
    <Identity Language="en-US" Id="{name}" Version="{version}" Publisher="{publisher}"/>
    <DisplayName>{display_name}</DisplayName>
    <Description xml:space="preserve">{description}</Description>
    <Categories>Other</Categories>
    <Properties><Property Id="Microsoft.VisualStudio.Code.Engine" Value="^1.75.0"/></Properties>
    <Icon>extension/icon.png</Icon>
  </Metadata>
  <Installation><InstallationTarget Id="Microsoft.VisualStudio.Code"/></Installation>
  <Dependencies/>
  <Assets>
    <Asset Type="Microsoft.VisualStudio.Code.Manifest" Path="extension/package.json" Addressable="true"/>
    <Asset Type="Microsoft.VisualStudio.Services.Icons.Default" Path="extension/icon.png" Addressable="true"/>
  </Assets>
</PackageManifest>"#
    )
}

pub(super) fn build_vsix() -> Result<Vec<u8>, String> {
    let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default();
    let manifest = manifest(&Package::read());
    let entries = [("[Content_Types].xml", CONTENT_TYPES.as_bytes()), ("extension.vsixmanifest", manifest.as_bytes())];
    for (name, data) in entries.into_iter().chain(FILES.iter().copied()) {
        zip.start_file(name, options).map_err(|error| error.to_string())?;
        zip.write_all(data).map_err(|error| error.to_string())?;
    }
    zip.finish().map(Cursor::into_inner).map_err(|error| error.to_string())
}

pub(super) fn find_cli(app: &str, exe: Option<&Path>, path_dirs: &[PathBuf], install_roots: &[PathBuf]) -> Option<PathBuf> {
    let &(_, _, script, folder) = EDITORS.iter().find(|(name, ..)| *name == app)?;
    let bins = |root: &Path| [root.join("bin"), root.join("resources").join("app").join("bin")];
    let install_dirs = exe.and_then(Path::parent).map(Path::to_path_buf).into_iter();
    let installs = install_dirs.chain(install_roots.iter().map(|root| root.join(folder)));
    let from_installs = installs.collect::<Vec<_>>().into_iter().flat_map(|root| bins(&root));
    let candidates = from_installs.collect::<Vec<_>>();
    let named = candidates.iter().chain(path_dirs).map(|dir| dir.join(script)).find(|path| path.is_file());
    named.or_else(|| candidates.iter().find_map(|dir| only_script(dir)))
}

fn only_script(dir: &Path) -> Option<PathBuf> {
    let scripts = fs::read_dir(dir)
        .ok()?
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("cmd")))
        .collect::<Vec<_>>();
    match scripts.as_slice() {
        [script] => Some(script.clone()),
        _ => None,
    }
}

fn path_dirs() -> Vec<PathBuf> {
    env::var_os("PATH").map(|path| env::split_paths(&path).collect()).unwrap_or_default()
}

fn install_roots() -> Vec<PathBuf> {
    let local = env::var_os("LOCALAPPDATA").map(|dir| PathBuf::from(dir).join("Programs"));
    let program_files = ["ProgramFiles", "ProgramFiles(x86)"].into_iter().filter_map(env::var_os).map(PathBuf::from);
    local.into_iter().chain(program_files).collect()
}

fn cli_of(app: &str) -> Option<PathBuf> {
    let exe = window_focus::open_app_exe(app).map(PathBuf::from);
    find_cli(app, exe.as_deref(), &path_dirs(), &install_roots())
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EditorExtensionState {
    app: String,
    name: String,
    installed: bool,
    can_install: bool,
}

pub(super) fn states() -> Vec<EditorExtensionState> {
    let Ok(home) = windows_home_dir() else {
        return Vec::new();
    };
    EDITORS
        .iter()
        .filter_map(|&(app, name, ..)| {
            let (_, folder) = editor_of_app(app)?;
            let extensions = home.join(folder).join("extensions");
            let cli = cli_of(app);
            (extensions.is_dir() || cli.is_some()).then(|| EditorExtensionState {
                app: app.to_string(),
                name: name.to_string(),
                installed: installed_extension(&extensions).is_some(),
                can_install: cli.is_some(),
            })
        })
        .collect()
}

pub(super) fn editor_name(app: &str) -> Option<&'static str> {
    EDITORS.iter().find(|(name, ..)| *name == app).map(|&(_, label, ..)| label)
}

pub(super) fn install(app: &str) -> Result<(), UserError> {
    let (_, folder) = editor_of_app(app).ok_or_else(|| UserError::new("editorExtension.unknown", "That editor is not supported."))?;
    let cli = cli_of(app).ok_or_else(|| {
        let editor = editor_name(app).unwrap_or(app);
        UserError::new("editorExtension.noCli", format!("Could not find {editor}'s command line. Open {editor} and try again."))
            .arg("editor", editor)
    })?;
    let failed = |detail: String| UserError::new("editorExtension.failed", "Could not install the extension.").detail(detail);
    let vsix = build_vsix().map_err(failed)?;
    let dir = env::temp_dir().join("fuyu-editor-extension");
    fs::create_dir_all(&dir).map_err(|error| failed(error.to_string()))?;
    let package = Package::read();
    let path = dir.join(format!("{}-{}.vsix", package.id(), package.version));
    fs::write(&path, vsix).map_err(|error| failed(error.to_string()))?;
    let output = Command::new(&cli)
        .arg("--install-extension")
        .arg(&path)
        .arg("--force")
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|error| failed(error.to_string()))?;
    let _ = fs::remove_file(&path);
    let home = windows_home_dir().map_err(failed)?;
    if installed_extension(&home.join(folder).join("extensions")) == Some(package.id().as_str()) {
        return Ok(());
    }
    let said = [output.stderr, output.stdout].iter().map(|text| String::from_utf8_lossy(text).trim().to_string()).find(|text| !text.is_empty());
    Err(failed(said.unwrap_or_else(|| format!("exit {}", output.status))))
}
