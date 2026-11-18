use serde_json::{json, Map, Value};
use std::{
    fs,
    path::{Path, PathBuf},
};

use super::{
    backend::Backend,
    backend_folder::FolderBackend,
    categories::{
        clip_favorites, links,
        settings::{self, Local, Part},
        snippets, todos, Category,
    },
    config::SyncCategory,
    layout::{DeviceInfo, Doc},
    round::{Clockwork, Options, Round, RoundResult},
    settings_meta::{self, SettingsMeta},
    Clock, Hlc, Tombstone,
};
use crate::clipboard_history::ClipboardHistoryItem;

pub(super) const START: u64 = 1_800_000_000_000;

pub(super) fn temp(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("fuyu-sync2-{name}-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("temp dir");
    dir
}

pub(super) struct TestClock {
    clock: Clock,
    pub wall: u64,
}

impl Clockwork for TestClock {
    fn tick(&mut self) -> Hlc {
        self.wall += 1;
        self.clock.tick(self.wall)
    }

    fn observe(&mut self, seen: &Hlc) {
        self.clock.observe(seen, self.wall);
    }

    fn now_ms(&self) -> u64 {
        self.wall
    }
}

pub(super) struct MemTodos {
    pub data: Value,
    device: String,
}

impl Category for MemTodos {
    fn kind(&self) -> SyncCategory {
        SyncCategory::Todos
    }

    fn load(&mut self) -> Result<Option<Doc>, String> {
        Ok(Some(todos::to_doc(&self.data, &self.device)))
    }

    fn store(&mut self, merged: &Doc) -> Result<(), String> {
        let next = todos::apply(&self.data, merged);
        serde_json::from_value::<crate::todos::TodosData>(next.clone()).map_err(|error| error.to_string())?;
        self.data = next;
        Ok(())
    }
}

pub(super) struct MemRecords {
    kind: SyncCategory,
    pub items: Vec<Value>,
    pub tombstones: Vec<Tombstone>,
    device: String,
}

impl Category for MemRecords {
    fn kind(&self) -> SyncCategory {
        self.kind
    }

    fn load(&mut self) -> Result<Option<Doc>, String> {
        Ok(Some(match self.kind {
            SyncCategory::Links => links::to_doc(&self.items, &self.tombstones, &self.device),
            _ => snippets::to_doc(&self.items, &self.tombstones, &self.device),
        }))
    }

    fn store(&mut self, merged: &Doc) -> Result<(), String> {
        (self.items, self.tombstones) = match self.kind {
            SyncCategory::Links => links::apply(&self.items, merged),
            _ => snippets::apply(&self.items, merged),
        };
        Ok(())
    }

    fn tidy(&self, doc: &mut Doc, tick: &mut dyn FnMut() -> Hlc) {
        if self.kind == SyncCategory::Links {
            links::tidy(doc, tick);
        }
    }
}

pub(super) struct MemSettings {
    part: Part,
    pub local: Local,
    device: String,
    pub groups: Vec<String>,
}

impl Category for MemSettings {
    fn kind(&self) -> SyncCategory {
        if self.part == Part::Presets { SyncCategory::Presets } else { SyncCategory::Settings }
    }

    fn load(&mut self) -> Result<Option<Doc>, String> {
        Ok(Some(settings::to_doc(settings_meta::whitelist(), &self.local, self.part, &self.device, &self.groups)))
    }

    fn store(&mut self, merged: &Doc) -> Result<(), String> {
        self.local = settings::apply(settings_meta::whitelist(), &self.local, merged, self.part, &self.groups);
        Ok(())
    }

    fn pinned(&self, id: &str) -> bool {
        settings::pinned(settings_meta::whitelist(), id)
    }

    fn tidy(&self, doc: &mut Doc, _tick: &mut dyn FnMut() -> Hlc) {
        settings::drop_closed(settings_meta::whitelist(), doc, &self.groups);
    }
}

pub(super) struct MemFavorites {
    pub items: Vec<ClipboardHistoryItem>,
    pub tombstones: Vec<Tombstone>,
    pub enabled: bool,
    device: String,
}

impl Category for MemFavorites {
    fn kind(&self) -> SyncCategory {
        SyncCategory::ClipFavorites
    }

    fn load(&mut self) -> Result<Option<Doc>, String> {
        Ok(Some(clip_favorites::to_doc(&self.items, &self.tombstones, &self.device)))
    }

    fn store(&mut self, merged: &Doc) -> Result<(), String> {
        (self.items, self.tombstones) = clip_favorites::apply(&self.items, merged, 1024 * 1024);
        Ok(())
    }

    fn tidy(&self, doc: &mut Doc, tick: &mut dyn FnMut() -> Hlc) {
        clip_favorites::tidy(doc, tick);
    }
}

pub(super) struct Device {
    pub id: String,
    pub clock: TestClock,
    pub state: PathBuf,
    pub todos: MemTodos,
    pub snippets: MemRecords,
    pub links: MemRecords,
    pub settings: MemSettings,
    pub presets: MemSettings,
    pub favorites: MemFavorites,
    pub backups: usize,
}

pub(super) fn empty_todos(date: &str) -> Value {
    json!({ "date": date, "todos": [], "scheduled": [], "archives": [], "dailyNote": "", "activeTodoId": null })
}

impl Device {
    pub(super) fn new(id: &str, root: &Path) -> Self {
        let records = |kind| MemRecords { kind, items: Vec::new(), tombstones: Vec::new(), device: id.into() };
        let empty = Local { keys: Map::new(), meta: SettingsMeta::default() };
        Self {
            id: id.into(),
            clock: TestClock { clock: Clock::new(id), wall: START },
            state: root.join(format!("state-{id}")),
            todos: MemTodos { data: empty_todos("2026-11-15"), device: id.into() },
            snippets: records(SyncCategory::Snippets),
            links: records(SyncCategory::Links),
            settings: MemSettings { part: Part::Settings, local: empty.clone(), device: id.into(), groups: Vec::new() },
            presets: MemSettings { part: Part::Presets, local: empty, device: id.into(), groups: Vec::new() },
            favorites: MemFavorites { items: Vec::new(), tombstones: Vec::new(), enabled: false, device: id.into() },
            backups: 0,
        }
    }

    pub(super) fn stamp(&mut self) -> Hlc {
        self.clock.wall += 1_000;
        self.clock.tick()
    }

    pub(super) fn sync_backend(&mut self, backend: &dyn Backend, options: Options) -> RoundResult {
        let me = DeviceInfo { device_id: self.id.clone(), name: format!("{} pc", self.id), platform: "test".into(), app_version: "1.0.0".into(), last_sync_at: 0 };
        let backups = &mut self.backups;
        let mut backup = || {
            *backups += 1;
            Ok(())
        };
        let favorites_on = self.favorites.enabled;
        let mut categories: Vec<&mut dyn Category> = vec![&mut self.todos, &mut self.snippets, &mut self.links, &mut self.settings, &mut self.presets];
        let disabled: Vec<SyncCategory> = if favorites_on {
            categories.push(&mut self.favorites);
            Vec::new()
        } else {
            vec![SyncCategory::ClipFavorites]
        };
        let mut round = Round { backend, me: &me, state_dir: &self.state, clock: &mut self.clock, options, backup: &mut backup };
        round.run(&mut categories, &disabled)
    }

    pub(super) fn sync_with(&mut self, folder: &Path, options: Options) -> RoundResult {
        let backend = FolderBackend::new(folder.to_path_buf());
        self.sync_backend(&backend, options)
    }

    pub(super) fn sync(&mut self, folder: &Path) -> RoundResult {
        self.sync_with(folder, Options::default())
    }

    pub(super) fn set_settings(&mut self, keys: Map<String, Value>) {
        let old = self.settings.local.keys.clone();
        let meta = self.settings.local.meta.clone();
        let clock = &mut self.clock;
        clock.wall += 1_000;
        let next = settings_meta::restamp(settings_meta::whitelist(), Some(&old), &keys, &meta, &mut clock.clock, clock.wall);
        self.settings.local = Local { keys: keys.clone(), meta: next.clone() };
        self.presets.local = Local { keys, meta: next };
    }

    pub(super) fn todo_ids(&self) -> Vec<String> {
        let mut ids: Vec<String> = self.todos.data["todos"].as_array().into_iter().flatten().filter_map(|todo| todo["id"].as_str().map(str::to_string)).collect();
        ids.sort();
        ids
    }
}

pub(super) fn todo(id: &str, title: &str, stamp: &Hlc) -> Value {
    json!({ "id": id, "title": title, "completed": false, "createdAt": 1, "updatedAt": stamp.to_string(), "deviceId": stamp.device })
}

pub(super) fn record(id: &str, field: &str, text: &str, stamp: &Hlc) -> Value {
    json!({ "id": id, field: text, "updatedAt": stamp.to_string(), "deviceId": stamp.device })
}

pub(super) fn find<'a>(items: &'a [Value], id: &str) -> Option<&'a Value> {
    items.iter().find(|item| item["id"] == id)
}
