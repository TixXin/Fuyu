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

    pub(crate) fn open(error: impl std::fmt::Display) -> UserError {
        UserError::new("credential.open", "Could not open Windows Credential Manager.").detail(error)
    }

    pub(crate) fn read(error: impl std::fmt::Display) -> UserError {
        UserError::new("credential.read", "Could not read from Windows Credential Manager.").detail(error)
    }

    pub(crate) fn save(error: impl std::fmt::Display) -> UserError {
        UserError::new("credential.save", "Could not save to Windows Credential Manager.").detail(error)
    }

    pub(crate) fn delete(error: impl std::fmt::Display) -> UserError {
        UserError::new("credential.delete", "Could not delete from Windows Credential Manager.").detail(error)
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
