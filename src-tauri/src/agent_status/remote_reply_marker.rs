use super::super::remote_fetch::run_ssh;
use super::super::remote_hosts::SshTarget;
use super::super::reply_marker::{
    is_rules_file, with_block, without_block, BLOCK_START_PREFIX, LEGACY_BLOCK_START_PREFIX, LEGACY_RULES_FILE, RULES_FILE,
};
use super::write_script_at;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Change {
    Enable,
    Disable,
    Repair,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum Found {
    Home(String),
    File { target: String, text: String },
    Broken { path: String, link: String },
    OldRules(String),
}

#[derive(Debug, Default, PartialEq, Eq)]
struct Plan {
    writes: Vec<(String, String)>,
    remove: Vec<String>,
    errors: Vec<String>,
}

fn list_script() -> String {
    format!(
        "printf 'H\\t%s\\n' \"$HOME\"\n\
         p() {{ f=\"$1\"; d=$(dirname \"$f\"); \
         if [ -L \"$f\" ] && [ ! -e \"$f\" ]; then printf 'B\\t%s\\t%s\\n' \"$f\" \"$(readlink \"$f\")\"; return; fi; \
         if [ -e \"$f\" ]; then t=$(readlink -f \"$f\"); elif [ -d \"$d\" ]; then t=\"$(readlink -f \"$d\")/$(basename \"$f\")\"; else return; fi; \
         [ -n \"$t\" ] || t=\"$f\"; n=0; [ -f \"$t\" ] && n=$(wc -c < \"$t\" | tr -d ' '); \
         printf 'F\\t%s\\t%s\\n' \"$t\" \"$n\"; [ \"$n\" = 0 ] || cat \"$t\"; }}\n\
         case \"$CLAUDE_CONFIG_DIR\" in /*) p \"$CLAUDE_CONFIG_DIR/CLAUDE.md\" ;; *) p \"$HOME/.claude/CLAUDE.md\" ;; esac\n\
         case \"$CODEX_HOME\" in /*) p \"$CODEX_HOME/AGENTS.md\" ;; *) p \"$HOME/.codex/AGENTS.md\" ;; esac\n\
         [ -d \"$HOME/.gemini/antigravity-cli\" ] && p \"$HOME/.gemini/GEMINI.md\"\n\
         p \"$HOME/.dsh/AGENTS.md\"\n\
         p \"$HOME/.dsh-beta/AGENTS.md\"\n\
         case \"$DSH_HOME\" in /*) p \"$DSH_HOME/AGENTS.md\" ;; esac\n\
         for r in '{RULES_FILE}' '{LEGACY_RULES_FILE}'; do f=\"$HOME/.claude/$r\"; \
         grep -qF -e '{BLOCK_START_PREFIX}' -e '{LEGACY_BLOCK_START_PREFIX}' \"$f\" 2>/dev/null && printf 'R\\t%s\\n' \"$f\"; done\n\
         exit 0\n"
    )
}

fn shown(path: &str, home: Option<&str>) -> String {
    match home.and_then(|home| path.strip_prefix(home)) {
        Some(rest) if rest.starts_with('/') => format!("~{rest}"),
        _ => path.to_string(),
    }
}

fn parse(bytes: &[u8]) -> Result<Vec<Found>, String> {
    let mut found = Vec::new();
    let mut rest = bytes;
    while !rest.is_empty() {
        let end = rest.iter().position(|byte| *byte == b'\n').ok_or("The listing ended early")?;
        let line = String::from_utf8_lossy(&rest[..end]).into_owned();
        rest = &rest[end + 1..];
        let fields: Vec<&str> = line.split('\t').collect();
        match fields.as_slice() {
            ["B", path, link] => found.push(Found::Broken { path: path.to_string(), link: link.to_string() }),
            ["H", home] => found.push(Found::Home(home.to_string())),
            ["R", path] => found.push(Found::OldRules(path.to_string())),
            ["F", target, size] => {
                let size: usize = size.parse().map_err(|_| format!("Unexpected line in the listing: {line}"))?;
                let body = rest.get(..size).ok_or("The listing ended early")?;
                rest = &rest[size..];
                let text = String::from_utf8(body.to_vec()).map_err(|_| format!("{target} is not UTF-8"))?;
                found.push(Found::File { target: target.to_string(), text });
            }
            _ => return Err(format!("Unexpected line in the listing: {line}")),
        }
    }
    Ok(found)
}

fn plan(found: &[Found], change: Change) -> Plan {
    let mut plan = Plan::default();
    let mut files: Vec<(&str, &str)> = Vec::new();
    for item in found {
        match item {
            Found::File { target, text } if !files.iter().any(|(seen, _)| seen == target) => files.push((target, text)),
            Found::File { .. } => {}
            Found::Broken { path, link } => plan.errors.push(format!("{path} is a link to {link}, which does not exist")),
            Found::OldRules(path) => plan.remove.push(path.clone()),
            Found::Home(_) => {}
        }
    }
    let enable = match change {
        Change::Enable => true,
        Change::Disable => false,
        Change::Repair if !plan.remove.is_empty() || files.iter().any(|(_, text)| is_rules_file(text)) => true,
        Change::Repair => return Plan { errors: plan.errors, ..Plan::default() },
    };
    for (target, text) in files {
        let next = if enable { with_block(text) } else { without_block(text) };
        if next != text {
            plan.writes.push((target.to_string(), next));
        }
    }
    plan
}

fn quoted(text: &str) -> String {
    format!("'{}'", text.replace('\'', "'\\''"))
}

pub(super) fn sync(target: &SshTarget, change: Change) -> Result<(), String> {
    let found = parse(&run_ssh(target, &list_script())?)?;
    let home = found.iter().find_map(|item| match item {
        Found::Home(home) if home.starts_with('/') => Some(home.as_str()),
        _ => None,
    });
    let plan = plan(&found, change);
    let mut errors: Vec<String> = plan.errors.iter().map(|error| shown(error, home)).collect();
    for (path, text) in &plan.writes {
        if let Err(error) = write_script_at(&quoted(path), &shown(path, home), text).and_then(|script| run_ssh(target, &script)) {
            errors.push(error);
        }
    }
    if !plan.remove.is_empty() {
        let paths: Vec<String> = plan.remove.iter().map(|path| quoted(path)).collect();
        if let Err(error) = run_ssh(target, &format!("rm -f {}\n", paths.join(" "))) {
            errors.push(error);
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("; "))
    }
}

#[cfg(test)]
#[path = "remote_reply_marker_tests.rs"]
mod tests;
