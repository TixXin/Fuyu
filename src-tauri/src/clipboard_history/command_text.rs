fn without_prompt(line: &str) -> &str {
    let trimmed = line.trim_start();
    for prefix in ["$ ", "> "] {
        if let Some(rest) = trimmed.strip_prefix(prefix) {
            return rest.trim_start();
        }
    }
    let windows_prompt = trimmed.starts_with("PS ") || (trimmed.len() > 2 && trimmed.as_bytes()[1] == b':' && trimmed.as_bytes()[2] == b'\\');
    if windows_prompt {
        if let Some(index) = trimmed.find("> ") {
            return trimmed[index + 2..].trim_start();
        }
    }
    line
}

fn continuation(line: &str) -> (&str, bool) {
    let trimmed = line.trim_end();
    for mark in ['\\', '`', '^'] {
        if let Some(rest) = trimmed.strip_suffix(mark) {
            if rest.ends_with(char::is_whitespace) {
                return (rest.trim_end(), true);
            }
        }
    }
    (trimmed, false)
}

pub(super) fn looks_like_split_command(text: &str) -> bool {
    let lines: Vec<&str> = text.trim().lines().collect();
    (2..=30).contains(&lines.len()) && lines[..lines.len() - 1].iter().any(|line| continuation(line).1)
}

pub(super) fn flatten_command(text: &str) -> String {
    let mut out = String::new();
    let mut carry = true;
    for line in text.lines().map(without_prompt).filter(|line| !line.trim().is_empty()) {
        let (body, continued) = continuation(line);
        let joins = carry || line.starts_with(char::is_whitespace) || line.starts_with(['-', '|', '&']);
        if !out.is_empty() {
            out.push_str(if joins { " " } else { " && " });
        }
        out.push_str(body.trim());
        carry = continued;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::{flatten_command, looks_like_split_command};

    #[test]
    fn split_commands_become_one_line() {
        assert_eq!(flatten_command("cargo test \\\n  --quiet"), "cargo test --quiet");
        assert_eq!(flatten_command("$ cd app\n$ pnpm install"), "cd app && pnpm install");
        assert_eq!(flatten_command("PS D:\\repo> Get-Item a `\n  -Force"), "Get-Item a -Force");
        assert!(looks_like_split_command("a \\\nb"));
        assert!(!looks_like_split_command("first line\nsecond line"));
    }
}
