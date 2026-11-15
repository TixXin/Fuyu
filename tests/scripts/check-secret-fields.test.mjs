import assert from "node:assert/strict";
import { test } from "node:test";
import { compare, findSecretFields, isSecretName, isStringType } from "../../scripts/check-secret-fields.mjs";

const names = (source) => findSecretFields(source).map(({ type, field }) => `${type}.${field}`);

test("field names are split on underscores before matching", () => {
  for (const name of ["token", "access_token", "api_key", "apikey", "private_key", "device_key", "authorization", "cookies", "credentials", "r#password", "smtp_passwd", "client_secret"]) {
    assert.ok(isSecretName(name), name);
  }
  for (const name of ["tokenizer", "api", "key", "key_api", "secretary", "device", "properties_id"]) {
    assert.equal(isSecretName(name), false, name);
  }
});

test("string-like types are flagged, numbers and bools are not", () => {
  for (const type of ["String", "Option<String>", "Vec<String>", "serde_json::Value", "Value", "&'a str", "Option<&str>", "Box<str>", "std::sync::Arc<String>"]) {
    assert.ok(isStringType(type), type);
  }
  for (const type of ["bool", "u64", "Option<u64>", "HashMap<String, String>", "SecretHandling", "Vec<u8>"]) {
    assert.equal(isStringType(type), false, type);
  }
});

test("serialized structs with secret-looking string fields are reported", () => {
  const source = [
    "#[derive(Debug, Clone,",
    "    Serialize)]",
    "#[serde(rename_all = \"camelCase\")]",
    "pub(crate) struct Connection<'a> {",
    "    pub port: u16,",
    "    pub token: Option<String>,",
    "    api_key: &'a str,",
    "    secret: bool,",
    "    context_tokens: Option<u64>,",
    "    #[serde(skip)]",
    "    password: String,",
    "    #[serde(rename = \"x\", skip_serializing)]",
    "    cookie: String,",
    "    #[serde(skip_serializing_if = \"Option::is_none\")]",
    "    device_key: Option<String>,",
    "}",
  ].join("\n");
  assert.deepEqual(names(source), ["Connection.token", "Connection.api_key", "Connection.device_key"]);
  assert.equal(findSecretFields(source)[0].line, 6);
});

test("structs without Serialize, tuple structs and test modules are ignored", () => {
  const source = [
    "#[derive(Deserialize)]",
    "struct Incoming { token: String }",
    "struct Plain { secret: String }",
    "#[derive(Serialize)]",
    "struct Wrapped(String);",
    "#[cfg(test)]",
    "mod tests {",
    "    #[derive(Serialize)]",
    "    struct Fixture { token: String }",
    "}",
  ].join("\n");
  assert.deepEqual(names(source), []);
});

test("enum struct variants are checked and braces in strings do not confuse the parser", () => {
  const source = [
    "#[derive(Serialize)]",
    "#[serde(tag = \"kind\")]",
    "enum Event {",
    "    Ready { port: u16, auth_token: String },",
    "    Message(String),",
    "    #[serde(skip)]",
    "    Hidden { secret: String },",
    "}",
    "const BRACE: &str = \"}{ struct Fake {\";",
    "// #[derive(Serialize)] struct Commented { token: String }",
    "#[derive(serde::Serialize)]",
    "pub struct After { cookie: serde_json::Value }",
  ].join("\n");
  assert.deepEqual(names(source), ["Event::Ready.auth_token", "After.cookie"]);
});

test("the allowlist must cover every finding, carry a reason and drop stale entries", () => {
  const finding = { file: "a.rs", type: "A", field: "token", line: 3, fieldType: "String" };
  const entry = { file: "a.rs", type: "A", field: "token", reason: "only written to a file" };
  assert.deepEqual(compare([finding], [entry]), []);
  assert.match(compare([finding], [])[0], /a\.rs:3 A\.token/);
  assert.match(compare([], [entry])[0], /删除/);
  assert.match(compare([finding], [{ ...entry, reason: " " }])[0], /reason/);
});
