use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::{
    fmt,
    str::FromStr,
    sync::{Mutex, PoisonError},
    time::{SystemTime, UNIX_EPOCH},
};

const MS_WIDTH: usize = 15;
const COUNTER_WIDTH: usize = 6;
const MAX_COUNTER: u32 = 999_999;
const FALLBACK_DEVICE: &str = "local";
pub(crate) const MAX_FORWARD_DRIFT_MS: u64 = 24 * 60 * 60 * 1000;

#[derive(Debug, Clone, PartialEq, Eq, Hash, PartialOrd, Ord)]
pub struct Hlc {
    pub ms: u64,
    pub counter: u32,
    pub device: String,
}

impl Hlc {
    pub(crate) fn from_millis(ms: u64, device: &str) -> Self {
        Self { ms, counter: 0, device: device.to_string() }
    }
}

impl fmt::Display for Hlc {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{:0MS_WIDTH$}-{:0COUNTER_WIDTH$}-{}", self.ms, self.counter, self.device)
    }
}

impl FromStr for Hlc {
    type Err = String;

    fn from_str(text: &str) -> Result<Self, Self::Err> {
        let bad = || format!("\"{text}\" is not a sync timestamp.");
        let mut parts = text.splitn(3, '-');
        let (Some(ms), Some(counter), Some(device)) = (parts.next(), parts.next(), parts.next()) else {
            return Err(bad());
        };
        let digits = |part: &str, width: usize| part.len() == width && part.bytes().all(|byte| byte.is_ascii_digit());
        if !digits(ms, MS_WIDTH) || !digits(counter, COUNTER_WIDTH) || !crate::sync::device::is_valid_id(device) {
            return Err(bad());
        }
        Ok(Self { ms: ms.parse().map_err(|_| bad())?, counter: counter.parse().map_err(|_| bad())?, device: device.to_string() })
    }
}

impl Serialize for Hlc {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.collect_str(self)
    }
}

impl<'de> Deserialize<'de> for Hlc {
    fn deserialize<D: Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        String::deserialize(deserializer)?.parse().map_err(serde::de::Error::custom)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Clock {
    last_ms: u64,
    counter: u32,
    device: String,
}

impl Clock {
    pub(crate) fn new(device: &str) -> Self {
        Self { last_ms: 0, counter: 0, device: device.to_string() }
    }

    pub(crate) fn device(&self) -> &str {
        &self.device
    }

    pub(crate) fn tick(&mut self, wall_ms: u64) -> Hlc {
        if wall_ms > self.last_ms {
            self.last_ms = wall_ms;
            self.counter = 0;
        } else if self.counter >= MAX_COUNTER {
            self.last_ms += 1;
            self.counter = 0;
        } else {
            self.counter += 1;
        }
        Hlc { ms: self.last_ms, counter: self.counter, device: self.device.clone() }
    }

    pub(crate) fn observe(&mut self, seen: &Hlc, wall_ms: u64) {
        if seen.ms > wall_ms.saturating_add(MAX_FORWARD_DRIFT_MS) {
            return;
        }
        if seen.ms > self.last_ms {
            self.last_ms = seen.ms;
            self.counter = seen.counter;
        } else if seen.ms == self.last_ms {
            self.counter = self.counter.max(seen.counter);
        }
    }
}

static CLOCK: Mutex<Option<Clock>> = Mutex::new(None);

pub(crate) fn with<T>(run: impl FnOnce(&mut Clock, u64) -> T) -> T {
    let mut clock = CLOCK.lock().unwrap_or_else(PoisonError::into_inner);
    let clock = clock.get_or_insert_with(|| {
        let device = crate::sync::device::id().unwrap_or_else(|error| {
            eprintln!("could not read the sync device id, stamping as \"{FALLBACK_DEVICE}\": {error}");
            FALLBACK_DEVICE.to_string()
        });
        Clock::new(&device)
    });
    run(clock, wall_ms())
}

pub(crate) fn observe<'a>(seen: impl IntoIterator<Item = &'a Hlc>) {
    with(|clock, wall| seen.into_iter().for_each(|stamp| clock.observe(stamp, wall)));
}

pub(crate) fn lenient<'de, D: Deserializer<'de>>(deserializer: D) -> Result<Option<Hlc>, D::Error> {
    let value = Option::<serde_json::Value>::deserialize(deserializer)?;
    Ok(value.as_ref().and_then(serde_json::Value::as_str).and_then(|text| text.parse().ok()))
}

pub(crate) fn wall_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| u64::try_from(elapsed.as_millis()).unwrap_or(u64::MAX))
        .unwrap_or(0)
}
