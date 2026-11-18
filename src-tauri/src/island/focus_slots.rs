use std::sync::atomic::{AtomicIsize, Ordering};

pub(super) struct FocusSlots {
    hover: AtomicIsize,
    expanded: AtomicIsize,
}

impl FocusSlots {
    pub(super) const fn new() -> Self {
        Self {
            hover: AtomicIsize::new(0),
            expanded: AtomicIsize::new(0),
        }
    }

    pub(super) fn note_hover(&self, target: isize) {
        if target != 0 {
            self.hover.store(target, Ordering::SeqCst);
        }
    }

    pub(super) fn note_expanded(&self, target: isize) {
        let hover = self.hover.swap(0, Ordering::SeqCst);
        if target != 0 {
            self.expanded.store(target, Ordering::SeqCst);
        } else if hover != 0 && self.expanded.load(Ordering::SeqCst) == 0 {
            self.expanded.store(hover, Ordering::SeqCst);
        }
    }

    pub(super) fn take_hover(&self) -> Option<isize> {
        let target = self.hover.swap(0, Ordering::SeqCst);
        (target != 0).then_some(target)
    }

    pub(super) fn take_expanded(&self) -> Option<isize> {
        let target = self.expanded.swap(0, Ordering::SeqCst);
        (target != 0).then_some(target)
    }
}
