use std::collections::HashMap;

pub(crate) type Counters = HashMap<String, (u64, u64)>;

const U32_SPAN: u64 = 1 << 32;

pub(crate) fn cpu_share(before: (u64, u64), after: (u64, u64)) -> Option<f32> {
    let busy = after.0.checked_sub(before.0)?;
    let total = after.1.checked_sub(before.1)?;
    (total > 0).then(|| (busy as f64 / total as f64).clamp(0.0, 1.0) as f32)
}

fn grew(before: u64, after: u64) -> u64 {
    if after >= before {
        after - before
    } else if before < U32_SPAN {
        after + U32_SPAN - before
    } else {
        0
    }
}

pub(crate) fn network_rate(before: &Counters, after: &Counters, seconds: f64) -> Option<(f64, f64)> {
    if seconds <= 0.0 {
        return None;
    }
    let (down, up) = after.iter().fold((0u64, 0u64), |(down, up), (name, &(received, sent))| match before.get(name) {
        Some(&(was_received, was_sent)) => (down + grew(was_received, received), up + grew(was_sent, sent)),
        None => (down, up),
    });
    Some((down as f64 / seconds, up as f64 / seconds))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cpu_share_is_busy_ticks_over_all_ticks_between_two_samples() {
        assert_eq!(cpu_share((100, 400), (150, 500)), Some(0.5));
        assert_eq!(cpu_share((100, 400), (100, 400)), None);
        assert_eq!(cpu_share((100, 400), (90, 500)), None);
    }

    #[test]
    fn network_rate_sums_interfaces_seen_twice_and_survives_a_32_bit_wrap() {
        let before = Counters::from([("en0".into(), (u64::from(u32::MAX) - 99, 1_000)), ("en1".into(), (5, 5))]);
        let after = Counters::from([("en0".into(), (100, 3_000)), ("utun3".into(), (9_999, 9_999))]);
        assert_eq!(network_rate(&before, &after, 2.0), Some((100.0, 1_000.0)));
        assert_eq!(network_rate(&before, &after, 0.0), None);
    }

    #[test]
    fn a_64_bit_counter_that_went_back_counts_as_nothing() {
        let before = Counters::from([("7".into(), (U32_SPAN * 3, 0))]);
        let after = Counters::from([("7".into(), (10, 0))]);
        assert_eq!(network_rate(&before, &after, 1.0), Some((0.0, 0.0)));
    }
}
