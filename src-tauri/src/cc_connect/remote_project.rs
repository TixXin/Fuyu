use super::{
    config_file::{self, NewProject, FILE_NAME},
    script::{base64_word, decode, sh_quote, tilde},
};
use crate::user_error::UserError;

pub(super) struct Seen {
    pub(super) work_dir: Option<String>,
    pub(super) config: Option<(String, String)>,
}

pub(super) fn read_script(work_dir: &str) -> String {
    let mut script = format!("w={}\n", sh_quote(work_dir));
    script.push_str(&tilde("w"));
    script.push_str(&format!(
        r#"case $w in /*) [ -d "$w" ] && printf 'W %s\n' "$w" ;; esac
c="$HOME/.cc-connect/{FILE_NAME}"
if [ -f "$c" ]; then
  printf 'K %s\n' "$(cksum < "$c")"
  printf 'C %s\n' "$(base64 < "$c" | tr -d '\n')"
fi
exit 0
"#
    ));
    script
}

pub(super) fn parse_read(output: &str) -> Seen {
    let (mut work_dir, mut sum, mut text) = (None, None, None);
    for line in output.lines() {
        if let Some(dir) = line.strip_prefix("W ") {
            work_dir = Some(dir.to_string()).filter(|dir| dir.starts_with('/'));
        } else if let Some(value) = line.strip_prefix("K ") {
            sum = Some(value.trim().to_string());
        } else if let Some(value) = line.strip_prefix("C ") {
            text = decode(value);
        }
    }
    Seen { work_dir, config: sum.zip(text) }
}

pub(super) fn block_for(seen: &Seen, project: &NewProject, today: &str) -> Result<String, UserError> {
    if project.platform == "feishu" {
        return Err(UserError::new("ccConnect.remoteFeishu", "A Feishu bot on another computer is set up by scanning its code."));
    }
    let work_dir = seen.work_dir.as_deref().ok_or_else(|| config_file::work_dir_missing(project.work_dir))?;
    let taken = seen.config.as_ref().map(|(_, text)| config_file::project_names(text)).unwrap_or_default();
    config_file::check_fields(project, &taken)?;
    Ok(config_file::project_block(&NewProject { work_dir, proxy: None, ..*project }, today))
}

pub(super) fn write_script(seen: &Seen, name: &str, block: &str, stamp: &str) -> String {
    let before = seen.config.as_ref().map(|(sum, _)| sum.as_str()).unwrap_or_default();
    let mut script = format!("c=\"$HOME/.cc-connect/{FILE_NAME}\"\nb=\"$c.bak-fuyu-\"{}\n", sh_quote(stamp));
    script.push_str(&format!(
        r#"mkdir -p "$HOME/.cc-connect" || {{ echo 'FAILED mkdir'; exit 0; }}
now=
[ -f "$c" ] && now=$(cksum < "$c")
[ "$now" = {before} ] || {{ echo CHANGED; exit 0; }}
if [ -f "$c" ]; then cp -p "$c" "$b" || {{ echo 'FAILED backup'; exit 0; }}; else b=; fi
undo() {{
  if [ -n "$b" ]; then cp -p "$b" "$c"; else rm -f "$c"; fi
  rm -f "$c.fuyu.tmp"
  echo "FAILED $1"
  exit 0
}}
{{ if [ -f "$c" ]; then cat "$c"; else printf '%s\n' {header}; fi; printf '%s' {block} | base64 -d; }} > "$c.fuyu.tmp" || undo write
grep -qxF {name_line} "$c.fuyu.tmp" || undo check
chmod 600 "$c.fuyu.tmp" && mv -f "$c.fuyu.tmp" "$c" || undo move
[ -n "$b" ] && printf 'B %s\n' "$b"
echo OK
"#,
        before = sh_quote(before),
        header = sh_quote("# cc-connect configuration, started by Fuyu. `cc-connect config example` prints every option."),
        block = base64_word(block.as_bytes()),
        name_line = sh_quote(&format!("name = {}", config_file::toml_string(name))),
    ));
    script
}

pub(super) fn parse_write(host: &str, output: &str) -> Result<(), UserError> {
    for line in output.lines() {
        if line == "OK" {
            return Ok(());
        }
        if line == "CHANGED" {
            return Err(UserError::new("ccConnect.remoteChanged", format!("cc-connect's settings on {host} changed meanwhile; try again.")).arg("host", host));
        }
        if let Some(step) = line.strip_prefix("FAILED ") {
            return Err(write_failed(host).detail(step.trim()));
        }
    }
    Err(write_failed(host).detail(output.lines().last().unwrap_or_default().trim()))
}

fn write_failed(host: &str) -> UserError {
    UserError::new("ccConnect.remoteWrite", format!("cc-connect's settings on {host} could not be written; they were put back.")).arg("host", host)
}

#[cfg(test)]
mod tests;
