//! Taking Win+V from Windows' clipboard history (C22.3). Explorer owns Win+V through
//! RegisterHotKey, so registering it again fails; a low-level keyboard hook sees the key first and
//! can swallow it, as EcoPaste does. Nothing in the registry changes and Explorer is not restarted:
//! removing the hook gives Win+V back at once. The same hook also reports each Ctrl+V the user
//! presses while a paste sequence runs (C24.7), so the next entry can go on the clipboard. And it
//! sees Ctrl+Shift with a numpad digit for the screenshot shortcuts (C41.1), which RegisterHotKey
//! cannot: with NumLock on, Shift turns a numpad key into a navigation key (see `numpad_digit`).

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

/// An unassigned virtual key: tapping it while Win is held makes Windows treat Win as part of a
/// combination, so releasing Win does not open the Start menu.
const MASK_KEY: VIRTUAL_KEY = VIRTUAL_KEY(0xE8);
const KEY_V: u32 = b'V' as u32;

static HOOK: Mutex<Option<isize>> = Mutex::new(None);
/// The window and message the hook posts for each Win+V; 0 while Win+V is Windows'.
static TARGET_WINDOW: AtomicIsize = AtomicIsize::new(0);
static TARGET_MESSAGE: AtomicU32 = AtomicU32::new(0);
/// The window and message posted when the user releases Ctrl+V; 0 while no sequence runs.
static PASTE_WINDOW: AtomicIsize = AtomicIsize::new(0);
static PASTE_MESSAGE: AtomicU32 = AtomicU32::new(0);
/// A V press was swallowed, so its release is swallowed too (the app under it saw no press).
static SWALLOWING_V: AtomicBool = AtomicBool::new(false);
/// The window and message posted (wparam = the digit) for Ctrl+Shift+numpad digit; 0 while off.
static NUMPAD_WINDOW: AtomicIsize = AtomicIsize::new(0);
static NUMPAD_MESSAGE: AtomicU32 = AtomicU32::new(0);
/// Bit `d` set: Ctrl+Shift+numpad `d` is taken. Other digits pass on to the app in front.
static NUMPAD_DIGITS: AtomicU32 = AtomicU32::new(0);
/// The virtual key of a numpad press that was swallowed, so its release is too; 0 for none.
static SWALLOWING_NUMPAD: AtomicU32 = AtomicU32::new(0);

fn post(window: isize, message: u32) {
    post_with(window, message, 0);
}

fn post_with(window: isize, message: u32, wparam: usize) {
    if window != 0 {
        // SAFETY: posts a message whose parameters are plain numbers, so no pointer crosses over;
        // a window that went away only makes the post fail.
        let _ = unsafe { PostMessageW(Some(HWND(window as *mut core::ffi::c_void)), message, WPARAM(wparam), LPARAM(0)) };
    }
}

fn numlock_on() -> bool {
    // SAFETY: GetKeyState takes a key code by value; the low bit is the toggle state.
    (unsafe { GetKeyState(i32::from(VK_NUMLOCK.0)) } & 1) != 0
}

/// The numpad digit a key event stands for when Ctrl and Shift are held, or `None`.
///
/// With NumLock on, Windows makes Shift + a numpad key behave as the navigation key printed on it:
/// it sends a fake Shift release, then End, Down, ... without the extended flag (the separate
/// arrow and navigation keys have it), so Shift no longer reads as held. Such a key with Ctrl held
/// is therefore Ctrl+Shift+numpad digit. With NumLock off a numpad key is a navigation key even
/// without Shift, so Ctrl+Shift+numpad 1 is Ctrl+Shift+End there and stays the editor's.
/// `VK_NUMPAD0`–`9` with Ctrl and Shift held (keyboards that do not fake the release) count too.
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

/// Handles a numpad key while the screenshot shortcuts are on; true when it is swallowed.
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
    // Auto-repeat while held takes no second screenshot, but stays swallowed.
    if SWALLOWING_NUMPAD.swap(event.vkCode, Ordering::SeqCst) != event.vkCode {
        post_with(window, NUMPAD_MESSAGE.load(Ordering::SeqCst), digit as usize);
    }
    true
}

fn is_down(key: VIRTUAL_KEY) -> bool {
    // SAFETY: GetAsyncKeyState takes a key code by value and reads no caller memory.
    (unsafe { GetAsyncKeyState(i32::from(key.0)) } as u16 & 0x8000) != 0
}

/// Whether a key event is the V of a plain Win+V (no Ctrl or Alt: those are other shortcuts).
pub(crate) fn is_win_v(vk_code: u32, win_down: bool, ctrl_or_alt_down: bool) -> bool {
    vk_code == KEY_V && win_down && !ctrl_or_alt_down
}

unsafe extern "system" fn keyboard_proc(code: i32, wparam: WPARAM, lparam: LPARAM) -> LRESULT {
    if code == HC_ACTION as i32 {
        // SAFETY: for WH_KEYBOARD_LL with HC_ACTION, lparam points to a KBDLLHOOKSTRUCT that the
        // system keeps valid for the duration of this call.
        let event = unsafe { &*(lparam.0 as *const KBDLLHOOKSTRUCT) };
        let injected = event.flags.0 & LLKHF_INJECTED.0 != 0;
        let pressed = wparam.0 as u32 == WM_KEYDOWN || wparam.0 as u32 == WM_SYSKEYDOWN;
        if !injected && take_numpad(event, pressed) {
            return LRESULT(1);
        }
        if event.vkCode == KEY_V && !injected {
            if !pressed && SWALLOWING_V.swap(false, Ordering::SeqCst) {
                return LRESULT(1);
            }
            // The user pasted (the app read the clipboard on the press); never swallowed.
            if !pressed && is_down(VK_CONTROL) {
                post(PASTE_WINDOW.load(Ordering::SeqCst), PASTE_MESSAGE.load(Ordering::SeqCst));
            }
            let win = is_down(VK_LWIN) || is_down(VK_RWIN);
            if pressed && TARGET_WINDOW.load(Ordering::SeqCst) != 0 && is_win_v(event.vkCode, win, is_down(VK_CONTROL) || is_down(VK_MENU)) {
                // Auto-repeat while held opens nothing more, but stays swallowed.
                if !SWALLOWING_V.swap(true, Ordering::SeqCst) {
                    send_key_down(MASK_KEY);
                    send_key_up(MASK_KEY);
                    post(TARGET_WINDOW.load(Ordering::SeqCst), TARGET_MESSAGE.load(Ordering::SeqCst));
                }
                return LRESULT(1);
            }
        }
    }
    // SAFETY: passes the hook's own arguments on unchanged; the hook handle is ignored since Vista.
    unsafe { CallNextHookEx(None, code, wparam, lparam) }
}

fn store(target: Option<(HWND, u32)>, window: &AtomicIsize, message: &AtomicU32) {
    let (handle, id) = target.map_or((0, 0), |(handle, id)| (handle.0 as isize, id));
    window.store(handle, Ordering::SeqCst);
    message.store(id, Ordering::SeqCst);
}

/// Sets what the hook does: post `win_v`'s message on each Win+V and keep the key from Windows,
/// and post `paste`'s message on each Ctrl+V the user releases. The hook runs while either is set
/// and is removed when neither is. Must run on a thread with a message loop (the hook is called on
/// it), and the callback must stay quick: Windows drops hooks that take too long.
pub(crate) fn set(win_v: Option<(HWND, u32)>, paste: Option<(HWND, u32)>) -> windows::core::Result<()> {
    store(win_v, &TARGET_WINDOW, &TARGET_MESSAGE);
    store(paste, &PASTE_WINDOW, &PASTE_MESSAGE);
    if win_v.is_none() {
        SWALLOWING_V.store(false, Ordering::SeqCst);
    }
    sync_hook()
}

/// Sets the screenshot shortcuts' numpad half: for Ctrl+Shift + a numpad digit whose bit is set
/// in `digits`, post `message` to `window` with the digit as wparam and keep the key from the app
/// in front. `None` stops it. Same thread rule as [`set`]; leaves Win+V and paste as they are.
pub(crate) fn set_numpad(target: Option<(HWND, u32, u32)>) -> windows::core::Result<()> {
    store(target.map(|(window, message, _)| (window, message)), &NUMPAD_WINDOW, &NUMPAD_MESSAGE);
    NUMPAD_DIGITS.store(target.map_or(0, |(_, _, digits)| digits), Ordering::SeqCst);
    if target.is_none() {
        SWALLOWING_NUMPAD.store(0, Ordering::SeqCst);
    }
    sync_hook()
}

/// Installs the hook while anything needs it and removes it when nothing does.
fn sync_hook() -> windows::core::Result<()> {
    let needed = [&TARGET_WINDOW, &PASTE_WINDOW, &NUMPAD_WINDOW]
        .iter()
        .any(|window| window.load(Ordering::SeqCst) != 0);
    let mut hook = HOOK.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    match (needed, hook.is_some()) {
        (true, false) => {
            // SAFETY: keyboard_proc matches HOOKPROC and lives for the whole program; a
            // low-level hook needs no module handle or thread id.
            let handle = unsafe { SetWindowsHookExW(WH_KEYBOARD_LL, Some(keyboard_proc), None, 0) }?;
            *hook = Some(handle.0 as isize);
        }
        (false, true) => {
            if let Some(handle) = hook.take() {
                // SAFETY: the handle came from SetWindowsHookExW above and is removed only once.
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
        // NumLock on, Shift released by Windows: numpad 1 arrives as End without the extended flag.
        assert_eq!(numpad_digit(key(VK_END), false, true, true, false, false), Some(1));
        assert_eq!(numpad_digit(key(VK_HOME), false, true, true, false, false), Some(7));
        assert_eq!(numpad_digit(key(VK_CLEAR), false, true, true, false, false), Some(5));
        assert_eq!(numpad_digit(key(VK_INSERT), false, true, true, false, false), Some(0));
        // The separate End key has the extended flag: Ctrl+End stays the editor's.
        assert_eq!(numpad_digit(key(VK_END), true, true, true, false, false), None);
        // NumLock off: numpad 1 is End anyway, so Ctrl+Shift+End is left alone.
        assert_eq!(numpad_digit(key(VK_END), false, false, true, false, false), None);
        // Without Ctrl, or with Alt or Win, nothing is taken.
        assert_eq!(numpad_digit(key(VK_END), false, true, false, false, false), None);
        assert_eq!(numpad_digit(key(VK_END), false, true, true, false, true), None);
        // Keyboards that send the digit itself with Shift held.
        assert_eq!(numpad_digit(key(VK_NUMPAD7), false, true, true, true, false), Some(7));
        assert_eq!(numpad_digit(key(VK_NUMPAD1), false, true, true, false, false), None);
        // Other keys are not digits.
        assert_eq!(numpad_digit(u32::from(b'1'), false, true, true, true, false), None);
    }

    #[test]
    fn only_a_plain_win_v_is_taken() {
        assert!(is_win_v(u32::from(b'V'), true, false));
        assert!(!is_win_v(u32::from(b'V'), false, false));
        assert!(!is_win_v(u32::from(b'V'), true, true));
        assert!(!is_win_v(u32::from(b'C'), true, false));
    }
}
