mod desktop;
mod paint;
mod proc;
mod screens;

pub(crate) use screens::screens;

use std::{iter::once, rc::Rc};
use windows::{
    core::{w, BOOL, PCWSTR},
    Win32::{
        Foundation::{HWND, LPARAM, RECT, WPARAM},
        Graphics::{
            Dwm::{DwmEnableBlurBehindWindow, DwmSetWindowAttribute, DWMWA_WINDOW_CORNER_PREFERENCE, DWMWCP_ROUND, DWM_BB_BLURREGION, DWM_BB_ENABLE, DWM_BLURBEHIND},
            Gdi::{CreateRectRgn, DeleteObject, InvalidateRect, HGDIOBJ},
        },
        UI::{
            HiDpi::GetDpiForWindow,
            Input::KeyboardAndMouse::ReleaseCapture,
            WindowsAndMessaging::{
                CreateWindowExW, DestroyWindow, FindWindowW, GetClientRect, GetForegroundWindow, GetWindowRect, IsWindowVisible,
                PostMessageW, SetForegroundWindow, SetLayeredWindowAttributes, SetWindowLongPtrW, SetWindowPos, SetWindowTextW, ShowWindow,
                GWLP_HWNDPARENT, GWL_EXSTYLE, HTCAPTION, HWND_BOTTOM, HWND_NOTOPMOST, HWND_TOPMOST, LWA_ALPHA, SWP_FRAMECHANGED,
                SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, SW_HIDE, SW_SHOW, SW_SHOWNOACTIVATE, WINDOW_EX_STYLE,
                WM_NCLBUTTONDOWN, WS_CLIPCHILDREN, WS_EX_LAYERED, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT, WS_POPUP,
            },
        },
    },
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub(crate) struct Bounds {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

impl Bounds {
    fn from_rect(rect: RECT) -> Self {
        Self { x: rect.left, y: rect.top, width: rect.right - rect.left, height: rect.bottom - rect.top }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Layer {
    Desktop,
    Normal,
    Topmost,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Caption {
    pub text: String,
    pub background: [u8; 3],
    pub foreground: [u8; 3],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Look {
    pub title: String,
    pub layer: Layer,
    pub alpha: u8,
    pub click_through: bool,
    pub resizable: bool,
    pub min_size: (i32, i32),
    pub max_size: (i32, i32),
    pub caption: Option<Caption>,
}

pub(crate) trait WindowEvents {
    fn close_requested(&self);
    fn activated(&self, active: bool, by_click: bool);
    fn content_resized(&self, content: Bounds);
    fn moved(&self);
    fn user_moved(&self, bounds: Bounds);
    fn displays_changed(&self);
    fn caption_used(&self);
}

pub(crate) struct PluginWindow {
    hwnd: HWND,
}

fn wide(text: &str) -> Vec<u16> {
    text.encode_utf16().chain(once(0)).collect()
}

fn ex_style(look: &Look) -> WINDOW_EX_STYLE {
    let mut style = WS_EX_TOOLWINDOW;
    if look.caption.is_none() {
        style |= WS_EX_NOACTIVATE;
    }
    if look.alpha < 255 || look.click_through {
        style |= WS_EX_LAYERED;
    }
    if look.click_through {
        style |= WS_EX_TRANSPARENT;
    }
    style
}

impl PluginWindow {
    pub(crate) fn create(look: Look, bounds: Bounds, events: Rc<dyn WindowEvents>) -> Result<Self, String> {
        let class = proc::register()?;
        let title = wide(&look.title);
        let hwnd = unsafe {
            CreateWindowExW(
                ex_style(&look),
                PCWSTR(class.as_ptr()),
                PCWSTR(title.as_ptr()),
                WS_POPUP | WS_CLIPCHILDREN,
                bounds.x,
                bounds.y,
                bounds.width,
                bounds.height,
                None,
                None,
                Some(proc::instance()?),
                None,
            )
        }
        .map_err(|error| format!("Could not create the window: {error}"))?;
        proc::attach(hwnd, look.clone(), events);
        let window = Self { hwnd };
        if look.caption.is_some() {
            let round = DWMWCP_ROUND;
            let _ = unsafe {
                DwmSetWindowAttribute(hwnd, DWMWA_WINDOW_CORNER_PREFERENCE, std::ptr::from_ref(&round).cast(), std::mem::size_of_val(&round) as u32)
            };
        } else {
            let region = unsafe { CreateRectRgn(0, 0, -1, -1) };
            let blur = DWM_BLURBEHIND { dwFlags: DWM_BB_ENABLE | DWM_BB_BLURREGION, fEnable: BOOL::from(true), hRgnBlur: region, fTransitionOnMaximized: BOOL::from(false) };
            let _ = unsafe { DwmEnableBlurBehindWindow(hwnd, &blur) };
            let _ = unsafe { DeleteObject(HGDIOBJ(region.0)) };
        }
        window.apply(&look);
        Ok(window)
    }

    pub(crate) fn hwnd(&self) -> HWND {
        self.hwnd
    }

    pub(crate) fn scale(&self) -> f64 {
        f64::from(unsafe { GetDpiForWindow(self.hwnd) }.max(96)) / 96.0
    }

    pub(crate) fn content(&self) -> Bounds {
        let mut rect = RECT::default();
        let _ = unsafe { GetClientRect(self.hwnd, &mut rect) };
        proc::content_rect(self.hwnd, rect)
    }

    pub(crate) fn bounds(&self) -> Bounds {
        let mut rect = RECT::default();
        let _ = unsafe { GetWindowRect(self.hwnd, &mut rect) };
        Bounds::from_rect(rect)
    }

    pub(crate) fn set_bounds(&self, bounds: Bounds) {
        let _ = unsafe { SetWindowPos(self.hwnd, None, bounds.x, bounds.y, bounds.width, bounds.height, SWP_NOZORDER | SWP_NOACTIVATE) };
    }

    pub(crate) fn set_look(&self, look: &Look) {
        proc::set_look(self.hwnd, look.clone());
        self.apply(look);
    }

    fn apply(&self, look: &Look) {
        let title = wide(&look.title);
        unsafe {
            let _ = SetWindowTextW(self.hwnd, PCWSTR(title.as_ptr()));
            SetWindowLongPtrW(self.hwnd, GWL_EXSTYLE, ex_style(look).0 as isize);
            if look.alpha < 255 || look.click_through {
                let _ = SetLayeredWindowAttributes(self.hwnd, windows::Win32::Foundation::COLORREF(0), look.alpha, LWA_ALPHA);
            }
            let owner = match look.layer {
                Layer::Desktop => FindWindowW(w!("Progman"), PCWSTR::null()).map(|desktop| desktop.0 as isize).unwrap_or(0),
                Layer::Normal | Layer::Topmost => 0,
            };
            SetWindowLongPtrW(self.hwnd, GWLP_HWNDPARENT, owner);
            let after = match look.layer {
                Layer::Desktop => HWND_BOTTOM,
                Layer::Normal => HWND_NOTOPMOST,
                Layer::Topmost => HWND_TOPMOST,
            };
            let _ = SetWindowPos(self.hwnd, Some(after), 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_FRAMECHANGED);
            let _ = InvalidateRect(Some(self.hwnd), None, true);
        }
    }

    pub(crate) fn is_visible(&self) -> bool {
        unsafe { IsWindowVisible(self.hwnd) }.as_bool()
    }

    pub(crate) fn is_foreground(&self) -> bool {
        let foreground = unsafe { GetForegroundWindow() };
        foreground == self.hwnd
    }

    pub(crate) fn show(&self, activate: bool) -> bool {
        unsafe {
            let _ = ShowWindow(self.hwnd, if activate { SW_SHOW } else { SW_SHOWNOACTIVATE });
        }
        activate && self.focus()
    }

    pub(crate) fn hide(&self) {
        let _ = unsafe { ShowWindow(self.hwnd, SW_HIDE) };
    }

    pub(crate) fn focus(&self) -> bool {
        let _ = unsafe { SetForegroundWindow(self.hwnd) };
        self.is_foreground()
    }

    pub(crate) fn start_drag(&self) {
        let point = crate::win32::window::cursor_position().unwrap_or_default();
        let packed = ((point.y & 0xFFFF) << 16) | (point.x & 0xFFFF);
        unsafe {
            let _ = ReleaseCapture();
            let _ = PostMessageW(Some(self.hwnd), WM_NCLBUTTONDOWN, WPARAM(HTCAPTION as usize), LPARAM(packed as isize));
        }
    }

    pub(crate) fn give_back_focus(&self) {
        proc::give_back_focus(self.hwnd);
    }
}

impl Drop for PluginWindow {
    fn drop(&mut self) {
        proc::detach(self.hwnd);
        let _ = unsafe { DestroyWindow(self.hwnd) };
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::cell::RefCell;

    #[derive(Default)]
    struct Recorder {
        closes: RefCell<u32>,
        sizes: RefCell<Vec<Bounds>>,
    }

    impl WindowEvents for Recorder {
        fn close_requested(&self) {
            *self.closes.borrow_mut() += 1;
        }
        fn activated(&self, _: bool, _: bool) {}
        fn content_resized(&self, content: Bounds) {
            self.sizes.borrow_mut().push(content);
        }
        fn moved(&self) {}
        fn user_moved(&self, _: Bounds) {}
        fn displays_changed(&self) {}
        fn caption_used(&self) {}
    }

    fn look(caption: bool) -> Look {
        Look {
            title: "Test · 浮屿".into(),
            layer: Layer::Normal,
            alpha: 255,
            click_through: false,
            resizable: false,
            min_size: (48, 48),
            max_size: (4000, 4000),
            caption: caption.then(|| Caption { text: "Test".into(), background: [30, 30, 34], foreground: [240, 240, 240] }),
        }
    }

    #[test]
    fn panels_and_widgets_are_created_moved_restyled_and_closed_by_the_island() {
        std::thread::spawn(|| {
            let events = Rc::new(Recorder::default());
            let panel = PluginWindow::create(look(true), Bounds { x: 100, y: 100, width: 400, height: 300 }, events.clone()).expect("panel");
            assert!(!panel.is_visible());
            assert_eq!(panel.bounds(), Bounds { x: 100, y: 100, width: 400, height: 300 });
            let content = panel.content();
            assert!(content.y > 0, "the title bar sits above the page: {content:?}");
            assert_eq!(content.width, 400);
            panel.set_bounds(Bounds { x: 120, y: 140, width: 500, height: 320 });
            assert_eq!(panel.bounds(), Bounds { x: 120, y: 140, width: 500, height: 320 });
            assert!(events.sizes.borrow().iter().any(|size| size.width == 500), "the page follows the window");
            unsafe {
                let _ = PostMessageW(Some(panel.hwnd()), windows::Win32::UI::WindowsAndMessaging::WM_CLOSE, WPARAM(0), LPARAM(0));
            }
            crate::win32::message_window::dispatch_pending_messages();
            assert_eq!(*events.closes.borrow(), 1, "Alt+F4 asks the island instead of destroying the window");
            assert_eq!(panel.bounds().width, 500, "and the window is still there");

            let widget = PluginWindow::create(look(false), Bounds { x: 0, y: 0, width: 200, height: 120 }, events.clone()).expect("widget");
            assert_eq!(widget.content(), Bounds { x: 0, y: 0, width: 200, height: 120 });
            let mut restyled = look(false);
            restyled.alpha = 128;
            restyled.click_through = true;
            restyled.resizable = true;
            restyled.layer = Layer::Desktop;
            widget.set_look(&restyled);
            let edge = widget.content().x;
            assert!(edge > 0, "a resizable window keeps a border to drag");
            drop(widget);
            drop(panel);
        })
        .join()
        .expect("window thread");
    }

}
