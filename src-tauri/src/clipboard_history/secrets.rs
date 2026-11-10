//! Telling keys and tokens apart from other text (C24.1), so the history can skip them or show
//! them masked. Known prefixes first; then one long token that mixes letters and digits.

/// Prefixes services give their keys and tokens.
const KEY_PREFIXES: &[&str] = &[
    "sk-", "sk_live_", "sk_test_", "rk_live_", "pk_live_", "ghp_", "gho_", "ghu_", "ghs_", "ghr_",
    "github_pat_", "glpat-", "xoxb-", "xoxp-", "xoxa-", "xoxs-", "AKIA", "ASIA", "AIza", "hf_",
    "npm_", "pypi-", "dop_v1_", "shpat_", "SG.",
];

/// A long single token at least this long, mixing letters and digits, counts as a key.
const MIN_TOKEN_LENGTH: usize = 32;

/// Whether `text` looks like a key, token or private key rather than something to keep in history.
pub(crate) fn looks_like_secret(text: &str) -> bool {
    let text = text.trim();
    if text.contains("-----BEGIN") && text.contains("PRIVATE KEY-----") {
        return true;
    }
    if looks_like_card_number(text) || looks_like_id_number(text) {
        return true;
    }
    // One token only: a sentence or a code snippet that mentions a key is not the key.
    if text.is_empty() || text.chars().any(char::is_whitespace) || text.len() > 512 {
        return false;
    }
    let token_chars = |c: char| c.is_ascii_alphanumeric() || "-_.=/+".contains(c);
    if !text.chars().all(token_chars) {
        return false;
    }
    if KEY_PREFIXES.iter().any(|prefix| text.starts_with(prefix) && text.len() >= prefix.len() + 16) {
        return true;
    }
    // A JSON web token: three base64url parts, the first one a JSON object ("eyJ").
    if text.starts_with("eyJ") && text.split('.').count() == 3 && text.len() >= 40 {
        return true;
    }
    let letters = text.chars().filter(char::is_ascii_alphabetic).count();
    let digits = text.chars().filter(char::is_ascii_digit).count();
    let upper = text.chars().filter(char::is_ascii_uppercase).count();
    let lower = text.chars().filter(char::is_ascii_lowercase).count();
    let looks_like_path_or_url = text.contains("://") || text.starts_with('/') || text.contains("..");
    text.len() >= MIN_TOKEN_LENGTH
        && !looks_like_path_or_url
        && digits >= 4
        && letters >= 8
        && upper >= 2
        && lower >= 2
}

/// A payment card number (C38): 13–19 digits, spaces or dashes allowed between them, passing the
/// Luhn check that card numbers carry.
pub(crate) fn looks_like_card_number(text: &str) -> bool {
    if !text.chars().all(|c| c.is_ascii_digit() || c == ' ' || c == '-') {
        return false;
    }
    let digits: Vec<u32> = text.chars().filter_map(|c| c.to_digit(10)).collect();
    if !(13..=19).contains(&digits.len()) || digits.iter().all(|&digit| digit == digits[0]) {
        return false;
    }
    let sum: u32 = digits
        .iter()
        .rev()
        .enumerate()
        .map(|(index, &digit)| if !index.is_multiple_of(2) { let doubled = digit * 2; if doubled > 9 { doubled - 9 } else { doubled } } else { digit })
        .sum();
    sum.is_multiple_of(10)
}

/// A mainland Chinese resident ID number (C38): 17 digits and a check character (0–9 or X) that
/// matches them (GB 11643), with a plausible birth date.
pub(crate) fn looks_like_id_number(text: &str) -> bool {
    const WEIGHTS: [u32; 17] = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
    const CHECKS: &[u8; 11] = b"10X98765432";
    let bytes = text.as_bytes();
    if bytes.len() != 18 || !bytes[..17].iter().all(u8::is_ascii_digit) {
        return false;
    }
    let digit = |index: usize| u32::from(bytes[index] - b'0');
    let year = (6..10).fold(0, |year, index| year * 10 + digit(index));
    let month = digit(10) * 10 + digit(11);
    let day = digit(12) * 10 + digit(13);
    if !(1900..=2100).contains(&year) || !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return false;
    }
    let sum: u32 = (0..17).map(|index| digit(index) * WEIGHTS[index]).sum();
    bytes[17].to_ascii_uppercase() == CHECKS[(sum % 11) as usize]
}

/// The masked preview: the first four characters, then dots.
pub(crate) fn mask(text: &str) -> String {
    let start: String = text.trim().chars().take(4).collect();
    format!("{start}••••••••")
}

#[cfg(test)]
mod tests {
    use super::{looks_like_secret, mask};

    #[test]
    fn keys_and_tokens_are_told_apart_from_text() {
        assert!(looks_like_secret("sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"));
        assert!(looks_like_secret("ghp_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345"));
        assert!(looks_like_secret("AKIAIOSFODNN7EXAMPLE1234"));
        assert!(looks_like_secret("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"));
        assert!(looks_like_secret("-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----"));
        assert!(looks_like_secret("Q3x9Lm2Pz7Rt5Wv8Ny4Bk6Hj1Df0Gs3Ac"));
        assert!(!looks_like_secret("hello world"));
        assert!(!looks_like_secret("my key is sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz0123456789"));
        assert!(!looks_like_secret("https://github.com/TixXin/fly-island/blob/main/README.md"));
        assert!(!looks_like_secret("C:/Users/tixxin/Projects/fly-island/src-tauri/src/main.rs"));
        assert!(!looks_like_secret("0f22a9b6c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6"));
        assert!(!looks_like_secret("sk-short"));
    }

    #[test]
    fn card_and_id_numbers_count_as_secrets() {
        // Standard test card numbers; one digit off fails the check.
        assert!(looks_like_secret("4111 1111 1111 1111"));
        assert!(looks_like_secret("5555-5555-5555-4444"));
        assert!(!looks_like_secret("4111 1111 1111 1112"));
        assert!(!looks_like_secret("0000 0000 0000 0000"));
        assert!(!looks_like_secret("2026 11 10"));
        // The example number from GB 11643.
        assert!(looks_like_secret("11010519491231002X"));
        assert!(!looks_like_secret("110105194912310021"));
    }

    #[test]
    fn masks_keep_the_first_four_characters() {
        assert_eq!(mask("  ghp_abcdef "), "ghp_••••••••");
    }
}
