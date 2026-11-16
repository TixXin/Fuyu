const DIGITS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";

fn digit(byte: u8) -> usize {
    DIGITS.iter().position(|candidate| *candidate == byte).unwrap_or(0)
}

pub(super) fn is_valid_key(key: &str) -> bool {
    !key.is_empty() && !key.ends_with('0') && key.bytes().all(|byte| DIGITS.contains(&byte))
}

fn midpoint(low: &[u8], high: Option<&[u8]>) -> Vec<u8> {
    if let Some(high) = high {
        let shared = high.iter().enumerate().take_while(|(index, byte)| low.get(*index).copied().unwrap_or(DIGITS[0]) == **byte).count();
        if shared > 0 {
            let mut key = high[..shared].to_vec();
            key.extend(midpoint(low.get(shared..).unwrap_or_default(), Some(&high[shared..])));
            return key;
        }
    }
    let low_digit = low.first().map_or(0, |byte| digit(*byte));
    let high_digit = high.and_then(|high| high.first()).map_or(DIGITS.len(), |byte| digit(*byte));
    if high_digit - low_digit > 1 {
        return vec![DIGITS[(low_digit + high_digit).div_ceil(2)]];
    }
    match high {
        Some(high) if high.len() > 1 => high[..1].to_vec(),
        _ => {
            let mut key = vec![DIGITS[low_digit]];
            key.extend(midpoint(low.get(1..).unwrap_or_default(), None));
            key
        }
    }
}

pub(super) fn key_between(low: Option<&str>, high: Option<&str>) -> String {
    let low = low.unwrap_or_default();
    let high = high.filter(|high| *high > low);
    String::from_utf8_lossy(&midpoint(low.as_bytes(), high.map(str::as_bytes))).into_owned()
}

pub(super) fn keys_between(low: Option<&str>, high: Option<&str>, count: usize) -> Vec<String> {
    if count == 0 {
        return Vec::new();
    }
    let middle = key_between(low, high);
    let before = (count - 1) / 2;
    let mut keys = keys_between(low, Some(&middle), before);
    keys.push(middle.clone());
    keys.extend(keys_between(Some(&middle), high, count - 1 - before));
    keys
}

pub(super) fn is_ordered<'a>(keys: impl IntoIterator<Item = &'a str>) -> bool {
    let mut previous: Option<&str> = None;
    for key in keys {
        if !is_valid_key(key) || previous.is_some_and(|previous| previous >= key) {
            return false;
        }
        previous = Some(key);
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_key_between_two_keys_sorts_between_them() {
        let cases = [(None, None), (Some("i"), None), (None, Some("i")), (Some("a"), Some("b")), (Some("a"), Some("a1")), (Some("az"), Some("b")), (Some("zz"), None), (None, Some("01"))];
        for (low, high) in cases {
            let key = key_between(low, high);
            assert!(is_valid_key(&key), "{key}");
            assert!(low.is_none_or(|low| low < key.as_str()), "{low:?} < {key}");
            assert!(high.is_none_or(|high| key.as_str() < high), "{key} < {high:?}");
        }
    }

    #[test]
    fn many_keys_stay_short_and_in_order() {
        let keys = keys_between(None, None, 1_000);
        assert_eq!(keys.len(), 1_000);
        assert!(is_ordered(keys.iter().map(String::as_str)));
        assert!(keys.iter().all(|key| key.len() <= 4), "{:?}", keys.iter().map(String::len).max());
        let squeezed = keys_between(Some(&keys[0]), Some(&keys[1]), 50);
        assert!(is_ordered([keys[0].as_str()].into_iter().chain(squeezed.iter().map(String::as_str)).chain([keys[1].as_str()])));
    }

    #[test]
    fn repeated_inserts_at_the_front_keep_working() {
        let mut first = key_between(None, None);
        for _ in 0..200 {
            let next = key_between(None, Some(&first));
            assert!(is_valid_key(&next) && next < first, "{next} < {first}");
            first = next;
        }
    }

    #[test]
    fn order_checks_reject_bad_or_unsorted_keys() {
        assert!(is_ordered(["1", "a", "a5", "b"]));
        assert!(!is_ordered(["b", "a"]));
        assert!(!is_ordered(["a", "a"]));
        assert!(!is_ordered(["a0"]));
        assert!(!is_ordered(["A"]));
        assert!(!is_ordered([""]));
    }
}
