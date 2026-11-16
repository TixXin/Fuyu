use base64::{engine::general_purpose::STANDARD, Engine};

pub(super) const NOT_FOUND: &str = "NOTFOUND";
pub(super) const INSTALL_DIR: &str = "$HOME/.local/bin";

pub(super) fn sh_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', r"'\''"))
}

pub(super) fn base64_word(value: &[u8]) -> String {
    sh_quote(&STANDARD.encode(value))
}

pub(super) fn decode(text: &str) -> Option<String> {
    STANDARD.decode(text.trim()).ok().map(|bytes| String::from_utf8_lossy(&bytes).into_owned())
}

pub(super) fn find_exe(path: Option<&str>) -> String {
    let mut script = format!("exe={}\n", sh_quote(path.unwrap_or_default().trim()));
    script.push_str(
        r#"case $exe in "~/"*) exe="$HOME/${exe#??}" ;; esac
if [ -z "$exe" ]; then
  pid=$(pgrep -u "$(id -u)" -x cc-connect 2>/dev/null | head -n 1)
  [ -n "$pid" ] && exe=$(readlink "/proc/$pid/exe" 2>/dev/null)
fi
[ -n "$exe" ] || exe=$(bash -lc 'command -v cc-connect' 2>/dev/null </dev/null | tail -n 1)
[ -n "$exe" ] || exe="$HOME/.local/bin/cc-connect"
[ -x "$exe" ] || exe=
"#,
    );
    script
}

pub(super) const NO_HISTORY: &str = "case $- in *H*) set +H ;; esac\n";

pub(super) fn proxy_env(proxy: Option<&str>) -> String {
    let mut script = format!("{NO_HISTORY}p={}\n", sh_quote(proxy.unwrap_or_default()));
    script.push_str(
        r#"[ -n "$p" ] || p=$(bash -lc 'printf %s "${HTTPS_PROXY:-${https_proxy:-}}"' 2>/dev/null </dev/null)
case $p in *[!A-Za-z0-9:/._@%-]*) p= ;; esac
[ -n "$p" ] && export http_proxy="$p" https_proxy="$p" HTTP_PROXY="$p" HTTPS_PROXY="$p" no_proxy=localhost,127.0.0.1,::1 NO_PROXY=localhost,127.0.0.1,::1
"#,
    );
    script
}

pub(super) fn in_login_shell(script: &str) -> String {
    let quoted = sh_quote(script);
    format!("if command -v bash >/dev/null 2>&1; then bash -lc {quoted} </dev/null; else sh -c {quoted} </dev/null; fi\n")
}

pub(super) fn tilde(var: &str) -> String {
    format!("case ${var} in \"~\") {var}=\"$HOME\" ;; \"~/\"*) {var}=\"$HOME/${{{var}#??}}\" ;; esac\n")
}

#[cfg(test)]
mod tests {
    use super::{find_exe, in_login_shell, proxy_env, sh_quote, tilde};

    #[test]
    fn words_are_quoted_for_sh() {
        assert_eq!(sh_quote("a b"), "'a b'");
        assert_eq!(sh_quote("it's $HOME"), r"'it'\''s $HOME'");
    }

    #[test]
    fn a_home_path_is_expanded_there_and_the_install_folder_is_the_last_guess() {
        let find = find_exe(Some("~/bin/cc-connect"));
        assert!(find.starts_with("exe='~/bin/cc-connect'\ncase $exe in \"~/\"*) exe=\"$HOME/${exe#??}\" ;; esac\n"));
        assert!(find.contains("[ -n \"$exe\" ] || exe=\"$HOME/.local/bin/cc-connect\"\n[ -x \"$exe\" ] || exe=\n"));
        assert_eq!(tilde("w"), "case $w in \"~\") w=\"$HOME\" ;; \"~/\"*) w=\"$HOME/${w#??}\" ;; esac\n");
    }

    #[test]
    fn the_proxy_is_checked_with_history_expansion_off_and_exported() {
        let env = proxy_env(Some("http://127.0.0.1:37897"));
        assert!(env.starts_with("case $- in *H*) set +H ;; esac\np='http://127.0.0.1:37897'\n"));
        assert!(env.contains("export http_proxy=\"$p\""));
        assert!(proxy_env(None).contains("p=''\n[ -n \"$p\" ] || p=$(bash -lc"));
    }

    #[test]
    fn the_login_shell_gets_the_script_as_one_quoted_word() {
        let wrapped = in_login_shell("echo 'hi'");
        assert!(wrapped.starts_with(r"if command -v bash >/dev/null 2>&1; then bash -lc 'echo '\''hi'\''' </dev/null; else sh -c "));
    }
}
