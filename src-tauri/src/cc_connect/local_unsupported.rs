use serde_json::{Map, Value};

pub(crate) fn apply(_settings: &Map<String, Value>) -> Result<(), String> {
    Err(crate::user_error::unsupported().to_string())
}

pub(crate) fn stop() {}

crate::user_error::unsupported_commands!(
    get_cc_connect_status,
    send_cc_connect_message,
    install_cc_connect,
    add_cc_connect_project,
    get_cc_connect_feishu_setup,
    cancel_cc_connect_feishu_setup,
);
