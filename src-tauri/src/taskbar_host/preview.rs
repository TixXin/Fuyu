use std::{
    sync::{Mutex, PoisonError},
    time::{Duration, Instant},
};

use super::{
    dock,
    layout::{self, BarEdge, Rect, Want},
    snapshot::{self, Bar},
};

const REUSE: Duration = Duration::from_millis(400);

static CACHE: Mutex<Option<(Instant, Vec<Bar>)>> = Mutex::new(None);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct DropSpot {
    pub bar: Rect,
    pub slot: Rect,
}

fn bars() -> Vec<Bar> {
    let mut cache = CACHE.lock().unwrap_or_else(PoisonError::into_inner);
    if cache.as_ref().is_none_or(|(at, _)| at.elapsed() > REUSE) {
        *cache = Some((Instant::now(), snapshot::read()));
    }
    cache.as_ref().map(|(_, bars)| bars.clone()).unwrap_or_default()
}

pub(crate) fn forget() {
    *CACHE.lock().unwrap_or_else(PoisonError::into_inner) = None;
}

pub(crate) fn over_bar(bar: Rect, (x, y): (i32, i32)) -> bool {
    let reach = bar.bottom - bar.top;
    x >= bar.left && x < bar.right && y >= bar.top - reach && y < bar.bottom + reach
}

pub(crate) fn drop_at(point: (i32, i32), size: i32) -> Option<DropSpot> {
    let bars = bars();
    let bar = bars.iter().find(|bar| bar.edge == BarEdge::Bottom && !bar.hidden && over_bar(bar.rect, point))?;
    let gap = dock::margin(bar.rect, bar.edge);
    let want = Want { size: size.max(1), prefer: Some(point.0) };
    let span = layout::arrange(&bar.free(gap), bar.tray_start(), &[want], gap).into_iter().next().flatten()?;
    Some(DropSpot { bar: bar.rect, slot: layout::place(bar.rect, true, span) })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_island_counts_as_over_the_bar_from_one_bar_height_above_it() {
        let bar = Rect::new(0, 2100, 3840, 2160);
        assert!(over_bar(bar, (1000, 2130)));
        assert!(over_bar(bar, (1000, 2045)));
        assert!(!over_bar(bar, (1000, 2030)));
        assert!(!over_bar(bar, (3900, 2130)));
    }
}
