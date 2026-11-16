use std::collections::{BTreeMap, BTreeSet};

use serde_json::{Map, Number, Value};

use super::{items, join, lines, newline, shape, Item, Line, Shape, ID};

const CONFIG: &str = "config";
const INDENT: &str = "    ";

struct Block {
    row: usize,
    end: usize,
    inline_empty: bool,
    entries: Vec<(String, usize, String)>,
}

fn entry(text: &str) -> Option<(String, String)> {
    let inner = text.strip_prefix(INDENT).filter(|inner| !inner.starts_with(' ') && !inner.starts_with('#'))?;
    let (key, rest) = inner.split_once(':')?;
    if key.is_empty() || !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return None;
    }
    if !(rest.is_empty() || rest.starts_with(' ')) {
        return None;
    }
    Some((key.to_owned(), rest.trim().to_owned()))
}

fn block(rows: &[Line<'_>], item: &Item) -> Result<Option<Block>, ()> {
    let Some((_, row, value)) = item.get(CONFIG) else { return Ok(None) };
    let row = *row;
    if row == item.start {
        return Err(());
    }
    let inline_empty = match value.as_str() {
        "" => false,
        "{}" => true,
        _ => return Err(()),
    };
    let mut end = row;
    let mut entries = Vec::new();
    for (at, line) in rows.iter().enumerate().take(item.end + 1).skip(row + 1) {
        let text = line.text;
        if text.trim().is_empty() {
            continue;
        }
        if !text.starts_with(INDENT) {
            break;
        }
        end = at;
        if let Some((key, raw)) = entry(text) {
            entries.push((key, at, raw));
        }
    }
    if inline_empty && end != row {
        return Err(());
    }
    Ok(Some(Block { row, end, inline_empty, entries }))
}

fn scalar(raw: &str) -> Option<Value> {
    if raw.starts_with('"') {
        return serde_json::Deserializer::from_str(raw).into_iter::<String>().next()?.ok().map(Value::String);
    }
    if let Some(rest) = raw.strip_prefix('\'') {
        return rest.find('\'').map(|end| Value::String(rest[..end].to_owned()));
    }
    let plain = raw.split(" #").next().unwrap_or(raw).trim();
    if plain.is_empty() || plain.starts_with(['[', '{', '&', '*', '!', '|', '>']) || matches!(plain, "~" | "null" | "Null" | "NULL") {
        return None;
    }
    Some(match plain {
        "true" | "True" | "TRUE" => Value::Bool(true),
        "false" | "False" | "FALSE" => Value::Bool(false),
        _ => plain
            .parse::<i64>()
            .map(Value::from)
            .ok()
            .or_else(|| plain.parse::<f64>().ok().and_then(Number::from_f64).map(Value::Number))
            .unwrap_or_else(|| Value::String(plain.to_owned())),
    })
}

pub(crate) fn format_scalar(value: &Value) -> Result<String, String> {
    match value {
        Value::Bool(flag) => Ok(flag.to_string()),
        Value::Number(number) => Ok(number.to_string()),
        Value::String(text) => serde_json::to_string(text).map_err(|error| error.to_string()),
        _ => Err("a built-in plugin's config value must be true, false, a number or a string".into()),
    }
}

pub(crate) fn valid_key(key: &str) -> bool {
    !key.is_empty() && key.len() <= 64 && key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
}

pub(crate) fn configs(text: &str) -> BTreeMap<String, Map<String, Value>> {
    if shape(text) != Shape::Block {
        return BTreeMap::new();
    }
    let rows = lines(text);
    let mut found = BTreeMap::new();
    for item in items(&rows) {
        let (Some(id), Ok(Some(block))) = (item.id(), block(&rows, &item)) else { continue };
        let values: Map<String, Value> = block.entries.iter().filter_map(|(key, _, raw)| scalar(raw).map(|value| (key.clone(), value))).collect();
        if !values.is_empty() {
            found.insert(id.to_owned(), values);
        }
    }
    found
}

fn ended(out: &mut [(String, String)], at: usize, eol: &str) {
    if out[at].1.is_empty() {
        out[at].1 = eol.to_owned();
    }
}

fn appended(text: &str, id: &str, line: String) -> String {
    let eol = newline(text);
    let rows = lines(text);
    let mut out: Vec<(String, String)> = rows.iter().filter(|row| row.text.trim() != "[]").map(|row| (row.text.to_owned(), row.ending.to_owned())).collect();
    if let Some(last) = out.len().checked_sub(1) {
        ended(&mut out, last, eol);
    }
    for row in [format!("- {ID}: {id}"), format!("  {CONFIG}:"), line] {
        out.push((row, eol.to_owned()));
    }
    join(&out)
}

pub(crate) fn set_config(text: &str, id: &str, key: &str, value: Option<&Value>) -> Result<String, String> {
    if !valid_key(key) {
        return Err(format!("{key} cannot be a config key"));
    }
    let eol = newline(text);
    let line = value.map(|value| format_scalar(value).map(|formatted| format!("{INDENT}{key}: {formatted}"))).transpose()?;
    let found = match shape(text) {
        Shape::Other => return Err(format!("plugins.yml is not a plain list of entries, so Fuyu will not rewrite it to change the config of {id}")),
        Shape::Empty => None,
        Shape::Block => {
            let rows = lines(text);
            items(&rows).into_iter().find(|item| item.id() == Some(id))
        }
    };
    let Some(item) = found else {
        return Ok(match line {
            Some(line) => appended(text, id, line),
            None => text.to_owned(),
        });
    };
    let rows = lines(text);
    let refused = || format!("the config of {id} in plugins.yml is not a plain list of keys, so Fuyu will not rewrite it");
    let config = block(&rows, &item).map_err(|()| refused())?;
    let mut out: Vec<(String, String)> = rows.iter().map(|row| (row.text.to_owned(), row.ending.to_owned())).collect();
    match (config, line) {
        (None, None) => Ok(text.to_owned()),
        (None, Some(line)) => {
            ended(&mut out, item.end, eol);
            out.splice(item.end + 1..item.end + 1, [(format!("  {CONFIG}:"), eol.to_owned()), (line, eol.to_owned())]);
            Ok(join(&out))
        }
        (Some(config), Some(line)) => {
            match config.entries.iter().find(|(name, ..)| name == key) {
                Some((_, _, raw)) if raw.is_empty() => return Err(refused()),
                Some((_, row, _)) => out[*row].0 = line,
                None if config.inline_empty => {
                    out[config.row].0 = format!("  {CONFIG}:");
                    ended(&mut out, config.row, eol);
                    out.insert(config.row + 1, (line, eol.to_owned()));
                }
                None => {
                    ended(&mut out, config.end, eol);
                    out.insert(config.end + 1, (line, eol.to_owned()));
                }
            }
            Ok(join(&out))
        }
        (Some(config), None) => {
            let Some((_, row, _)) = config.entries.iter().find(|(name, ..)| name == key) else { return Ok(text.to_owned()) };
            let mut removed = BTreeSet::from([*row]);
            let rest = (config.row + 1..=config.end).any(|at| at != *row && !rows[at].text.trim().is_empty());
            if !rest {
                removed.insert(config.row);
            }
            let id_row = item.get(ID).map(|(_, at, _)| *at);
            let left: Vec<usize> = (item.start..=item.end).filter(|at| !removed.contains(at) && !rows[*at].text.trim().is_empty()).collect();
            if left.as_slice() == [item.start] && id_row == Some(item.start) {
                removed.extend(item.start..=item.end);
            }
            let kept: Vec<(String, String)> = out.into_iter().enumerate().filter(|(at, _)| !removed.contains(at)).map(|(_, row)| row).collect();
            let joined = join(&kept);
            if shape(&joined) == Shape::Empty && !joined.lines().any(|row| row.trim() == "[]") {
                return Ok(format!("{joined}[]{eol}"));
            }
            Ok(joined)
        }
    }
}

#[cfg(test)]
#[path = "builtins_config_tests.rs"]
mod tests;
