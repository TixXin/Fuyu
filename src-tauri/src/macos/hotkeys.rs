use std::{
    cell::RefCell,
    sync::{Arc, Mutex, PoisonError},
};

use global_hotkey::{hotkey::HotKey, GlobalHotKeyEvent, GlobalHotKeyManager, HotKeyState};

type Handler = Arc<dyn Fn() + Send + Sync>;

pub(crate) enum HotkeyError {
    Manager(String),
    Register(String),
}

static HANDLERS: Mutex<Vec<(HotKey, Handler)>> = Mutex::new(Vec::new());
type Interceptor = fn(&HotKey) -> bool;

static INTERCEPTOR: Mutex<Option<Interceptor>> = Mutex::new(None);

pub(crate) fn set_interceptor(interceptor: Interceptor) {
    *INTERCEPTOR.lock().unwrap_or_else(PoisonError::into_inner) = Some(interceptor);
}

thread_local! {
    static MANAGER: RefCell<Option<GlobalHotKeyManager>> = const { RefCell::new(None) };
}

fn dispatch(event: GlobalHotKeyEvent) {
    if event.state() != HotKeyState::Pressed {
        return;
    }
    let found = HANDLERS
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .iter()
        .find(|(hotkey, _)| hotkey.id() == event.id())
        .map(|(hotkey, handler)| (*hotkey, Arc::clone(handler)));
    let Some((hotkey, handler)) = found else {
        return;
    };
    let interceptor = *INTERCEPTOR.lock().unwrap_or_else(PoisonError::into_inner);
    if interceptor.is_some_and(|intercept| intercept(&hotkey)) {
        return;
    }
    handler();
}

fn with_manager(action: impl FnOnce(&GlobalHotKeyManager) -> Result<(), HotkeyError>) -> Result<(), HotkeyError> {
    MANAGER.with(|cell| {
        let mut slot = cell.borrow_mut();
        if slot.is_none() {
            let manager = GlobalHotKeyManager::new().map_err(|error| HotkeyError::Manager(error.to_string()))?;
            GlobalHotKeyEvent::set_event_handler(Some(dispatch));
            *slot = Some(manager);
        }
        match slot.as_ref() {
            Some(manager) => action(manager),
            None => Err(HotkeyError::Manager("no hotkey manager".to_string())),
        }
    })
}

pub(crate) fn register(hotkey: HotKey, handler: impl Fn() + Send + Sync + 'static) -> Result<(), HotkeyError> {
    with_manager(|manager| manager.register(hotkey).map_err(|error| HotkeyError::Register(error.to_string())))?;
    HANDLERS.lock().unwrap_or_else(PoisonError::into_inner).push((hotkey, Arc::new(handler)));
    Ok(())
}

pub(crate) fn unregister(hotkey: HotKey) {
    let _ = with_manager(|manager| manager.unregister(hotkey).map_err(|error| HotkeyError::Register(error.to_string())));
    HANDLERS.lock().unwrap_or_else(PoisonError::into_inner).retain(|(known, _)| known.id() != hotkey.id());
}
