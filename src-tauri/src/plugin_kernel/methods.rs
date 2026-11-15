use std::time::Duration;

use plugin_base::Serve;
use serde_json::json;

const QUICK: Duration = Duration::from_secs(5);

pub(crate) fn table(version: String) -> Result<Serve, String> {
    let mut serve = Serve::new();
    serve.add("app.version", QUICK, move |_, _| Ok(json!({ "version": version, "platform": std::env::consts::OS })))?;
    serve.add("app.echo", QUICK, |params, _| Ok(json!({ "echo": params })))?;
    Ok(serve)
}
