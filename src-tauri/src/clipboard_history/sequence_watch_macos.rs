use std::{
    sync::atomic::{AtomicBool, Ordering},
    thread,
    time::Duration,
};

use crate::macos::input;

use super::sequence;

const START_DELAY: Duration = Duration::from_millis(600);
const POLL_INTERVAL: Duration = Duration::from_millis(20);

static WATCHING: AtomicBool = AtomicBool::new(false);

pub(super) fn ensure() {
    if !sequence::is_running() || WATCHING.swap(true, Ordering::SeqCst) {
        return;
    }
    thread::spawn(|| {
        thread::sleep(START_DELAY);
        let mut pasting = false;
        while sequence::is_running() {
            pasting = step(pasting, input::is_v_key_down(), input::is_command_key_down(), sequence::advance);
            thread::sleep(POLL_INTERVAL);
        }
        WATCHING.store(false, Ordering::SeqCst);
        ensure();
    });
}

fn step(pasting: bool, v_down: bool, command_down: bool, pasted: impl FnOnce()) -> bool {
    if v_down {
        return pasting || command_down;
    }
    if pasting {
        pasted();
    }
    false
}

#[cfg(test)]
mod tests {
    use super::step;

    fn run(states: &[(bool, bool)]) -> usize {
        let mut pastes = 0;
        let mut pasting = false;
        for &(v, command) in states {
            pasting = step(pasting, v, command, || pastes += 1);
        }
        pastes
    }

    #[test]
    fn a_paste_counts_once_when_v_is_released() {
        assert_eq!(run(&[(true, true), (true, true), (false, true)]), 1);
        assert_eq!(run(&[(true, true), (true, false), (false, false)]), 1);
        assert_eq!(run(&[(true, true), (false, true), (true, true), (false, false)]), 2);
    }

    #[test]
    fn v_without_command_is_not_a_paste() {
        assert_eq!(run(&[(true, false), (false, false)]), 0);
        assert_eq!(run(&[(false, true), (false, true)]), 0);
    }
}
