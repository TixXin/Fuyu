use serde::Serialize;
use serde_json::{Map, Value};
use std::fmt;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct UserError {
    code: &'static str,
    #[serde(skip_serializing_if = "Map::is_empty")]
    args: Map<String, Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    detail: Option<String>,
    message: String,
}

impl UserError {
    pub(crate) fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self { code, args: Map::new(), detail: None, message: message.into() }
    }

    pub(crate) fn arg(mut self, name: &str, value: impl Into<Value>) -> Self {
        self.args.insert(name.to_string(), value.into());
        self
    }

    pub(crate) fn detail(mut self, detail: impl fmt::Display) -> Self {
        let text = detail.to_string();
        self.detail = (!text.trim().is_empty()).then_some(text);
        self
    }

    #[cfg_attr(not(windows), allow(dead_code))]
    pub(crate) fn redact(mut self, secret: &str) -> Self {
        if secret.is_empty() {
            return self;
        }
        let hide = |text: &str| text.replace(secret, "[token]");
        self.message = hide(&self.message);
        self.detail = self.detail.as_deref().map(hide);
        for value in self.args.values_mut() {
            if let Value::String(text) = value {
                *text = hide(text);
            }
        }
        self
    }

    #[cfg(test)]
    pub(crate) fn code(&self) -> &'static str {
        self.code
    }
}

impl fmt::Display for UserError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match &self.detail {
            Some(detail) => write!(formatter, "{}: {detail}", self.message.trim_end_matches('.')),
            None => formatter.write_str(&self.message),
        }
    }
}

impl plugin_base::ServiceFailure for UserError {
    fn into_serve_error(self) -> plugin_base::ServeError {
        let mut data = Map::new();
        if !self.args.is_empty() {
            data.insert("args".to_string(), Value::Object(self.args));
        }
        if let Some(detail) = self.detail {
            data.insert("detail".to_string(), Value::String(detail));
        }
        let error = plugin_base::ServeError::new(self.code, self.message);
        if data.is_empty() {
            error
        } else {
            error.with_data(Value::Object(data))
        }
    }
}

impl From<String> for UserError {
    fn from(message: String) -> Self {
        Self::new("plain", message)
    }
}

impl From<&str> for UserError {
    fn from(message: &str) -> Self {
        Self::new("plain", message)
    }
}

#[cfg(not(windows))]
pub(crate) fn unsupported() -> UserError {
    UserError::new("platform.unsupported", "Not available on this platform yet.")
}

#[cfg(not(windows))]
macro_rules! unsupported_commands {
    ($($name:ident),* $(,)?) => {
        $(
            #[tauri::command]
            pub fn $name() -> Result<(), crate::user_error::UserError> {
                Err(crate::user_error::unsupported())
            }
        )*
    };
}
#[cfg(not(windows))]
pub(crate) use unsupported_commands;

pub(crate) mod credential {
    use super::UserError;
    use std::fmt::{Debug, Display};

    const STORE: &str = if cfg!(target_os = "macos") { "the keychain" } else { "Windows Credential Manager" };
    const STALE_APP_STATUSES: [i32; 2] = [100_002, -67_068];

    pub(crate) fn open(error: impl Debug + Display) -> UserError {
        failed("credential.open", format!("Could not open {STORE}."), error, cfg!(target_os = "macos"))
    }

    pub(crate) fn read(error: impl Debug + Display) -> UserError {
        failed("credential.read", format!("Could not read from {STORE}."), error, cfg!(target_os = "macos"))
    }

    pub(crate) fn save(error: impl Debug + Display) -> UserError {
        failed("credential.save", format!("Could not save to {STORE}."), error, cfg!(target_os = "macos"))
    }

    pub(crate) fn delete(error: impl Debug + Display) -> UserError {
        failed("credential.delete", format!("Could not delete from {STORE}."), error, cfg!(target_os = "macos"))
    }

    fn failed(code: &'static str, message: String, error: impl Debug + Display, keychain: bool) -> UserError {
        let status = keychain.then(|| os_status(&format!("{error:?}"))).flatten();
        match status {
            Some(status) if STALE_APP_STATUSES.contains(&status) => {
                UserError::new("credential.staleApp", "Fuyu has been updated; quit it and open it again.").detail(error)
            }
            _ => UserError::new(code, message).detail(error),
        }
    }

    fn os_status(debug: &str) -> Option<i32> {
        let rest = &debug[debug.find("code: ")? + "code: ".len()..];
        let end = rest.find(|c: char| c != '-' && !c.is_ascii_digit()).unwrap_or(rest.len());
        rest[..end].parse().ok()
    }

    #[cfg(test)]
    mod tests {
        use super::{failed, os_status};
        use std::fmt;

        struct KeychainError(i32);

        impl fmt::Debug for KeychainError {
            fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.debug_struct("Error").field("code", &self.0).field("message", &"UNIX[No such file or directory]").finish()
            }
        }

        impl fmt::Display for KeychainError {
            fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
                formatter.write_str("UNIX[No such file or directory]")
            }
        }

        impl std::error::Error for KeychainError {}

        fn platform_failure(status: i32) -> keyring::Error {
            keyring::Error::PlatformFailure(Box::new(KeychainError(status)))
        }

        #[test]
        fn the_status_comes_out_of_the_keyring_error() {
            assert_eq!(os_status(&format!("{:?}", platform_failure(100_002))), Some(100_002));
            assert_eq!(os_status(&format!("{:?}", platform_failure(-67_068))), Some(-67_068));
            assert_eq!(os_status("NoEntry"), None);
        }

        #[test]
        fn a_replaced_app_bundle_asks_for_a_restart_on_the_mac() {
            for status in [100_002, -67_068] {
                let error = failed("credential.save", "Could not save.".into(), platform_failure(status), true);
                assert_eq!(error.code(), "credential.staleApp");
            }
        }

        #[test]
        fn other_failures_keep_their_own_code() {
            assert_eq!(failed("credential.save", "x".into(), platform_failure(-25_293), true).code(), "credential.save");
            assert_eq!(failed("credential.read", "x".into(), platform_failure(100_002), false).code(), "credential.read");
            assert_eq!(failed("credential.open", "x".into(), keyring::Error::NoEntry, true).code(), "credential.open");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::UserError;
    use serde_json::json;

    #[test]
    fn the_page_gets_the_code_values_and_what_the_service_said() {
        let error = UserError::new("bark.status", "Bark answered an error.").arg("status", 500).detail("busy");
        assert_eq!(
            serde_json::to_value(&error).unwrap(),
            json!({ "code": "bark.status", "args": { "status": 500 }, "detail": "busy", "message": "Bark answered an error." })
        );
        assert_eq!(error.to_string(), "Bark answered an error: busy");
    }

    #[test]
    fn a_bare_message_has_no_args_or_detail() {
        let error = UserError::from("Something broke.").detail("  ");
        assert_eq!(serde_json::to_value(&error).unwrap(), json!({ "code": "plain", "message": "Something broke." }));
        assert_eq!(error.code(), "plain");
    }
}
