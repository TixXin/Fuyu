use super::{
    config_file::FILE_NAME,
    script::{decode, find_exe, NOT_FOUND},
};
use crate::user_error::UserError;

const NO_CONFIG: &str = "NOCONFIG";

pub(super) fn restart_script(path: Option<&str>) -> String {
    let mut script = find_exe(path);
    script.push_str(&format!(
        r#"[ -n "$exe" ] || {{ echo {NOT_FOUND}; exit 0; }}
d="$HOME/.cc-connect"
[ -f "$d/{FILE_NAME}" ] || {{ echo {NO_CONFIG}; exit 0; }}
me=$(id -u)
pkill -u "$me" -x cc-connect 2>/dev/null
i=0
while pgrep -u "$me" -x cc-connect >/dev/null 2>&1 && [ $i -lt 10 ]; do sleep 1; i=$((i + 1)); done
pkill -9 -u "$me" -x cc-connect 2>/dev/null
cd "$HOME" || exit 0
export FUYU_CC_EXE="$exe"
set -- sh -c
command -v bash >/dev/null 2>&1 && set -- bash -lc
command -v setsid >/dev/null 2>&1 && set -- setsid "$@"
nohup "$@" 'PATH="$HOME/.local/bin:$PATH"; exec "$FUYU_CC_EXE" --config "$HOME/.cc-connect/{FILE_NAME}"' >"$d/fuyu.log" 2>&1 </dev/null &
sleep 3
if pgrep -u "$me" -x cc-connect >/dev/null 2>&1; then echo R; else printf 'L %s\n' "$(tail -n 20 "$d/fuyu.log" 2>/dev/null | base64 | tr -d '\n')"; fi
"#
    ));
    script
}

pub(super) fn parse_restart(host: &str, output: &str) -> Result<(), UserError> {
    for line in output.lines() {
        match line {
            "R" => return Ok(()),
            NOT_FOUND => return Err(UserError::new("ccConnect.remoteNotFound", format!("cc-connect was not found on {host}.")).arg("host", host)),
            NO_CONFIG => return Err(UserError::new("ccConnect.remoteNoConfig", format!("cc-connect on {host} has no projects yet.")).arg("host", host)),
            _ => {}
        }
        if let Some(log) = line.strip_prefix("L ") {
            let reason = decode(log).and_then(|text| text.lines().map(str::trim).rfind(|line| !line.is_empty()).map(str::to_string));
            return Err(stopped(host).detail(reason.unwrap_or_default()));
        }
    }
    Err(stopped(host))
}

fn stopped(host: &str) -> UserError {
    UserError::new("ccConnect.remoteStopped", format!("cc-connect on {host} stopped right after starting.")).arg("host", host)
}

#[cfg(test)]
mod tests {
    use super::{parse_restart, restart_script};
    use base64::{engine::general_purpose::STANDARD, Engine};

    #[test]
    fn it_stops_the_old_one_and_starts_through_a_login_shell_in_the_background() {
        let script = restart_script(Some("/opt/cc-connect"));
        assert!(script.starts_with("exe='/opt/cc-connect'\n"));
        let stop = script.find("pkill -u \"$me\" -x cc-connect").unwrap();
        let start = script.find("nohup \"$@\"").unwrap();
        assert!(stop < start);
        assert!(script.contains("command -v bash >/dev/null 2>&1 && set -- bash -lc"));
        assert!(script.contains("exec \"$FUYU_CC_EXE\" --config \"$HOME/.cc-connect/config.toml\"' >\"$d/fuyu.log\" 2>&1 </dev/null &"));
    }

    #[test]
    fn the_answer_is_running_or_the_reason_it_is_not() {
        assert!(parse_restart("pc", "R\n").is_ok());
        assert_eq!(parse_restart("pc", "NOTFOUND\n").unwrap_err().code(), "ccConnect.remoteNotFound");
        assert_eq!(parse_restart("pc", "NOCONFIG\n").unwrap_err().code(), "ccConnect.remoteNoConfig");
        let log = STANDARD.encode("starting\nError: bad token\n\n");
        let error = parse_restart("pc", &format!("L {log}\n")).unwrap_err();
        assert_eq!(error.code(), "ccConnect.remoteStopped");
        assert!(format!("{error:?}").contains("Error: bad token"));
        assert_eq!(parse_restart("pc", "").unwrap_err().code(), "ccConnect.remoteStopped");
    }
}
