use super::routes::ApiError;

const FEATURES: &[(&str, &str, &str)] = &[
    ("todos.", "todos", "Todos are switched off in Fuyu."),
    ("note.", "todos", "Todos are switched off in Fuyu."),
    ("agentStatus.", "agents", "AI Agent is switched off in Fuyu."),
    ("clipboard.", "clipboard", "The clipboard is switched off in Fuyu."),
    ("notify", "messages", "Messages are switched off in Fuyu."),
];

pub(super) fn check_with(method: &str, enabled: impl Fn(&str) -> bool) -> Result<(), ApiError> {
    match FEATURES.iter().find(|(prefix, _, _)| method.starts_with(prefix)) {
        Some(&(_, plugin, message)) if !enabled(plugin) => Err(ApiError::new(503, message)),
        _ => Ok(()),
    }
}

pub(super) fn check(method: &str) -> Result<(), ApiError> {
    check_with(method, crate::plugin_kernel::builtins::is_enabled)
}
