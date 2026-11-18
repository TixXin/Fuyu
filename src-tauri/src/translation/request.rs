use reqwest::Url;
use serde::Serialize;
use std::time::Duration;

use super::provider::{completions_url, find_provider, is_loopback_url, parse_completion, resolve_model, Provider};
use super::{address, read_secret, stream};
use crate::user_error::UserError;

pub(super) type Pieces<'a> = &'a (dyn Fn(String) -> bool + Send + Sync);

#[derive(Debug, Clone, PartialEq, Serialize)]
#[cfg_attr(test, derive(ts_rs::TS))]
pub(crate) struct Translated {
    pub(super) text: String,
    pub(super) engine: &'static str,
}

pub(super) fn resolve_secret(
    provider: &Provider,
    endpoint: &Url,
    read: impl FnOnce(&Provider) -> Result<Option<String>, UserError>,
) -> Result<Option<String>, UserError> {
    let secret = read(provider)?.and_then(|value| {
        let trimmed = value.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_owned())
    });
    if secret.is_some() || (provider.id == "custom" && is_loopback_url(endpoint)) {
        return Ok(secret);
    }
    let name = provider.name;
    Err(UserError::new("translation.noKey", format!("Set up the API key for {name} first.")).arg("service", name))
}

pub(super) async fn complete(
    instruction: &str,
    text: &str,
    provider: Option<&str>,
    base_url: Option<&str>,
    model: Option<&str>,
    on_chunk: Option<Pieces<'_>>,
) -> Result<Translated, UserError> {
    let provider = find_provider(provider)?;
    let base_url = address::stored_or(provider, base_url, address::read)?;
    let endpoint = completions_url(provider, base_url.as_deref())?;
    let model = resolve_model(provider, model)?;
    let secret = resolve_secret(provider, &endpoint, read_secret)?;
    request(provider, endpoint, &model, secret.as_deref(), instruction, text, on_chunk).await
}

pub(super) async fn request(
    provider: &Provider,
    endpoint: Url,
    model: &str,
    secret: Option<&str>,
    instruction: &str,
    text: &str,
    on_chunk: Option<Pieces<'_>>,
) -> Result<Translated, UserError> {
    let name = provider.name;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| UserError::new("http.client", "Could not set up the connection.").detail(error))?;

    let mut builder = client.post(endpoint);
    if let Some(secret) = secret.map(str::trim).filter(|secret| !secret.is_empty()) {
        builder = builder.bearer_auth(secret);
    }
    let response = builder
        .json(&serde_json::json!({
            "model": model,
            "stream": on_chunk.is_some(),
            "messages": [
                {"role":"system","content":instruction},
                {"role":"user","content":text}
            ]
        }))
        .send()
        .await
        .map_err(|error| UserError::new("net.unreachable", format!("Could not reach {name}.")).arg("service", name).detail(error))?;
    if !response.status().is_success() {
        let status = response.status().as_u16();
        return Err(UserError::new("translation.status", format!("{name} answered HTTP {status}; check the key, the model name or the quota."))
            .arg("service", name)
            .arg("status", status));
    }
    let streamed = response.headers().get(reqwest::header::CONTENT_TYPE).and_then(|value| value.to_str().ok()).is_some_and(|kind| kind.starts_with("text/event-stream"));
    let text = if let (Some(on_chunk), true) = (on_chunk, streamed) {
        stream::read(response, provider, on_chunk).await?
    } else {
        let result: serde_json::Value = response
            .json()
            .await
            .map_err(|error| UserError::new("net.unreadable", format!("Could not read {name}'s answer.")).arg("service", name).detail(error))?;
        parse_completion(provider, &result)?
    };
    Ok(Translated { text, engine: provider.id })
}
