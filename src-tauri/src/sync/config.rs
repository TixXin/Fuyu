use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

pub(crate) const FILE_NAME: &str = "sync-config.json";
const VERSION: u32 = 1;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SyncBackendKind {
    #[default]
    Off,
    Folder,
    Webdav,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebdavConfig {
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub username: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SyncCategory {
    Todos,
    Snippets,
    Links,
    Settings,
    Presets,
    ClipFavorites,
}

impl SyncCategory {
    pub(crate) const ALL: [Self; 6] = [
        Self::Todos,
        Self::Snippets,
        Self::Links,
        Self::Settings,
        Self::Presets,
        Self::ClipFavorites,
    ];

    pub(crate) const DEFAULT_ON: [Self; 5] = [
        Self::Todos,
        Self::Snippets,
        Self::Links,
        Self::Settings,
        Self::Presets,
    ];

    pub(crate) fn name(self) -> &'static str {
        match self {
            Self::Todos => "todos",
            Self::Snippets => "snippets",
            Self::Links => "links",
            Self::Settings => "settings",
            Self::Presets => "presets",
            Self::ClipFavorites => "clip-favorites",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncConfig {
    #[serde(default)]
    pub version: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub backend: Option<SyncBackendKind>,
    #[serde(default)]
    pub folder: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub webdav: Option<WebdavConfig>,
    #[serde(default = "default_categories")]
    pub categories: Vec<SyncCategory>,
    #[serde(default)]
    pub optional_groups: Vec<String>,
}

fn default_categories() -> Vec<SyncCategory> {
    SyncCategory::DEFAULT_ON.to_vec()
}

impl Default for SyncConfig {
    fn default() -> Self {
        Self {
            version: VERSION,
            backend: Some(SyncBackendKind::Off),
            folder: None,
            webdav: None,
            categories: default_categories(),
            optional_groups: Vec::new(),
        }
    }
}

impl SyncConfig {
    pub(crate) fn normalized(mut self) -> Self {
        self.version = VERSION;
        self.folder = self
            .folder
            .map(|folder| folder.trim().to_string())
            .filter(|folder| !folder.is_empty());
        self.webdav = self.webdav.and_then(|webdav| {
            let url = super::webdav::clean_webdav_url(&webdav.url)
                .unwrap_or_else(|_| webdav.url.trim().to_string());
            let username = webdav.username.trim().to_string();
            (!url.is_empty() || !username.is_empty()).then_some(WebdavConfig { url, username })
        });
        let resolved_backend = match self.backend {
            Some(SyncBackendKind::Folder) if self.folder.is_some() => SyncBackendKind::Folder,
            Some(SyncBackendKind::Webdav)
                if self
                    .webdav
                    .as_ref()
                    .is_some_and(|webdav| !webdav.url.is_empty() && !webdav.username.is_empty()) =>
            {
                SyncBackendKind::Webdav
            }
            Some(_) => SyncBackendKind::Off,
            None => {
                if self.folder.is_some() {
                    SyncBackendKind::Folder
                } else {
                    SyncBackendKind::Off
                }
            }
        };
        self.backend = Some(resolved_backend);
        self.categories.sort_unstable();
        self.categories.dedup();
        let known = &super::settings_meta::whitelist().optional_groups;
        self.optional_groups.retain(|group| known.contains_key(group));
        self.optional_groups.sort_unstable();
        self.optional_groups.dedup();
        self
    }

    pub(crate) fn active_backend(&self) -> SyncBackendKind {
        match self.backend {
            Some(SyncBackendKind::Folder) if self.folder.is_some() => SyncBackendKind::Folder,
            Some(SyncBackendKind::Webdav)
                if self
                    .webdav
                    .as_ref()
                    .is_some_and(|webdav| !webdav.url.is_empty() && !webdav.username.is_empty()) =>
            {
                SyncBackendKind::Webdav
            }
            Some(_) => SyncBackendKind::Off,
            None if self.folder.is_some() => SyncBackendKind::Folder,
            None => SyncBackendKind::Off,
        }
    }

    pub(crate) fn target_key(&self) -> Option<String> {
        match self.active_backend() {
            SyncBackendKind::Off => None,
            SyncBackendKind::Folder => self.folder.as_ref().map(|folder| format!("folder:{folder}")),
            SyncBackendKind::Webdav => self
                .webdav
                .as_ref()
                .map(|webdav| format!("webdav:{}|{}", webdav.url, webdav.username)),
        }
    }

    pub(crate) fn enabled(&self, category: SyncCategory) -> bool {
        self.categories.contains(&category)
    }
}

pub(crate) fn load(home: &Path) -> SyncConfig {
    fs::read(home.join(FILE_NAME))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<SyncConfig>(&bytes).ok())
        .map(SyncConfig::normalized)
        .unwrap_or_default()
}

pub(crate) fn save(home: &Path, config: &SyncConfig) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(config).map_err(|error| error.to_string())?;
    fs::create_dir_all(home).map_err(|error| format!("Could not create {}: {error}", home.display()))?;
    crate::fs_write::replace_file(&home.join(FILE_NAME), &bytes)
        .map_err(|error| format!("Could not save the sync settings: {error}"))
}
