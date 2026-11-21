use std::{
    io::{Read, Write},
    process::{Command, Stdio},
};

use serde::{de::DeserializeOwned, Serialize};

const FLAG: &str = "--fuyu-ocr";

#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) enum Mode {
    Text,
    Words,
}

impl Mode {
    fn name(self) -> &'static str {
        match self {
            Mode::Text => "text",
            Mode::Words => "words",
        }
    }

    fn parse(name: &str) -> Option<Self> {
        [Mode::Text, Mode::Words].into_iter().find(|mode| mode.name() == name)
    }
}

pub(super) fn ask<T: DeserializeOwned>(mode: Mode, width: u32, height: u32, rgba: &[u8]) -> Option<T> {
    let exe = std::env::current_exe().ok()?;
    let mut child = Command::new(exe)
        .args([FLAG, mode.name(), &width.to_string(), &height.to_string()])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    let mut stdin = child.stdin.take()?;
    let output = std::thread::scope(|scope| {
        scope.spawn(move || {
            let _ = stdin.write_all(rgba);
        });
        child.wait_with_output()
    })
    .ok()?;
    if !output.status.success() {
        return None;
    }
    serde_json::from_slice(&output.stdout).ok()
}

pub(crate) fn run_from_args() -> Option<i32> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let (flag, rest) = args.split_first()?;
    if flag != FLAG {
        return None;
    }
    Some(if serve(rest).is_some() { 0 } else { 1 })
}

pub(super) fn parse_args(args: &[String]) -> Option<(Mode, u32, u32)> {
    let [mode, width, height] = args else {
        return None;
    };
    Some((Mode::parse(mode)?, width.parse().ok()?, height.parse().ok()?))
}

fn serve(args: &[String]) -> Option<()> {
    let (mode, width, height) = parse_args(args)?;
    let expected = u64::from(width) * u64::from(height) * 4;
    let mut rgba = Vec::new();
    std::io::stdin().take(expected).read_to_end(&mut rgba).ok()?;
    let json = match mode {
        Mode::Text => encode(&super::ocr::recognize_here(width, height, &rgba)),
        Mode::Words => encode(&super::ocr::recognize_words_here(width, height, &rgba)),
    }?;
    std::io::stdout().write_all(&json).ok()
}

fn encode<T: Serialize>(value: &T) -> Option<Vec<u8>> {
    serde_json::to_vec(value).ok()
}

#[cfg(test)]
mod tests {
    use super::{parse_args, Mode};

    fn args(values: &[&str]) -> Vec<String> {
        values.iter().map(|value| value.to_string()).collect()
    }

    #[test]
    fn worker_arguments_parse() {
        assert_eq!(parse_args(&args(&["words", "640", "480"])), Some((Mode::Words, 640, 480)));
        assert_eq!(parse_args(&args(&["text", "1", "1"])), Some((Mode::Text, 1, 1)));
        assert_eq!(parse_args(&args(&["pixels", "1", "1"])), None);
        assert_eq!(parse_args(&args(&["text", "-1", "1"])), None);
        assert_eq!(parse_args(&args(&["text", "1"])), None);
    }
}
