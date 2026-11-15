use reqwest::Url;
use std::time::Duration;

use super::provider::{completions_url, find_provider, parse_completion, resolve_model, Provider};
use super::{read_secret, stream};
use crate::user_error::UserError;

pub(super) type Pieces<'a> = &'a (dyn Fn(String) + Send + Sync);

pub(super) async fn complete(
    instruction: &str,
    text: &str,
    provider: Option<&str>,
    base_url: Option<&str>,
    model: Option<&str>,
    on_chunk: Option<Pieces<'_>>,
) -> Result<String, UserError> {
    let provider = find_provider(provider)?;
    let endpoint = completions_url(provider, base_url)?;
    let model = resolve_model(provider, model)?;
    let name = provider.name;
    let secret = read_secret(provider)?.ok_or_else(|| UserError::new("translation.noKey", format!("Set up the API key for {name} first.")).arg("service", name))?;
    request(provider, endpoint, &model, &secret, instruction, text, on_chunk).await
}

pub(super) async fn request(
    provider: &Provider,
    endpoint: Url,
    model: &str,
    secret: &str,
    instruction: &str,
    text: &str,
    on_chunk: Option<Pieces<'_>>,
) -> Result<String, UserError> {
    let name = provider.name;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|error| UserError::new("http.client", "Could not set up the connection.").detail(error))?;

    let response = client
        .post(endpoint)
        .bearer_auth(secret)
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
    if let (Some(on_chunk), true) = (on_chunk, streamed) {
        return stream::read(response, provider, on_chunk).await;
    }
    let result: serde_json::Value = response
        .json()
        .await
        .map_err(|error| UserError::new("net.unreadable", format!("Could not read {name}'s answer.")).arg("service", name).detail(error))?;
    parse_completion(provider, &result)
}
