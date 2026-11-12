use std::sync::{
    atomic::{AtomicBool, AtomicIsize, AtomicU32, Ordering},
    Mutex,
};
use windows::Win32::{
    Foundation::{HWND, LPARAM, LRESULT, WPARAM},
    UI::{
        Input::KeyboardAndMouse::{
            GetAsyncKeyState, GetKeyState, VIRTUAL_KEY, VK_CLEAR, VK_CONTROL, VK_DOWN, VK_END, VK_HOME,
            VK_INSERT, VK_LEFT, VK_LWIN, VK_MENU, VK_NEXT, VK_NUMLOCK, VK_NUMPAD0, VK_NUMPAD9, VK_PRIOR,
            VK_RIGHT, VK_RWIN, VK_SHIFT, VK_UP,
        },
        WindowsAndMessaging::{
            CallNextHookEx, PostMessageW, SetWindowsHookExW, UnhookWindowsHookEx, HC_ACTION, HHOOK,
            KBDLLHOOKSTRUCT, LLKHF_EXTENDED, LLKHF_INJECTED, WH_KEYBOARD_LL, WM_KEYDOWN, WM_SYSKEYDOWN,
        },
    },
};

use super::input::{send_key_down, send_key_up};

const MASK_KEY: VIRTUAL_KEY = VIRTUAL_KEY(0xE8);
const KEY_V: u32 = b'V' as u32;

static HOOK: Mutex<Option<isize>> = Mutex::new(None);
static TARGET_WINDOW: AtomicIsize = AtomicIsize::new(0);
static TARGET_MESSAGE: AtomicU32 = AtomicU32::new(0);
static PASTE_WINDOW: AtomicIsize = AtomicIsize::new(0);
static PASTE_MESSAGE: AtomicU32 = AtomicU32::new(0);
static SWALLOWING_V: AtomicBool = AtomicBool::new(false);
static NUMPAD_WINDOW: AtomicIsize = AtomicIsize::new(0);
static NUMPAD_MESSAGE: AtomicU32 = AtomicU32::new(0);
static NUMPAD_DIGITS: AtomicU32 = AtomicU32::new(0);
static SWALLOWING_NUMPAD: AtomicU32 = AtomicU32::new(0);
static PRINT_WINDOW: AtomicIsize = AtomicIsize::new(0);
static PRINT_MESSAGE: AtomicU32 = AtomicU32::new(0);
static SWALLOWING_PRINT: AtomicBool = AtomicBool::new(false);
const KEY_PRINT_SCREEN: u32 = 0x2C;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct PrintScreenStep {
    pub(crate) take: bool,
    pub(crate) post: bool,
    pub(crate) swallowing: bool,
}

pub(crate) fn print_screen_step(pressed: bool, modifiers_down: bool, swallowing: bool) -> PrintScreenStep {
    match (pressed, swallowing) {
        (true, _) if modifiers_down => PrintScreenStep { take: false, post: false, swallowing },
        (true, already) => PrintScreenStep { take: true, post: !already, swallowing: true },
        (false, true) => PrintScreenStep { take: true, post: false, swallowing: false },
        (false, false) => PrintScreenStep { take: !modifiers_down, post: !modifiers_down, swallowing: false },
    }
}

fn take_print_screen(event: &KBDLLHOOKSTRUCT, pressed: bool) -> bool {
    let window = PRINT_WINDOW.load(Ordering::SeqCst);
    if window == 0 || event.vkCode != KEY_PRINT_SCREEN {
        return false;
    }
    let modifiers = [VK_CONTROL, VK_MENU, VK_SHIFT, VK_LWIN, VK_RWIN].into_iter().any(is_down);
    let step = print_screen_step(pressed, modifiers, SWALLOWING_PRINT.load(Ordering::SeqCst));
    SWALLOWING_PRINT.store(step.swallowing, Ordering::SeqCst);
    if step.post {
        post(window, PRINT_MESSAGE.load(Ordering::SeqCst));
    }
    step.take
}

fn post(window: isize, message: u32) {
    post_with(window, message, 0);
}

fn post_with(window: isize, message: u32, wparam: usize) {
    if window != 0 {
        let _ = unsafe { PostMessageW(Some(HWND(window as *mut core::ffi::c_void)), message, WPARAM(wparam), LPARAM(0)) };
    }
}

fn numlock_on() -> bool {
    (unsafe { GetKeyState(i32::from(VK_NUMLOCK.0)) } & 1) != 0
}

pub(crate) fn numpad_digit(vk: u32, extended: bool, numlock: bool, ctrl: bool, shift: bool, alt_or_win: bool) -> Option<u32> {
    if !ctrl || alt_or_win {
        return None;
    }
    if (u32::from(VK_NUMPAD0.0)..=u32::from(VK_NUMPAD9.0)).contains(&vk) {
        return shift.then_some(vk - u32::from(VK_NUMPAD0.0));
    }
    if extended || !numlock {
        return None;
    }
    let digit = [VK_INSERT, VK_END, VK_DOWN, VK_NEXT, VK_LEFT, VK_CLEAR, VK_RIGHT, VK_HOME, VK_UP, VK_PRIOR]
        .iter()
        .position(|key| u32::from(key.0) == vk)?;
    u32::try_from(digit).ok()
}

fn take_numpad(event: &KBDLLHOOKSTRUCT, pressed: bool) -> bool {
    let window = NUMPAD_WINDOW.load(Ordering::SeqCst);
    if window == 0 {
        return false;
    }
    if !pressed {
        return SWALLOWING_NUMPAD.compare_exchange(event.vkCode, 0, Ordering::SeqCst, Ordering::SeqCst).is_ok();
    }
    let extended = event.flags.0 & LLKHF_EXTENDED.0 != 0;
    let alt_or_win = is_down(VK_MENU) || is_down(VK_LWIN) || is_down(VK_RWIN);
    let Some(digit) = numpad_digit(event.vkCode, extended, numlock_on(), is_down(VK_CONTROL), is_down(VK_SHIFT), alt_or_win) else {
        return false;
    };
    if NUMPAD_DIGITS.load(Ordering::SeqCst) & (1 << digit) == 0 {
        return false;
    }
    if SWALLOWING_NUMPAD.swap(event.vkCode, Ordering::SeqCst) != event.vkCode {
        post_with(window, NUMPAD_MESSAGE.load(Ordering::SeqCst), digit as usize);
    }
    true
}

fn is_down(key: VIRTUAL_KEY) -> bool {
    (unsafe { GetAsyncKeyState(i32::from(key.0)) } as u16 & 0x8000) != 0
}

pub(crate) fn is_win_v(vk_code: u32, win_down: bool, ctrl_or_alt_down: bool) -> bool {
    vk_code == KEY_V && win_down && !ctrl_or_alt_down
}

unsafe extern "system" fn keyboard_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code == HC_ACTION as i32 {
        let event = unsafe { &*(lparam.0 as *const KBDLLHOOKSTRUCT) };
        let injected = event.flags.0 & LLKHF_INJECTED.0 != 0;
        let pressed = wparam.0 as u32 == WM_KEYDOWN || wparam.0 as u32 == WM_SYSKEYDOWN;
        if !injected && (take_numpad(event, pressed) || take_print_screen(event, pressed)) {
            return LRESULT(1);
        }
        if event.vkCode == KEY_V && !injected {
            if !pressed && SWALLOWING_V.swap(false, Ordering::SeqCst) {
                return LRESULT(1);
            }
            if !pressed && is_down(VK_CONTROL) {
                post(PASTE_WINDOW.load(Ordering::SeqCst), PASTE_MESSAGE.load(Ordering::SeqCst));
            }
            let win = is_down(VK_LWIN) || is_down(VK_RWIN);
            if pressed && TARGET_WINDOW.load(Ordering::SeqCst) != 0 && is_win_v(event.vkCode, win, is_down(VK_CONTROL) || is_down(VK_MENU)) {
                if !SWALLOWING_V.swap(true, Ordering::SeqCst) {
                    send_key_down(MASK_KEY);
                    send_key_up(MASK_KEY);
                    post(TARGET_WINDOW.load(Ordering::SeqCst), TARGET_MESSAGE.load(Ordering::SeqCst));
                }
                return LRESULT(1);
            }
        }
    }
    unsafe { CallNextHookEx(None, code, wparam, lparam) }
}

fn store(target: Option<(HWND, u32)>, window: &AtomicIsize, message: &AtomicU32) {
    let (handle, id) = target.map_or((0, 0), |(handle, id)| (handle.0 as isize, id));
    window.store(handle, Ordering::SeqCst);
    message.store(id, Ordering::SeqCst);
}

pub(crate) fn set(win_v: Option<(HWND, u32)>, paste: Option<(HWND, u32)>) -> windows::core::Result<()> {
    store(win_v, &TARGET_WINDOW, &TARGET_MESSAGE);
    store(paste, &PASTE_WINDOW, &PASTE_MESSAGE);
    if win_v.is_none() {
        SWALLOWING_V.store(false, Ordering::SeqCst);
    }
    sync_hook()
}

pub(crate) fn set_numpad(target: Option<(HWND, u32, u32)>) -> windows::core::Result<()> {
    store(target.map(|(window, message, _)| (window, message)), &NUMPAD_WINDOW, &NUMPAD_MESSAGE);
    NUMPAD_DIGITS.store(target.map_or(0, |(_, _, digits)| digits), Ordering::SeqCst);
    if target.is_none() {
        SWALLOWING_NUMPAD.store(0, Ordering::SeqCst);
    }
    sync_hook()
}

pub(crate) fn set_print_screen(target: Option<(HWND, u32)>) -> windows::core::Result<()> {
    store(target, &PRINT_WINDOW, &PRINT_MESSAGE);
    if target.is_none() {
        SWALLOWING_PRINT.store(false, Ordering::SeqCst);
    }
    sync_hook()
}

fn sync_hook() -> windows::core::Result<()> {
    let needed = [&TARGET_WINDOW, &PASTE_WINDOW, &NUMPAD_WINDOW, &PRINT_WINDOW]
        .iter()
        .any(|window| window.load(Ordering::SeqCst) != 0);
    let mut hook = HOOK.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    match (needed, hook.is_some()) {
        (true, false) => {
            let handle = unsafe { SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_proc), None, 0) }?;
            *hook = Some(handle.0 as isize);
        }
        (false, true) => {
            if let Some(handle) = hook.take() {
                let _ = unsafe { UnhookWindowsHookEx(HHOOK(handle as *mut core::ffi::c_void)) };
            }
        }
        _ => {}
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{is_win_v, numpad_digit};
    use windows::Win32::UI::Input::KeyboardAndMouse::{VK_CLEAR, VK_END, VK_HOME, VK_INSERT, VK_NUMPAD1, VK_NUMPAD7};

    #[test]
    fn ctrl_shift_numpad_digits_are_read_from_the_navigation_keys_numlock_turns_them_into() {
        let key = |vk: windows::Win32::UI::Input::KeyboardAndMouse::VIRTUAL_KEY| u32::from(vk.0);
        assert_eq!(numpad_digit(key(VK_END), false, true, true, false, false), Some(1));
        assert_eq!(numpad_digit(key(VK_HOME), false, true, true, false, false), Some(7));
        assert_eq!(numpad_digit(key(VK_CLEAR), false, true, true, false, false), Some(5));
        assert_eq!(numpad_digit(key(VK_INSERT), false, true, true, false, false), Some(0));
        assert_eq!(numpad_digit(key(VK_END), true, true, true, false, false), None);
        assert_eq!(numpad_digit(key(VK_END), false, false, true, false, false), None);
        assert_eq!(numpad_digit(key(VK_END), false, true, false, false, false), None);
        assert_eq!(numpad_digit(key(VK_END), false, true, true, false, true), None);
        assert_eq!(numpad_digit(key(VK_NUMPAD7), false, true, true, true, false), Some(7));
        assert_eq!(numpad_digit(key(VK_NUMPAD1), false, true, true, false, false), None);
        assert_eq!(numpad_digit(u32::from(b'1'), false, true, true, true, false), None);
    }

    #[test]
    fn a_plain_print_screen_is_taken_once_and_its_release_swallowed() {
        use super::{print_screen_step, PrintScreenStep};
        let step = |take, post, swallowing| PrintScreenStep { take, post, swallowing };
        assert_eq!(print_screen_step(true, false, false), step(true, true, true));
        assert_eq!(print_screen_step(true, false, true), step(true, false, true), "auto-repeat starts nothing new");
        assert_eq!(print_screen_step(false, false, true), step(true, false, false));
        assert_eq!(print_screen_step(true, true, false), step(false, false, false), "Alt+PrtSc and the like stay Windows'");
        assert_eq!(print_screen_step(false, false, false), step(true, true, false), "a release seen without its press still counts");
        assert_eq!(print_screen_step(false, true, false), step(false, false, false));
    }

    #[test]
    fn only_a_plain_win_v_is_taken() {
        assert!(is_win_v(u32::from(b'V'), true, false));
        assert!(!is_win_v(u32::from(b'V'), false, false));
        assert!(!is_win_v(u32::from(b'V'), true, true));
        assert!(!is_win_v(u32::from(b'C'), true, false));
    }
}
