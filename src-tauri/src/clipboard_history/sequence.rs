use std::{
    collections::VecDeque,
    sync::{Mutex, PoisonError},
    thread,
    time::Duration,
};
use tauri::AppHandle;

use super::{hotkey::request_hotkey_refresh, popup, service};

const FIRST_PASTE_SETTLE: Duration = Duration::from_millis(350);

static QUEUE: Mutex<Option<VecDeque<String>>> = Mutex::new(None);

pub(super) fn is_running() -> bool {
    QUEUE.lock().unwrap_or_else(PoisonError::into_inner).is_some()
}

pub(super) fn stop() {
    if QUEUE.lock().unwrap_or_else(PoisonError::into_inner).take().is_some() {
        request_hotkey_refresh();
    }
}

pub(super) fn start(app: &AppHandle, ids: Vec<String>) -> Result<(), String> {
    let mut ids: VecDeque<String> = ids.into_iter().collect();
    let Some(first) = ids.pop_front() else {
        return Ok(());
    };
    let auto_paste = service()?.snapshot()?.settings.auto_paste;
    popup::paste(app, &first, popup::PasteOptions::default())?;
    if ids.is_empty() {
        return Ok(());
    }
    *QUEUE.lock().unwrap_or_else(PoisonError::into_inner) = Some(ids);
    request_hotkey_refresh();
    if auto_paste {
        thread::spawn(|| {
            thread::sleep(FIRST_PASTE_SETTLE);
            advance();
        });
    }
    Ok(())
}

pub(super) fn advance() {
    let next = {
        let mut queue = QUEUE.lock().unwrap_or_else(PoisonError::into_inner);
        let next = queue.as_mut().and_then(VecDeque::pop_front);
        if queue.as_ref().is_some_and(VecDeque::is_empty) || next.is_none() {
            *queue = None;
        }
        next
    };
    match next {
        Some(id) => {
            if let Err(error) = service().and_then(|service| service.copy_item(&id)) {
                eprintln!("failed to put the next entry of a paste sequence on the clipboard: {error}");
            }
            if !is_running() {
                request_hotkey_refresh();
            }
        }
        None => request_hotkey_refresh(),
    }
}
