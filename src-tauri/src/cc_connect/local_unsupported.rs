use serde_json::{Map, Value};

pub(crate) fn apply(_settings: &Map<String, Value>) -> Result<(), String> {
    Ok(())
}

pub(crate) fn stop() {}

pub(crate) fn running() -> bool {
    false
}

crate::user_error::unsupported_commands!(
    get_cc_connect_status,
    send_cc_connect_message,
    install_cc_connect,
    add_cc_connect_project,
    get_cc_connect_feishu_setup,
    cancel_cc_connect_feishu_setup,
);
