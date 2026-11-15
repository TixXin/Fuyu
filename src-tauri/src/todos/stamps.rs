use serde_json::Number;
use std::collections::{HashMap, HashSet};

use super::model::{ScheduledTodo, TodoArchive, TodoItem, TodosData, TodosFile, FILE_VERSION};
use crate::sync::{record, Clock, Hlc};

fn millis(number: &Number) -> u64 {
    number.as_u64().or_else(|| number.as_f64().filter(|value| value.is_finite() && *value > 0.0).map(|value| value as u64)).unwrap_or(0)
}

trait Stamped: Clone + PartialEq {
    fn id(&self) -> &str;
    fn stamps(&mut self) -> (&mut Option<Hlc>, &mut Option<String>);
    fn created_at(&self) -> &Number;

    fn bare(&self) -> Self {
        let mut bare = self.clone();
        let (updated_at, device_id) = bare.stamps();
        *updated_at = None;
        *device_id = None;
        bare
    }
}

impl Stamped for TodoItem {
    fn id(&self) -> &str {
        &self.id
    }
    fn stamps(&mut self) -> (&mut Option<Hlc>, &mut Option<String>) {
        (&mut self.updated_at, &mut self.device_id)
    }
    fn created_at(&self) -> &Number {
        &self.created_at
    }
}

impl Stamped for ScheduledTodo {
    fn id(&self) -> &str {
        &self.id
    }
    fn stamps(&mut self) -> (&mut Option<Hlc>, &mut Option<String>) {
        (&mut self.updated_at, &mut self.device_id)
    }
    fn created_at(&self) -> &Number {
        &self.created_at
    }
}

fn set<T: Stamped>(item: &mut T, stamp: Hlc) {
    let (updated_at, device_id) = item.stamps();
    *device_id = Some(stamp.device.clone());
    *updated_at = Some(stamp);
}

fn fill_items<T: Stamped>(items: &mut [T], device: &str) {
    for item in items {
        let created = millis(item.created_at());
        let (updated_at, device_id) = item.stamps();
        let stamp = updated_at.get_or_insert_with(|| Hlc::from_millis(created, device));
        if device_id.is_none() {
            *device_id = Some(stamp.device.clone());
        }
    }
}

pub(crate) fn fill_missing(data: &mut TodosData, device: &str) {
    fill_items(&mut data.todos, device);
    fill_items(&mut data.scheduled, device);
    for archive in &mut data.archives {
        fill_items(&mut archive.todos, device);
        if archive.updated_at.is_none() {
            archive.updated_at = Some(Hlc::from_millis(millis(&archive.saved_at), device));
        }
    }
}

pub(crate) fn upgrade(file: &mut TodosFile, device: &str) {
    fill_missing(&mut file.data, device);
    file.version = FILE_VERSION;
}

fn restamp_items<T: Stamped>(old: &[T], new: &mut [T], clock: &mut Clock, wall: u64) {
    let before: HashMap<&str, &T> = old.iter().map(|item| (item.id(), item)).collect();
    for item in new {
        match before.get(item.id()) {
            Some(previous) if previous.bare() == item.bare() => *item = (*previous).clone(),
            _ => set(item, clock.tick(wall)),
        }
    }
}

fn bare_archive(archive: &TodoArchive) -> TodoArchive {
    TodoArchive { updated_at: None, todos: archive.todos.iter().map(Stamped::bare).collect(), ..archive.clone() }
}

fn restamp_archives(old: &[TodoArchive], new: &mut [TodoArchive], clock: &mut Clock, wall: u64) {
    let before: HashMap<&str, &TodoArchive> = old.iter().map(|archive| (archive.date.as_str(), archive)).collect();
    for archive in new {
        let previous = before.get(archive.date.as_str());
        restamp_items(previous.map_or(&[][..], |previous| &previous.todos), &mut archive.todos, clock, wall);
        archive.updated_at = match previous {
            Some(previous) if bare_archive(previous) == bare_archive(archive) => previous.updated_at.clone(),
            _ => Some(clock.tick(wall)),
        };
    }
}

fn ids(data: &TodosData) -> HashSet<&str> {
    let archived = data.archives.iter().flat_map(|archive| archive.todos.iter().map(|todo| todo.id.as_str()));
    data.todos.iter().map(|todo| todo.id.as_str()).chain(data.scheduled.iter().map(|todo| todo.id.as_str())).chain(archived).collect()
}

pub(crate) fn restamp(old: &TodosData, mut new: TodosData, clock: &mut Clock, wall: u64) -> TodosData {
    restamp_items(&old.todos, &mut new.todos, clock, wall);
    restamp_items(&old.scheduled, &mut new.scheduled, clock, wall);
    restamp_archives(&old.archives, &mut new.archives, clock, wall);
    new.daily_note_updated_at = if new.daily_note == old.daily_note { old.daily_note_updated_at.clone() } else { Some(clock.tick(wall)) };
    let (before, after) = (ids(old), ids(&new));
    let mut tombstones = old.tombstones.clone();
    let mut gone: Vec<&str> = before.difference(&after).copied().collect();
    gone.sort_unstable();
    for id in gone {
        record::bury(&mut tombstones, id, clock.tick(wall));
    }
    for id in &after {
        record::unbury(&mut tombstones, id);
    }
    new.tombstones = tombstones;
    if new != *old {
        record::prune(&mut new.tombstones, wall);
    }
    new
}

pub(crate) fn all(data: &TodosData) -> impl Iterator<Item = &Hlc> {
    let items = data.todos.iter().filter_map(|todo| todo.updated_at.as_ref());
    let scheduled = data.scheduled.iter().filter_map(|todo| todo.updated_at.as_ref());
    let archives = data.archives.iter().flat_map(|archive| archive.updated_at.iter().chain(archive.todos.iter().filter_map(|todo| todo.updated_at.as_ref())));
    let tombstones = data.tombstones.iter().map(|tombstone| &tombstone.deleted_at);
    items.chain(scheduled).chain(archives).chain(tombstones).chain(data.daily_note_updated_at.iter())
}
