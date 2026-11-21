use serde::Serialize;
use windows::Win32::Foundation::{HWND, RECT};

use super::layout::{self, BarEdge, Part, PartRole, Rect, Span};
use crate::win32::{
    taskbar_shell::{self, TaskbarWindow},
    taskbar_uia::{self, PartKind},
};

#[derive(Clone)]
pub(crate) struct Bar {
    pub handle: HWND,
    pub rect: Rect,
    pub monitor: Rect,
    pub primary: bool,
    pub edge: BarEdge,
    pub hidden: bool,
    pub parts: Option<Vec<Part>>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskbarLayout {
    primary: bool,
    edge: BarEdge,
    hidden: bool,
    auto_hide: bool,
    rect: Rect,
    monitor: Rect,
    free: Vec<Rect>,
}

pub(crate) fn rect(raw: RECT) -> Rect {
    Rect::new(raw.left, raw.top, raw.right, raw.bottom)
}

fn part(part: taskbar_uia::TaskbarPart) -> Part {
    let role = if part.kind == PartKind::Tray { PartRole::Tray } else { PartRole::Obstacle };
    Part { role, rect: rect(part.rect) }
}

fn overlaps(a: Rect, b: Rect) -> bool {
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

fn parts_of(window: &TaskbarWindow, bar_rect: Rect) -> Option<Vec<Part>> {
    let mut parts: Vec<Part> = taskbar_uia::taskbar_parts(window.handle)?.into_iter().map(part).collect();
    let widgets = taskbar_shell::widgets_owned_by(window.handle).into_iter().map(rect);
    parts.extend(widgets.filter(|widget| overlaps(*widget, bar_rect)).map(|widget| Part { role: PartRole::Obstacle, rect: widget }));
    Some(parts)
}

fn bar(window: TaskbarWindow) -> Bar {
    let (bar_rect, monitor) = (rect(window.rect), rect(window.monitor));
    let edge = layout::bar_edge(bar_rect, monitor);
    Bar {
        handle: window.handle,
        rect: bar_rect,
        monitor,
        primary: window.primary,
        edge,
        hidden: layout::is_hidden(bar_rect, monitor, edge),
        parts: parts_of(&window, bar_rect),
    }
}

pub(crate) fn read() -> Vec<Bar> {
    taskbar_shell::taskbars().into_iter().map(bar).collect()
}

impl Bar {
    pub(crate) fn free(&self, margin: i32) -> Vec<Span> {
        self.parts
            .as_deref()
            .map(|parts| layout::free_spans(self.rect, parts, self.edge.horizontal(), margin))
            .unwrap_or_default()
    }

    pub(crate) fn tray_start(&self) -> Option<i32> {
        self.parts.as_deref().and_then(|parts| layout::tray_start(parts, self.edge.horizontal()))
    }

    pub(crate) fn describe(&self, auto_hide: bool, margin: i32) -> TaskbarLayout {
        let horizontal = self.edge.horizontal();
        TaskbarLayout {
            primary: self.primary,
            edge: self.edge,
            hidden: self.hidden,
            auto_hide,
            rect: self.rect,
            monitor: self.monitor,
            free: self.free(margin).into_iter().map(|span| layout::place(self.rect, horizontal, span)).collect(),
        }
    }
}

