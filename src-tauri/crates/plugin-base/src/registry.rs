use std::{collections::HashMap, time::Duration};

use serde_json::{json, Value};

use crate::serve::{Call, Serve, ServeError};

pub type HandlerFn = fn(Value, &Call) -> Result<Value, ServeError>;

pub struct Registration {
    pub name: &'static str,
    pub timeout_ms: Option<u64>,
    pub handler: HandlerFn,
    pub function: &'static str,
    pub file: &'static str,
    pub line: u32,
}

impl Registration {
    pub const fn new(name: &'static str, timeout_ms: Option<u64>, handler: HandlerFn, function: &'static str, file: &'static str, line: u32) -> Self {
        Self { name, timeout_ms, handler, function, file, line }
    }

    pub fn origin(&self) -> String {
        format!("{} ({}:{})", self.function, self.file, self.line)
    }
}

inventory::collect!(Registration);

pub fn registrations() -> Vec<&'static Registration> {
    let mut all: Vec<&'static Registration> = inventory::iter::<Registration>.into_iter().collect();
    all.sort_by(|a, b| (a.name, a.function).cmp(&(b.name, b.function)));
    all
}

pub fn duplicates(registrations: &[&Registration]) -> Vec<String> {
    let mut first: HashMap<&str, &Registration> = HashMap::new();
    let mut found = Vec::new();
    for registration in registrations {
        match first.get(registration.name) {
            Some(earlier) => found.push(format!("the Rust method {} is registered twice: {} and {}", registration.name, earlier.origin(), registration.origin())),
            None => {
                first.insert(registration.name, registration);
            }
        }
    }
    found
}

impl Serve {
    pub fn registered() -> Result<Self, String> {
        let mut serve = Self::new();
        serve.add_registered()?;
        Ok(serve)
    }

    pub fn add_registered(&mut self) -> Result<&mut Self, String> {
        let all = registrations();
        let problems = duplicates(&all);
        if !problems.is_empty() {
            return Err(problems.join("; "));
        }
        for registration in all {
            let timeout = registration.timeout_ms.map_or(crate::serve::DEFAULT_TIMEOUT, Duration::from_millis);
            let handler = registration.handler;
            self.add_from(registration.name, timeout, &registration.origin(), handler)?;
        }
        Ok(self)
    }
}

pub trait ServiceFailure {
    fn into_serve_error(self) -> ServeError;
}

impl ServiceFailure for ServeError {
    fn into_serve_error(self) -> ServeError {
        self
    }
}

impl ServiceFailure for String {
    fn into_serve_error(self) -> ServeError {
        ServeError::new("failed", self)
    }
}

impl ServiceFailure for &str {
    fn into_serve_error(self) -> ServeError {
        ServeError::new("failed", self)
    }
}

impl ServiceFailure for Box<dyn std::error::Error + Send + Sync> {
    fn into_serve_error(self) -> ServeError {
        ServeError::new("failed", self.to_string())
    }
}

#[doc(hidden)]
pub mod __private {
    pub use inventory;
    pub use serde_json::{Map, Value};

    use super::{json, ServeError};

    pub fn params_object(params: Value, method: &str) -> Result<Map<String, Value>, ServeError> {
        match params {
            Value::Null => Ok(Map::new()),
            Value::Object(object) => Ok(object),
            other => Err(ServeError::new("bad-params", format!("{method} takes its parameters as a JSON object, not {other}")).with_data(json!({ "method": method }))),
        }
    }

    pub fn field<T: serde::de::DeserializeOwned>(object: &mut Map<String, Value>, key: &str, method: &str) -> Result<T, ServeError> {
        let value = object.remove(key).unwrap_or(Value::Null);
        serde_json::from_value(value).map_err(|error| ServeError::new("bad-params", format!("{method}: {key}: {error}")).with_data(json!({ "method": method, "field": key })))
    }

    pub fn encode<T: serde::Serialize>(value: T, method: &str) -> Result<Value, ServeError> {
        serde_json::to_value(value).map_err(|error| ServeError::new("bad-result", format!("{method} returned something that is not JSON: {error}")).with_data(json!({ "method": method })))
    }
}
