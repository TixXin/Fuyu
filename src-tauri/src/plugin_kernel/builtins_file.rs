use std::collections::BTreeSet;

#[path = "builtins_config.rs"]
mod config;

pub(crate) use config::{configs, format_scalar, set_config, valid_key};

const DISABLED: &str = "disabled";
const ID: &str = "id";

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum Shape {
    Empty,
    Block,
    Other,
}

struct Line<'a> {
    text: &'a str,
    ending: &'a str,
}

fn lines(text: &str) -> Vec<Line<'_>> {
    text.split_inclusive('\n')
        .map(|raw| {
            let body = raw.strip_suffix('\n').unwrap_or(raw);
            match body.strip_suffix('\r') {
                Some(text) => Line { text, ending: &raw[text.len()..] },
                None => Line { text: body, ending: &raw[body.len()..] },
            }
        })
        .collect()
}

fn ignorable(text: &str) -> bool {
    let trimmed = text.trim();
    trimmed.is_empty() || trimmed.starts_with('#')
}

fn item_start(text: &str) -> Option<&str> {
    if text == "-" {
        return Some("");
    }
    text.strip_prefix("- ")
}

pub(crate) fn shape(text: &str) -> Shape {
    let meaningful: Vec<&str> = lines(text).into_iter().map(|line| line.text).filter(|text| !ignorable(text)).collect();
    match meaningful.as_slice() {
        [] => Shape::Empty,
        [only] if only.trim() == "[]" => Shape::Empty,
        rows if rows.iter().all(|row| row.starts_with(' ') || item_start(row).is_some()) && item_start(rows[0]).is_some() => Shape::Block,
        _ => Shape::Other,
    }
}

#[derive(Debug, Clone, PartialEq)]
struct Item {
    start: usize,
    end: usize,
    keys: Vec<(String, usize, String)>,
}

fn key_value(text: &str) -> Option<(String, String)> {
    let (key, rest) = text.split_once(':')?;
    if key.is_empty() || !key.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-') {
        return None;
    }
    if !(rest.is_empty() || rest.starts_with(' ')) {
        return None;
    }
    let value = match rest.find(" #") {
        Some(at) => &rest[..at],
        None => rest,
    };
    Some((key.to_owned(), unquote(value.trim()).to_owned()))
}

fn unquote(value: &str) -> &str {
    for quote in ['\'', '"'] {
        if let Some(inner) = value.strip_prefix(quote).and_then(|rest| rest.strip_suffix(quote)) {
            return inner;
        }
    }
    value
}

fn items(rows: &[Line<'_>]) -> Vec<Item> {
    let mut found = Vec::new();
    let mut at = 0;
    while at < rows.len() {
        let Some(first) = item_start(rows[at].text) else {
            at += 1;
            continue;
        };
        let mut keys = Vec::new();
        if let Some((key, value)) = key_value(first) {
            keys.push((key, at, value));
        }
        let mut end = at;
        let mut next = at + 1;
        while next < rows.len() && (rows[next].text.starts_with(' ') || rows[next].text.trim().is_empty()) {
            let text = rows[next].text;
            if !text.trim().is_empty() {
                end = next;
                if let Some(inner) = text.strip_prefix("  ").filter(|inner| !inner.starts_with(' ') && !inner.starts_with('#')) {
                    if let Some((key, value)) = key_value(inner) {
                        keys.push((key, next, value));
                    }
                }
            }
            next += 1;
        }
        found.push(Item { start: at, end, keys });
        at = end + 1;
    }
    found
}

impl Item {
    fn get(&self, key: &str) -> Option<&(String, usize, String)> {
        self.keys.iter().find(|(name, ..)| name == key)
    }

    fn id(&self) -> Option<&str> {
        self.get(ID).map(|(_, _, value)| value.as_str())
    }
}

fn truthy(value: &str) -> bool {
    matches!(value, "true" | "True" | "TRUE")
}

pub(crate) fn disabled_ids(text: &str) -> BTreeSet<String> {
    if shape(text) != Shape::Block {
        return BTreeSet::new();
    }
    let rows = lines(text);
    items(&rows)
        .into_iter()
        .filter(|item| item.get(DISABLED).is_some_and(|(_, _, value)| truthy(value)))
        .filter_map(|item| item.id().map(str::to_owned))
        .collect()
}

fn newline(text: &str) -> &'static str {
    if text.contains("\r\n") {
        "\r\n"
    } else {
        "\n"
    }
}

fn join(rows: &[(String, String)]) -> String {
    rows.iter().map(|(text, ending)| format!("{text}{ending}")).collect()
}

pub(crate) fn set_disabled(text: &str, id: &str, disabled: bool) -> Result<String, String> {
    let eol = newline(text);
    let entry = [format!("- {ID}: {id}"), format!("  {DISABLED}: true")];
    match shape(text) {
        Shape::Other => return Err(format!("plugins.yml is not a plain list of entries, so Fuyu will not rewrite it to switch {id}")),
        Shape::Empty if !disabled => return Ok(text.to_owned()),
        Shape::Empty => {
            let kept: Vec<Line<'_>> = lines(text).into_iter().filter(|line| line.text.trim() != "[]").collect();
            let mut out: Vec<(String, String)> = kept.iter().map(|line| (line.text.to_owned(), line.ending.to_owned())).collect();
            if let Some(last) = out.last_mut().filter(|last| last.1.is_empty()) {
                last.1 = eol.to_owned();
            }
            out.extend(entry.iter().map(|line| (line.clone(), eol.to_owned())));
            return Ok(join(&out));
        }
        Shape::Block => {}
    }
    let rows = lines(text);
    let mut out: Vec<(String, String)> = rows.iter().map(|line| (line.text.to_owned(), line.ending.to_owned())).collect();
    let found = items(&rows).into_iter().find(|item| item.id() == Some(id));
    match (found, disabled) {
        (None, false) => Ok(text.to_owned()),
        (None, true) => {
            if let Some(last) = out.last_mut().filter(|last| last.1.is_empty()) {
                last.1 = eol.to_owned();
            }
            out.extend(entry.iter().map(|line| (line.clone(), eol.to_owned())));
            Ok(join(&out))
        }
        (Some(item), true) => {
            match item.get(DISABLED) {
                Some((_, _, value)) if truthy(value) => {}
                Some((_, row, _)) => {
                    let prefix = if *row == item.start { "- " } else { "  " };
                    out[*row].0 = format!("{prefix}{DISABLED}: true");
                }
                None => {
                    if out[item.end].1.is_empty() {
                        out[item.end].1 = eol.to_owned();
                    }
                    out.insert(item.end + 1, (format!("  {DISABLED}: true"), eol.to_owned()));
                }
            }
            Ok(join(&out))
        }
        (Some(item), false) => {
            let Some((_, row, _)) = item.get(DISABLED) else { return Ok(text.to_owned()) };
            let row = *row;
            let only_id = item.keys.len() == 2 && item.id().is_some() && (item.start..=item.end).all(|at| at == row || item.keys.iter().any(|(_, line, _)| *line == at) || rows[at].text.trim().is_empty());
            if only_id {
                out.drain(item.start..=item.end);
            } else if row == item.start {
                out[row].0 = format!("- {DISABLED}: false");
            } else {
                out.remove(row);
            }
            let joined = join(&out);
            if shape(&joined) == Shape::Empty && !joined.lines().any(|line| line.trim() == "[]") {
                return Ok(format!("{joined}[]{eol}"));
            }
            Ok(joined)
        }
    }
}

#[cfg(test)]
#[path = "builtins_file_tests.rs"]
mod tests;
