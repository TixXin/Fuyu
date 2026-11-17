use std::process::Command;

const TERMINAL: &str = r#"tell application "Terminal"
  repeat with w in windows
    repeat with t in tabs of w
      if tty of t is "TTY" then
        set selected of t to true
        set index of w to 1
        return "ok"
      end if
    end repeat
  end repeat
end tell"#;

const ITERM: &str = r#"tell application "iTerm2"
  repeat with w in windows
    repeat with t in tabs of w
      repeat with s in sessions of t
        if tty of s is "TTY" then
          select w
          select t
          select s
          return "ok"
        end if
      end repeat
    end repeat
  end repeat
end tell"#;

const GHOSTTY: &str = r#"tell application "Ghostty"
  repeat with w in windows
    repeat with t in tabs of w
      repeat with s in terminals of t
        if tty of s is "TTY" then
          activate window w
          select tab t
          focus s
          return "ok"
        end if
      end repeat
    end repeat
  end repeat
end tell"#;

pub(crate) fn is_tty_path(tty: &str) -> bool {
    tty.strip_prefix("/dev/tty").is_some_and(|rest| !rest.is_empty() && rest.chars().all(|c| c.is_ascii_alphanumeric()))
}

pub(crate) fn script_for(app: &str) -> Option<&'static str> {
    match app {
        "terminal" => Some(TERMINAL),
        "iterm" | "iterm2" => Some(ITERM),
        "ghostty" => Some(GHOSTTY),
        _ => None,
    }
}

pub(crate) fn supports(app: &str) -> bool {
    script_for(app).is_some()
}

pub(crate) fn select(app: &str, tty: &str) -> bool {
    if !is_tty_path(tty) {
        return false;
    }
    let Some(script) = script_for(app) else {
        return false;
    };
    Command::new("/usr/bin/osascript")
        .arg("-e")
        .arg(script.replace("TTY", tty))
        .output()
        .is_ok_and(|output| output.status.success() && String::from_utf8_lossy(&output.stdout).trim() == "ok")
}

#[cfg(test)]
mod tests {
    use super::{is_tty_path, script_for, supports};

    #[test]
    fn only_real_tty_paths_reach_the_script() {
        assert!(is_tty_path("/dev/ttys003"));
        assert!(!is_tty_path("/dev/ttys003\" & do shell script \"x"));
        assert!(!is_tty_path("/dev/tty"));
        assert!(!is_tty_path("ttys003"));
    }

    #[test]
    fn supports_terminal_iterm_and_ghostty() {
        for app in ["terminal", "iterm", "iterm2", "ghostty"] {
            assert!(supports(app));
        }
        assert!(!supports("alacritty"));
        let ghostty = script_for("ghostty").unwrap();
        assert!(ghostty.contains("select tab t") && ghostty.contains("focus s"));
    }
}
