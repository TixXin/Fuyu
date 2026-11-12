use serde_json::{Map, Value};
use tauri::AppHandle;

pub fn init(_app: &AppHandle) -> Result<(), String> {
    Ok(())
}

pub(crate) fn apply(_settings: &Map<String, Value>) -> Result<(), String> {
    Err(crate::user_error::unsupported().to_string())
}

pub(crate) fn stop() {}

crate::user_error::unsupported_commands!(
    get_cc_connect_status,
    send_cc_connect_message,
    install_cc_connect,
    check_cc_connect_bot,
    add_cc_connect_project,
    get_cc_connect_feishu_setup,
    cancel_cc_connect_feishu_setup,
);

pub mod remote {
    crate::user_error::unsupported_commands!(
        get_cc_connect_remote_status,
        send_cc_connect_remote_message,
    );
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::cc_connect::get_cc_connect_status,
            crate::cc_connect::send_cc_connect_message,
            crate::cc_connect::install_cc_connect,
            crate::cc_connect::check_cc_connect_bot,
            crate::cc_connect::add_cc_connect_project,
            crate::cc_connect::get_cc_connect_feishu_setup,
            crate::cc_connect::cancel_cc_connect_feishu_setup,
            crate::cc_connect::remote::get_cc_connect_remote_status,
            crate::cc_connect::remote::send_cc_connect_remote_message,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
