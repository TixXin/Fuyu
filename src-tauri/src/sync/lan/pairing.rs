use ring::hmac;
use spake2::{Ed25519Group, Identity, Password, Spake2};
use std::time::{Duration, Instant};

pub(crate) const CODE_TTL: Duration = Duration::from_secs(120);
pub(crate) const MAX_TRIES: u32 = 5;
const CODE_DIGITS: u32 = 6;
const CONTEXT: &[u8] = b"fuyu-lan-pair-v1";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Role {
    Shower,
    Joiner,
}

impl Role {
    fn label(self) -> &'static [u8] {
        match self {
            Self::Shower => b"shower",
            Self::Joiner => b"joiner",
        }
    }
}

pub(crate) struct Binding<'a> {
    pub(crate) shower_fingerprint: &'a str,
    pub(crate) joiner_fingerprint: &'a str,
    pub(crate) shower_device: &'a str,
    pub(crate) joiner_device: &'a str,
}

pub(crate) fn new_code() -> Result<String, String> {
    let limit = 10u32.pow(CODE_DIGITS);
    let zone = u32::MAX - u32::MAX % limit;
    loop {
        let mut bytes = [0u8; 4];
        getrandom::fill(&mut bytes).map_err(|error| format!("Could not make a pairing code: {error}"))?;
        let value = u32::from_le_bytes(bytes);
        if value < zone {
            return Ok(format!("{:06}", value % limit));
        }
    }
}

pub(crate) fn is_code(text: &str) -> bool {
    text.len() == CODE_DIGITS as usize && text.bytes().all(|byte| byte.is_ascii_digit())
}

pub(crate) struct Exchange(Spake2<Ed25519Group>);

pub(crate) fn start(code: &str) -> (Exchange, Vec<u8>) {
    let (state, outbound) = Spake2::<Ed25519Group>::start_symmetric(&Password::new(code.as_bytes()), &Identity::new(CONTEXT));
    (Exchange(state), outbound)
}

pub(crate) struct SessionKey(hmac::Key);

impl Exchange {
    pub(crate) fn finish(self, inbound: &[u8]) -> Option<SessionKey> {
        let shared = self.0.finish(inbound).ok()?;
        Some(SessionKey(hmac::Key::new(hmac::HMAC_SHA256, &shared)))
    }
}

fn transcript(role: Role, binding: &Binding<'_>) -> Vec<u8> {
    let mut out = Vec::new();
    for part in [CONTEXT, role.label(), binding.shower_fingerprint.as_bytes(), binding.joiner_fingerprint.as_bytes(), binding.shower_device.as_bytes(), binding.joiner_device.as_bytes()] {
        out.extend_from_slice(&u32::try_from(part.len()).unwrap_or(u32::MAX).to_be_bytes());
        out.extend_from_slice(part);
    }
    out
}

impl SessionKey {
    pub(crate) fn confirm(&self, role: Role, binding: &Binding<'_>) -> Vec<u8> {
        hmac::sign(&self.0, &transcript(role, binding)).as_ref().to_vec()
    }

    pub(crate) fn verify(&self, role: Role, binding: &Binding<'_>, tag: &[u8]) -> bool {
        hmac::verify(&self.0, &transcript(role, binding), tag).is_ok()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Refusal {
    Expired,
    TooManyTries,
}

pub(crate) struct Window {
    code: String,
    expires_at: Instant,
    tries_left: u32,
}

impl Window {
    pub(crate) fn open(code: String, now: Instant) -> Self {
        Self { code, expires_at: now + CODE_TTL, tries_left: MAX_TRIES }
    }

    pub(crate) fn code(&self) -> &str {
        &self.code
    }

    pub(crate) fn seconds_left(&self, now: Instant) -> u64 {
        self.expires_at.saturating_duration_since(now).as_secs()
    }

    pub(crate) fn admit(&mut self, now: Instant) -> Result<String, Refusal> {
        if now >= self.expires_at {
            return Err(Refusal::Expired);
        }
        if self.tries_left == 0 {
            return Err(Refusal::TooManyTries);
        }
        self.tries_left -= 1;
        Ok(self.code.clone())
    }

    pub(crate) fn spent(&self) -> bool {
        self.tries_left == 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const BINDING: Binding<'static> = Binding { shower_fingerprint: "aa", joiner_fingerprint: "bb", shower_device: "d1", joiner_device: "d2" };

    fn pair(shower_code: &str, joiner_code: &str) -> (SessionKey, SessionKey) {
        let (shower, from_shower) = start(shower_code);
        let (joiner, from_joiner) = start(joiner_code);
        (shower.finish(&from_joiner).unwrap(), joiner.finish(&from_shower).unwrap())
    }

    #[test]
    fn matching_codes_confirm_each_other_and_bind_the_fingerprints() {
        let (shower, joiner) = pair("123456", "123456");
        let tag = shower.confirm(Role::Shower, &BINDING);
        assert!(joiner.verify(Role::Shower, &BINDING, &tag));
        assert!(!joiner.verify(Role::Joiner, &BINDING, &tag));
        let swapped = Binding { shower_fingerprint: "cc", ..BINDING };
        assert!(!joiner.verify(Role::Shower, &swapped, &tag));
        assert!(shower.verify(Role::Joiner, &BINDING, &joiner.confirm(Role::Joiner, &BINDING)));
    }

    #[test]
    fn a_wrong_code_never_confirms() {
        let (shower, joiner) = pair("123456", "123457");
        assert!(!joiner.verify(Role::Shower, &BINDING, &shower.confirm(Role::Shower, &BINDING)));
        let (exchange, _) = start("123456");
        assert!(exchange.finish(b"short").is_none());
    }

    #[test]
    fn codes_are_six_digits_and_windows_expire_and_run_out() {
        for _ in 0..50 {
            let code = new_code().unwrap();
            assert!(is_code(&code), "{code}");
        }
        assert!(!is_code("12345"));
        assert!(!is_code("12345a"));
        let now = Instant::now();
        let mut window = Window::open("000111".into(), now);
        for _ in 0..MAX_TRIES {
            assert_eq!(window.admit(now).as_deref(), Ok("000111"));
        }
        assert!(window.spent());
        assert_eq!(window.admit(now), Err(Refusal::TooManyTries));
        let mut late = Window::open("000111".into(), now);
        assert_eq!(late.seconds_left(now), CODE_TTL.as_secs());
        assert_eq!(late.admit(now + CODE_TTL), Err(Refusal::Expired));
    }
}
