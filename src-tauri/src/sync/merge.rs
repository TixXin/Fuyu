use std::collections::BTreeSet;

use super::{
    layout::{Doc, Entry, Note},
    record::TOMBSTONE_KEEP_MS,
    Hlc,
};

pub(crate) const BRAKE_MIN_REMOVED: usize = 5;

pub(crate) struct Rules<'a> {
    pub first: bool,
    pub pinned: &'a dyn Fn(&str) -> bool,
}

fn pick<'a>(local: Option<&'a Entry>, remote: Option<&'a Entry>, first: bool) -> Option<&'a Entry> {
    match (local, remote) {
        (Some(local), Some(remote)) if local.updated_at.ms == 0 && remote.updated_at.ms == 0 => Some(if first { remote } else { local }),
        (Some(local), Some(remote)) => Some(if remote.updated_at > local.updated_at { remote } else { local }),
        (local, remote) => local.or(remote),
    }
}

fn newer<'a>(left: Option<&'a Hlc>, right: Option<&'a Hlc>) -> Option<&'a Hlc> {
    match (left, right) {
        (Some(left), Some(right)) => Some(left.max(right)),
        (left, right) => left.or(right),
    }
}

fn merge_entries(local: &Doc, remote: &Doc, rules: &Rules, merged: &mut Doc) {
    let ids: BTreeSet<&String> = local.entries.keys().chain(remote.entries.keys()).chain(local.tombstones.keys()).chain(remote.tombstones.keys()).collect();
    for id in ids {
        let (kept, theirs) = (local.entries.get(id), remote.entries.get(id));
        let entry = match ((rules.pinned)(id), rules.first) {
            (true, true) => theirs.or(kept),
            (true, false) => kept.or(theirs),
            (false, _) => pick(kept, theirs, rules.first),
        };
        let tombstone = newer(local.tombstones.get(id), remote.tombstones.get(id));
        match (entry, tombstone) {
            (Some(entry), Some(tombstone)) if *tombstone > entry.updated_at => {
                merged.tombstones.insert(id.clone(), tombstone.clone());
            }
            (Some(entry), _) => {
                merged.entries.insert(id.clone(), entry.clone());
            }
            (None, Some(tombstone)) => {
                merged.tombstones.insert(id.clone(), tombstone.clone());
            }
            (None, None) => {}
        }
    }
}

pub(crate) fn conflict_text(winner: &Note, loser: &Note) -> String {
    format!("{}\n\n——— {} ———\n{}", winner.text.trim_end(), loser.updated_at.device, loser.text.trim())
}

fn merge_note(local: &Note, remote: &Note, base: Option<&Note>, tick: &mut dyn FnMut() -> Hlc) -> Note {
    if local.text == remote.text {
        return if remote.updated_at > local.updated_at { remote.clone() } else { local.clone() };
    }
    let changed = |note: &Note| base.is_none_or(|base| base.text != note.text);
    let (local_changed, remote_changed) = (changed(local), changed(remote));
    if !remote_changed {
        return local.clone();
    }
    if !local_changed {
        return remote.clone();
    }
    let (winner, loser) = if remote.updated_at > local.updated_at { (remote, local) } else { (local, remote) };
    if loser.text.trim().is_empty() || winner.text.contains(loser.text.trim()) {
        return winner.clone();
    }
    if winner.text.trim().is_empty() || loser.text.contains(winner.text.trim()) {
        return Note { text: loser.text.clone(), updated_at: tick() };
    }
    Note { text: conflict_text(winner, loser), updated_at: tick() }
}

pub(crate) fn merge(local: &Doc, remote: &Doc, base: Option<&Doc>, rules: &Rules, tick: &mut dyn FnMut() -> Hlc) -> Doc {
    let mut merged = Doc::default();
    merge_entries(local, remote, rules, &mut merged);
    let keys: BTreeSet<&String> = local.notes.keys().chain(remote.notes.keys()).collect();
    for key in keys {
        let note = match (local.notes.get(key), remote.notes.get(key)) {
            (Some(local), Some(remote)) => merge_note(local, remote, base.and_then(|base| base.notes.get(key)), tick),
            (Some(note), None) | (None, Some(note)) => note.clone(),
            (None, None) => continue,
        };
        merged.notes.insert(key.clone(), note);
    }
    merged
}

pub(crate) fn prune(doc: &mut Doc, now_ms: u64) {
    doc.tombstones.retain(|_, deleted_at| deleted_at.ms.saturating_add(TOMBSTONE_KEEP_MS) >= now_ms);
}

pub(crate) fn removed(local: &Doc, merged: &Doc) -> usize {
    local.entries.keys().filter(|id| !merged.entries.contains_key(*id)).count()
}

pub(crate) fn needs_brake(local: &Doc, removed: usize) -> bool {
    removed >= BRAKE_MIN_REMOVED && removed * 2 > local.entries.len()
}
