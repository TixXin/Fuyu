pub(super) const PERMISSIONS: [&str; 14] = [
    "todos:read",
    "todos:write",
    "notes:read",
    "notes:write",
    "agent-status:read",
    "agent-status:write",
    "island:notify",
    "secrets",
    "clipboard:read",
    "messages:read",
    "media:read",
    "media:control",
    "shelf:read",
    "shelf:write",
];

pub(super) const METHODS: [(&str, &str); 27] = [
    ("todos.list", "todos:read"),
    ("todos.days", "todos:read"),
    ("todos.add", "todos:write"),
    ("todos.update", "todos:write"),
    ("todos.remove", "todos:write"),
    ("note.get", "notes:read"),
    ("note.set", "notes:write"),
    ("agentStatus.report", "agent-status:write"),
    ("agentStatus.clear", "agent-status:write"),
    ("island.notify", "island:notify"),
    ("secrets.get", "secrets"),
    ("secrets.set", "secrets"),
    ("secrets.delete", "secrets"),
    ("clipboard.history", "clipboard:read"),
    ("messages.list", "messages:read"),
    ("media.nowPlaying", "media:read"),
    ("media.cover", "media:read"),
    ("media.playPause", "media:control"),
    ("media.next", "media:control"),
    ("media.previous", "media:control"),
    ("media.seek", "media:control"),
    ("media.setVolume", "media:control"),
    ("media.toggleShuffle", "media:control"),
    ("media.cycleRepeat", "media:control"),
    ("shelf.list", "shelf:read"),
    ("shelf.add", "shelf:write"),
    ("shelf.remove", "shelf:write"),
];

pub(super) const CAPABILITIES: [&str; 13] = [
    "events", "notifications", "storage", "secrets", "views", "status", "webview", "permissions", "openView", "statusCells", "notifyStyle",
    "notifyControls", "statusBatteries",
];

pub(super) fn is_known_permission(name: &str) -> bool {
    PERMISSIONS.contains(&name)
}

pub(super) fn method_permission(method: &str) -> Option<(&'static str, &'static str)> {
    METHODS.iter().copied().find(|(name, _)| *name == method)
}

pub(super) fn missing_permissions(requested: &[String], granted: &[String]) -> Vec<String> {
    requested
        .iter()
        .filter(|name| !granted.contains(name))
        .cloned()
        .collect()
}
