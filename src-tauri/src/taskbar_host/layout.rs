use serde::Serialize;

const HIDDEN_THICKNESS: i32 = 4;

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
pub struct Rect {
    pub left: i32,
    pub top: i32,
    pub right: i32,
    pub bottom: i32,
}

impl Rect {
    pub(crate) const fn new(left: i32, top: i32, right: i32, bottom: i32) -> Self {
        Self { left, top, right, bottom }
    }

    fn width(self) -> i32 {
        self.right - self.left
    }

    fn height(self) -> i32 {
        self.bottom - self.top
    }

    pub(crate) fn contains(self, x: i32, y: i32) -> bool {
        x >= self.left && x < self.right && y >= self.top && y < self.bottom
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum BarEdge {
    Bottom,
    Top,
    Left,
    Right,
}

impl BarEdge {
    pub(crate) fn horizontal(self) -> bool {
        matches!(self, Self::Bottom | Self::Top)
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct Span {
    pub start: i32,
    pub end: i32,
}

impl Span {
    fn len(self) -> i32 {
        self.end - self.start
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum PartRole {
    Obstacle,
    Tray,
}

#[derive(Clone, Copy, Debug)]
pub(crate) struct Part {
    pub role: PartRole,
    pub rect: Rect,
}

pub(crate) fn bar_edge(bar: Rect, monitor: Rect) -> BarEdge {
    if bar.width() >= bar.height() {
        if bar.top - monitor.top < monitor.bottom - bar.bottom {
            BarEdge::Top
        } else {
            BarEdge::Bottom
        }
    } else if bar.left - monitor.left < monitor.right - bar.right {
        BarEdge::Left
    } else {
        BarEdge::Right
    }
}

pub(crate) fn is_hidden(bar: Rect, monitor: Rect, edge: BarEdge) -> bool {
    let visible = if edge.horizontal() {
        bar.bottom.min(monitor.bottom) - bar.top.max(monitor.top)
    } else {
        bar.right.min(monitor.right) - bar.left.max(monitor.left)
    };
    visible < HIDDEN_THICKNESS
}

fn along(rect: Rect, horizontal: bool) -> Span {
    if horizontal {
        Span { start: rect.left, end: rect.right }
    } else {
        Span { start: rect.top, end: rect.bottom }
    }
}

pub(crate) fn tray_start(parts: &[Part], horizontal: bool) -> Option<i32> {
    parts
        .iter()
        .filter(|part| part.role == PartRole::Tray)
        .map(|part| along(part.rect, horizontal).start)
        .min()
}

pub(crate) fn free_spans(bar: Rect, parts: &[Part], horizontal: bool, margin: i32) -> Vec<Span> {
    let whole = along(bar, horizontal);
    let mut taken: Vec<Span> = parts
        .iter()
        .map(|part| along(part.rect, horizontal))
        .filter(|span| span.end > whole.start && span.start < whole.end)
        .map(|span| Span { start: span.start - margin, end: span.end + margin })
        .collect();
    taken.sort_by_key(|span| span.start);
    let mut free = Vec::new();
    let mut cursor = whole.start + margin;
    for span in taken {
        if span.start > cursor {
            free.push(Span { start: cursor, end: span.start });
        }
        cursor = cursor.max(span.end);
    }
    let last = whole.end - margin;
    if last > cursor {
        free.push(Span { start: cursor, end: last });
    }
    free
}

fn try_order(free: &[Span], tray_start: Option<i32>) -> Vec<usize> {
    let preferred = match tray_start {
        Some(tray) => free.iter().rposition(|span| span.end <= tray),
        None => free.len().checked_sub(1),
    };
    let mut rest: Vec<usize> = (0..free.len()).filter(|index| Some(*index) != preferred).collect();
    rest.sort_by_key(|index| std::cmp::Reverse(free[*index].len()));
    preferred.into_iter().chain(rest).collect()
}

pub(crate) fn arrange(free: &[Span], tray_start: Option<i32>, sizes: &[i32], spacing: i32) -> Vec<Option<Span>> {
    let order = try_order(free, tray_start);
    let mut cursors: Vec<i32> = free.iter().map(|span| span.end).collect();
    sizes
        .iter()
        .map(|size| {
            let index = order.iter().copied().find(|index| cursors[*index] - size >= free[*index].start)?;
            let end = cursors[index];
            cursors[index] = end - size - spacing;
            Some(Span { start: end - size, end })
        })
        .collect()
}

pub(crate) fn place(bar: Rect, horizontal: bool, span: Span) -> Rect {
    if horizontal {
        Rect::new(span.start, bar.top, span.end, bar.bottom)
    } else {
        Rect::new(bar.left, span.start, bar.right, span.end)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MONITOR: Rect = Rect::new(0, 0, 3840, 2160);
    const BAR: Rect = Rect::new(0, 2100, 3840, 2160);

    fn part(role: PartRole, start: i32, end: i32) -> Part {
        Part { role, rect: Rect::new(start, 2100, end, 2160) }
    }

    fn left_aligned() -> Vec<Part> {
        vec![
            part(PartRole::Obstacle, 0, 69),
            part(PartRole::Obstacle, 69, 179),
            part(PartRole::Obstacle, 179, 1236),
            part(PartRole::Tray, 3279, 3734),
            part(PartRole::Tray, 3734, 3840),
        ]
    }

    fn centered() -> Vec<Part> {
        vec![
            part(PartRole::Obstacle, 0, 200),
            part(PartRole::Obstacle, 1500, 2300),
            part(PartRole::Tray, 3279, 3840),
        ]
    }

    #[test]
    fn reads_which_edge_the_bar_is_on() {
        assert_eq!(bar_edge(BAR, MONITOR), BarEdge::Bottom);
        assert_eq!(bar_edge(Rect::new(0, 0, 3840, 60), MONITOR), BarEdge::Top);
        assert_eq!(bar_edge(Rect::new(0, 0, 80, 2160), MONITOR), BarEdge::Left);
        assert_eq!(bar_edge(Rect::new(3760, 0, 3840, 2160), MONITOR), BarEdge::Right);
    }

    #[test]
    fn an_auto_hidden_bar_shows_only_a_sliver() {
        assert!(!is_hidden(BAR, MONITOR, BarEdge::Bottom));
        assert!(is_hidden(Rect::new(0, 2158, 3840, 2218), MONITOR, BarEdge::Bottom));
    }

    #[test]
    fn free_spans_skip_buttons_and_tray_with_a_margin() {
        let free = free_spans(BAR, &left_aligned(), true, 8);
        assert_eq!(free, vec![Span { start: 1244, end: 3271 }]);
        let free = free_spans(BAR, &centered(), true, 8);
        assert_eq!(free, vec![Span { start: 208, end: 1492 }, Span { start: 2308, end: 3271 }]);
    }

    #[test]
    fn first_item_sits_next_to_the_tray() {
        let parts = left_aligned();
        let free = free_spans(BAR, &parts, true, 8);
        let placed = arrange(&free, tray_start(&parts, true), &[400, 300], 8);
        assert_eq!(placed, vec![Some(Span { start: 2871, end: 3271 }), Some(Span { start: 2563, end: 2863 })]);
    }

    #[test]
    fn centered_bar_falls_back_to_the_wider_left_gap() {
        let parts = centered();
        let free = free_spans(BAR, &parts, true, 8);
        let placed = arrange(&free, tray_start(&parts, true), &[900, 1100, 2000], 8);
        assert_eq!(placed[0], Some(Span { start: 2371, end: 3271 }));
        assert_eq!(placed[1], Some(Span { start: 392, end: 1492 }));
        assert_eq!(placed[2], None);
    }

    #[test]
    fn without_a_tray_the_last_gap_is_preferred() {
        let parts = vec![part(PartRole::Obstacle, 0, 500)];
        let free = free_spans(BAR, &parts, true, 0);
        assert_eq!(arrange(&free, tray_start(&parts, true), &[100], 0), vec![Some(Span { start: 3740, end: 3840 })]);
    }

    #[test]
    fn vertical_bars_use_the_vertical_axis() {
        let bar = Rect::new(0, 0, 80, 2160);
        let parts = vec![
            Part { role: PartRole::Obstacle, rect: Rect::new(0, 0, 80, 600) },
            Part { role: PartRole::Tray, rect: Rect::new(0, 1800, 80, 2160) },
        ];
        let free = free_spans(bar, &parts, false, 0);
        let placed = arrange(&free, tray_start(&parts, false), &[200], 0);
        assert_eq!(placed, vec![Some(Span { start: 1600, end: 1800 })]);
        assert_eq!(place(bar, false, Span { start: 1600, end: 1800 }), Rect::new(0, 1600, 80, 1800));
    }
}
