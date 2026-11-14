use std::{cell::RefCell, collections::HashMap, rc::Rc};
use windows::{
    core::PCWSTR,
    Win32::{
        Foundation::{HINSTANCE, HWND, LPARAM, LRESULT, POINT, RECT, WPARAM},
        Graphics::Gdi::{InvalidateRect, ScreenToClient},
        UI::{
            HiDpi::GetDpiForWindow,
            Input::KeyboardAndMouse::{GetActiveWindow, GetFocus, SetActiveWindow, SetFocus},
            WindowsAndMessaging::{
                DefWindowProcW, GetClientRect, GetWindowRect, GetWindowThreadProcessId, IsChild, IsWindow, LoadCursorW, PostMessageW,
                RegisterClassW, SetForegroundWindow, SetWindowPos, CS_HREDRAW, CS_VREDRAW, HTBOTTOM, HTBOTTOMLEFT, HTBOTTOMRIGHT,
                HTCAPTION, HTCLIENT, HTLEFT, HTRIGHT, HTTOP, HTTOPLEFT, HTTOPRIGHT, IDC_ARROW, MA_NOACTIVATE, MINMAXINFO, SC_MAXIMIZE, WM_ACTIVATEAPP,
                SC_MINIMIZE, SWP_NOACTIVATE, SWP_NOZORDER, WA_CLICKACTIVE, WA_INACTIVE, WM_ACTIVATE, WM_APP, WM_CLOSE, WM_DISPLAYCHANGE,
                WM_DPICHANGED, WM_ENTERSIZEMOVE, WM_EXITSIZEMOVE, WM_GETMINMAXINFO, WM_LBUTTONUP, WM_MOUSEACTIVATE, WM_MOVE, WM_NCHITTEST,
                WM_NCLBUTTONDBLCLK, WM_NCLBUTTONDOWN, WM_PAINT, WM_SETFOCUS, WM_SIZE, WM_SYSCOMMAND, WNDCLASSW,
            },
        },
    },
};

use super::{desktop, paint, wide, Bounds, Layer, Look, WindowEvents};

const CLASS: &str = "FuyuPluginWindow";
const GIVE_BACK_FOCUS: u32 = WM_APP + 0x51;

struct State {
    look: Look,
    events: Rc<dyn WindowEvents>,
    previous_active: Option<HWND>,
    previous_focus: Option<HWND>,
    moving: bool,
    desktop_was_active: bool,
}

thread_local! {
    static STATES: RefCell<HashMap<isize, State>> = RefCell::new(HashMap::new());
    static CLASS_NAME: RefCell<Option<Vec<u16>>> = const { RefCell::new(None) };
}

pub(super) fn instance() -> Result<HINSTANCE, String> {
    crate::win32::message_window::module_instance().map_err(|error| format!("Could not find the module: {error}"))
}

pub(super) fn register() -> Result<Vec<u16>, String> {
    if let Some(name) = CLASS_NAME.with(|name| name.borrow().clone()) {
        return Ok(name);
    }
    let name = wide(CLASS);
    let class = WNDCLASSW {
        style: CS_HREDRAW | CS_VREDRAW,
        lpfnWndProc: Some(window_proc),
        hInstance: instance()?,
        hCursor: unsafe { LoadCursorW(None, IDC_ARROW) }.unwrap_or_default(),
        lpszClassName: PCWSTR(name.as_ptr()),
        ..Default::default()
    };
    if unsafe { RegisterClassW(&class) } == 0 {
        let error = windows::core::Error::from_thread();
        if error.code() != windows::Win32::Foundation::ERROR_CLASS_ALREADY_EXISTS.to_hresult() {
            return Err(format!("Could not register the window class: {error}"));
        }
    }
    CLASS_NAME.with(|stored| *stored.borrow_mut() = Some(name.clone()));
    Ok(name)
}

pub(super) fn attach(hwnd: HWND, look: Look, events: Rc<dyn WindowEvents>) {
    STATES.with(|states| states.borrow_mut().insert(hwnd.0 as isize, State { look, events, previous_active: None, previous_focus: None, moving: false, desktop_was_active: false }));
}

pub(super) fn detach(hwnd: HWND) {
    let removed = STATES.with(|states| states.borrow_mut().remove(&(hwnd.0 as isize)));
    drop(removed);
}

pub(super) fn set_look(hwnd: HWND, look: Look) {
    STATES.with(|states| {
        if let Some(state) = states.borrow_mut().get_mut(&(hwnd.0 as isize)) {
            state.look = look;
        }
    });
}

fn with_state<T>(hwnd: HWND, read: impl FnOnce(&mut State) -> T) -> Option<T> {
    STATES.with(|states| states.try_borrow_mut().ok()?.get_mut(&(hwnd.0 as isize)).map(read))
}

fn scale(hwnd: HWND) -> f64 {
    f64::from(unsafe { GetDpiForWindow(hwnd) }.max(96)) / 96.0
}

fn border(hwnd: HWND, look: &Look) -> i32 {
    if look.resizable { (5.0 * scale(hwnd)).round() as i32 } else { 0 }
}

pub(super) fn content_rect(hwnd: HWND, client: RECT) -> Bounds {
    let Some(look) = with_state(hwnd, |state| state.look.clone()) else {
        return Bounds::from_rect(client);
    };
    let edge = border(hwnd, &look);
    let top = if look.caption.is_some() { paint::caption_height(scale(hwnd)) } else { edge };
    Bounds {
        x: edge,
        y: top,
        width: (client.right - client.left - edge * 2).max(0),
        height: (client.bottom - client.top - top - edge).max(0),
    }
}

pub(super) fn give_back_focus(hwnd: HWND) {
    let is_widget = with_state(hwnd, |state| state.look.caption.is_none() && !state.moving).unwrap_or(false);
    if is_widget {
        let _ = unsafe { PostMessageW(Some(hwnd), GIVE_BACK_FOCUS, WPARAM(0), LPARAM(0)) };
    }
}

fn restore_focus(hwnd: HWND) {
    let Some((active, focus)) = with_state(hwnd, |state| (state.previous_active.take(), state.previous_focus.take())) else { return };
    let usable = |window: Option<HWND>| window.filter(|window| !window.is_invalid() && *window != hwnd && unsafe { IsWindow(Some(*window)) }.as_bool());
    unsafe {
        if let Some(active) = usable(active) {
            let same_thread = GetWindowThreadProcessId(active, None) == GetWindowThreadProcessId(hwnd, None);
            if same_thread {
                let _ = SetActiveWindow(active);
            } else {
                let _ = SetForegroundWindow(active);
            }
        }
        if let Some(focus) = usable(focus).filter(|focus| !IsChild(hwnd, *focus).as_bool()) {
            let _ = SetFocus(Some(focus));
        }
        let still_ours = GetActiveWindow() == hwnd || (!GetFocus().is_invalid() && IsChild(hwnd, GetFocus()).as_bool());
        if still_ours {
            let _ = SetFocus(None);
        }
    }
}

fn hit_test(hwnd: HWND, look: &Look, lparam: LPARAM) -> u32 {
    let mut point = POINT { x: (lparam.0 & 0xFFFF) as i16 as i32, y: ((lparam.0 >> 16) & 0xFFFF) as i16 as i32 };
    let mut client = RECT::default();
    unsafe {
        let _ = ScreenToClient(hwnd, &mut point);
        let _ = GetClientRect(hwnd, &mut client);
    }
    let edge = border(hwnd, look);
    if edge > 0 {
        let (left, right) = (point.x < edge, point.x >= client.right - edge);
        let (top, bottom) = (point.y < edge, point.y >= client.bottom - edge);
        match (left, right, top, bottom) {
            (true, _, true, _) => return HTTOPLEFT,
            (_, true, true, _) => return HTTOPRIGHT,
            (true, _, _, true) => return HTBOTTOMLEFT,
            (_, true, _, true) => return HTBOTTOMRIGHT,
            (true, _, _, _) => return HTLEFT,
            (_, true, _, _) => return HTRIGHT,
            (_, _, true, _) => return HTTOP,
            (_, _, _, true) => return HTBOTTOM,
            _ => {}
        }
    }
    if look.caption.is_some() && point.y < paint::caption_height(scale(hwnd)) {
        return if paint::in_close_button(client, point, scale(hwnd)) { HTCLIENT } else { HTCAPTION };
    }
    HTCLIENT
}

fn handle(hwnd: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> Option<LRESULT> {
    let (look, events) = with_state(hwnd, |state| (state.look.clone(), state.events.clone()))?;
    let widget = look.caption.is_none();
    match message {
        WM_ACTIVATEAPP if look.layer == Layer::Desktop && wparam.0 != 0 => {
            let from_desktop = desktop::is_desktop_thread(hwnd, lparam.0 as u32);
            with_state(hwnd, |state| state.desktop_was_active = from_desktop);
            None
        }
        WM_NCHITTEST => Some(LRESULT(hit_test(hwnd, &look, lparam) as isize)),
        WM_PAINT => {
            paint::paint(hwnd, &look, scale(hwnd));
            Some(LRESULT(0))
        }
        WM_SIZE => {
            let mut client = RECT::default();
            let _ = unsafe { GetClientRect(hwnd, &mut client) };
            events.content_resized(content_rect(hwnd, client));
            let _ = unsafe { InvalidateRect(Some(hwnd), None, false) };
            Some(LRESULT(0))
        }
        WM_MOVE => {
            events.moved();
            None
        }
        WM_ENTERSIZEMOVE => {
            with_state(hwnd, |state| state.moving = true);
            None
        }
        WM_EXITSIZEMOVE => {
            with_state(hwnd, |state| state.moving = false);
            if widget {
                let _ = unsafe { PostMessageW(Some(hwnd), GIVE_BACK_FOCUS, WPARAM(0), LPARAM(0)) };
            }
            let mut rect = RECT::default();
            let _ = unsafe { GetWindowRect(hwnd, &mut rect) };
            events.user_moved(Bounds::from_rect(rect));
            None
        }
        WM_GETMINMAXINFO => {
            let info = lparam.0 as *mut MINMAXINFO;
            if let Some(info) = unsafe { info.as_mut() } {
                info.ptMinTrackSize = POINT { x: look.min_size.0, y: look.min_size.1 };
                info.ptMaxTrackSize = POINT { x: look.max_size.0, y: look.max_size.1 };
            }
            Some(LRESULT(0))
        }
        WM_DPICHANGED => {
            if let Some(rect) = unsafe { (lparam.0 as *const RECT).as_ref() } {
                let _ = unsafe { SetWindowPos(hwnd, None, rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top, SWP_NOZORDER | SWP_NOACTIVATE) };
            }
            Some(LRESULT(0))
        }
        WM_DISPLAYCHANGE => {
            events.displays_changed();
            None
        }
        WM_CLOSE => {
            events.close_requested();
            Some(LRESULT(0))
        }
        WM_LBUTTONUP if !widget => {
            let point = POINT { x: (lparam.0 & 0xFFFF) as i16 as i32, y: ((lparam.0 >> 16) & 0xFFFF) as i16 as i32 };
            let mut client = RECT::default();
            let _ = unsafe { GetClientRect(hwnd, &mut client) };
            if paint::in_close_button(client, point, scale(hwnd)) {
                events.close_requested();
            }
            Some(LRESULT(0))
        }
        WM_NCLBUTTONDOWN if wparam.0 == HTCAPTION as usize => {
            events.caption_used();
            None
        }
        WM_NCLBUTTONDBLCLK => Some(LRESULT(0)),
        WM_SYSCOMMAND if matches!((wparam.0 & 0xFFF0) as u32, SC_MAXIMIZE | SC_MINIMIZE) => Some(LRESULT(0)),
        WM_MOUSEACTIVATE if widget => Some(LRESULT(MA_NOACTIVATE as isize)),
        WM_ACTIVATE => {
            let kind = (wparam.0 & 0xFFFF) as u32;
            let active = kind != WA_INACTIVE;
            if look.layer == Layer::Desktop && active {
                let desktop_was_active = with_state(hwnd, |state| std::mem::take(&mut state.desktop_was_active)).unwrap_or(false);
                if !desktop_was_active {
                    desktop::lower_below_programs(hwnd);
                }
            }
            if widget && active {
                let previous = HWND(lparam.0 as *mut _);
                if !previous.is_invalid() && previous != hwnd {
                    with_state(hwnd, |state| state.previous_active = Some(previous));
                }
                let _ = unsafe { PostMessageW(Some(hwnd), GIVE_BACK_FOCUS, WPARAM(0), LPARAM(0)) };
            }
            events.activated(active, kind == WA_CLICKACTIVE);
            None
        }
        WM_SETFOCUS if widget => {
            let previous = HWND(wparam.0 as *mut _);
            if !previous.is_invalid() {
                with_state(hwnd, |state| state.previous_focus = Some(previous));
            }
            let _ = unsafe { PostMessageW(Some(hwnd), GIVE_BACK_FOCUS, WPARAM(0), LPARAM(0)) };
            Some(LRESULT(0))
        }
        GIVE_BACK_FOCUS => {
            if !with_state(hwnd, |state| state.moving).unwrap_or(false) {
                restore_focus(hwnd);
            }
            Some(LRESULT(0))
        }
        _ => None,
    }
}

unsafe extern "system" fn window_proc(hwnd: HWND, message: u32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if let Some(result) = handle(hwnd, message, wparam, lparam) {
        return result;
    }
    unsafe { DefWindowProcW(hwnd, message, wparam, lparam) }
}
