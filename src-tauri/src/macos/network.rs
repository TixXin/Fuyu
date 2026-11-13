use std::{
    ffi::c_void,
    sync::mpsc,
    time::Duration,
};

use block2::{DynBlock, RcBlock};
use dispatch2::DispatchQueue;

const WAIT: Duration = Duration::from_secs(1);

#[link(name = "Network", kind = "framework")]
extern "C" {
    fn nw_path_monitor_create() -> *mut c_void;
    fn nw_path_monitor_set_queue(monitor: *mut c_void, queue: &DispatchQueue);
    fn nw_path_monitor_set_update_handler(monitor: *mut c_void, handler: &DynBlock<dyn Fn(*mut c_void)>);
    fn nw_path_monitor_start(monitor: *mut c_void);
    fn nw_path_monitor_cancel(monitor: *mut c_void);
    fn nw_path_is_expensive(path: *mut c_void) -> bool;
    fn nw_path_is_constrained(path: *mut c_void) -> bool;
    fn nw_release(object: *mut c_void);
}

pub(crate) fn is_metered() -> Option<bool> {
    let monitor = unsafe { nw_path_monitor_create() };
    if monitor.is_null() {
        return None;
    }
    let queue = DispatchQueue::new("com.tixxin.fuyu.network-cost", None);
    let (sender, receiver) = mpsc::channel();
    let handler = RcBlock::new(move |path: *mut c_void| {
        if !path.is_null() {
            let _ = sender.send(unsafe { nw_path_is_expensive(path) || nw_path_is_constrained(path) });
        }
    });
    unsafe {
        nw_path_monitor_set_queue(monitor, &queue);
        nw_path_monitor_set_update_handler(monitor, &handler);
        nw_path_monitor_start(monitor);
    }
    let metered = receiver.recv_timeout(WAIT).ok();
    unsafe {
        nw_path_monitor_cancel(monitor);
        nw_release(monitor);
    }
    metered
}
