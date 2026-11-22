use std::{
    collections::HashMap,
    sync::{Mutex, PoisonError},
    time::{Duration, Instant},
};

use dispatch2::{DispatchQueue, DispatchRetained};
use objc2::{
    define_class, msg_send,
    rc::{autoreleasepool, Allocated, Retained},
    runtime::{AnyClass, AnyObject},
    AllocAnyThread,
};
use objc2_foundation::{NSArray, NSData, NSObject, NSObjectProtocol, NSString};

use super::bluetooth_access::{allowed, battery_level};

const BATTERY_SERVICE: &str = "180F";
const BATTERY_LEVEL: &str = "2A19";
const POWERED_ON: isize = 5;
const REFRESH: Duration = Duration::from_secs(60);
const GIVE_UP: Duration = Duration::from_secs(30);

#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) struct BleBattery {
    pub(crate) id: String,
    pub(crate) name: String,
    pub(crate) battery: u8,
}

struct Central {
    manager: Retained<AnyObject>,
    _delegate: Retained<CentralDelegate>,
    queue: DispatchRetained<DispatchQueue>,
    reading: HashMap<String, (Retained<AnyObject>, Instant)>,
    refreshed: Option<Instant>,
}

unsafe impl Send for Central {}

static CENTRAL: Mutex<Option<Central>> = Mutex::new(None);
static RESULTS: Mutex<Vec<BleBattery>> = Mutex::new(Vec::new());

define_class!(
    #[unsafe(super(NSObject))]
    #[name = "FuyuBatteryCentral"]
    struct CentralDelegate;

    unsafe impl NSObjectProtocol for CentralDelegate {}

    impl CentralDelegate {
        #[unsafe(method(centralManagerDidUpdateState:))]
        fn did_update_state(&self, central: &AnyObject) {
            let state: isize = unsafe { msg_send![central, state] };
            if state == POWERED_ON {
                refresh_on_queue();
            }
        }

        #[unsafe(method(centralManager:didConnectPeripheral:))]
        fn did_connect(&self, _central: &AnyObject, peripheral: &AnyObject) {
            let services = uuids(&[BATTERY_SERVICE]);
            unsafe {
                let _: () = msg_send![peripheral, setDelegate: self];
                let _: () = msg_send![peripheral, discoverServices: services.as_deref()];
            }
        }

        #[unsafe(method(centralManager:didFailToConnectPeripheral:error:))]
        fn did_fail(&self, _central: &AnyObject, peripheral: &AnyObject, _error: *mut AnyObject) {
            finish(peripheral);
        }

        #[unsafe(method(peripheral:didDiscoverServices:))]
        fn did_discover_services(&self, peripheral: &AnyObject, _error: *mut AnyObject) {
            let services: Option<Retained<NSArray<AnyObject>>> = unsafe { msg_send![peripheral, services] };
            let Some(service) = list(services).into_iter().find(|service| uuid_is(service, BATTERY_SERVICE)) else {
                finish(peripheral);
                return;
            };
            let levels = uuids(&[BATTERY_LEVEL]);
            unsafe {
                let _: () = msg_send![peripheral, discoverCharacteristics: levels.as_deref(), forService: &*service];
            }
        }

        #[unsafe(method(peripheral:didDiscoverCharacteristicsForService:error:))]
        fn did_discover_characteristics(&self, peripheral: &AnyObject, service: &AnyObject, _error: *mut AnyObject) {
            let characteristics: Option<Retained<NSArray<AnyObject>>> = unsafe { msg_send![service, characteristics] };
            let Some(level) = list(characteristics).into_iter().find(|item| uuid_is(item, BATTERY_LEVEL)) else {
                finish(peripheral);
                return;
            };
            unsafe {
                let _: () = msg_send![peripheral, readValueForCharacteristic: &*level];
            }
        }

        #[unsafe(method(peripheral:didUpdateValueForCharacteristic:error:))]
        fn did_update_value(&self, peripheral: &AnyObject, characteristic: &AnyObject, _error: *mut AnyObject) {
            if uuid_is(characteristic, BATTERY_LEVEL) {
                let value: Option<Retained<NSData>> = unsafe { msg_send![characteristic, value] };
                let level = value.and_then(|value| value.to_vec().first().copied()).and_then(|byte| battery_level(isize::from(byte)));
                if let (Some(battery), Some(id)) = (level, identifier(peripheral)) {
                    let name = name(peripheral).unwrap_or_else(|| id.clone());
                    remember(BleBattery { id, name, battery });
                }
            }
            finish(peripheral);
        }
    }
);

impl CentralDelegate {
    fn new() -> Retained<Self> {
        let this = Self::alloc().set_ivars(());
        unsafe { msg_send![super(this), init] }
    }
}

fn list(items: Option<Retained<NSArray<AnyObject>>>) -> Vec<Retained<AnyObject>> {
    items.map(|items| items.to_vec()).unwrap_or_default()
}

fn uuids(values: &[&str]) -> Option<Retained<NSArray<AnyObject>>> {
    let class = AnyClass::get(c"CBUUID")?;
    let items: Vec<Retained<AnyObject>> = values
        .iter()
        .filter_map(|value| {
            let text = NSString::from_str(value);
            unsafe { msg_send![class, UUIDWithString: &*text] }
        })
        .collect();
    Some(NSArray::from_retained_slice(&items))
}

fn uuid_is(item: &AnyObject, expected: &str) -> bool {
    let uuid: Option<Retained<AnyObject>> = unsafe { msg_send![item, UUID] };
    let Some(uuid) = uuid else { return false };
    let text: Option<Retained<NSString>> = unsafe { msg_send![&*uuid, UUIDString] };
    text.is_some_and(|text| text.to_string().eq_ignore_ascii_case(expected))
}

fn identifier(peripheral: &AnyObject) -> Option<String> {
    let uuid: Option<Retained<AnyObject>> = unsafe { msg_send![peripheral, identifier] };
    let text: Option<Retained<NSString>> = unsafe { msg_send![&*uuid?, UUIDString] };
    text.map(|text| text.to_string())
}

fn name(peripheral: &AnyObject) -> Option<String> {
    let name: Option<Retained<NSString>> = unsafe { msg_send![peripheral, name] };
    name.map(|name| name.to_string()).filter(|name| !name.trim().is_empty())
}

pub(crate) fn merge_result(results: &mut Vec<BleBattery>, found: BleBattery) {
    match results.iter_mut().find(|item| item.id == found.id) {
        Some(item) => *item = found,
        None => results.push(found),
    }
}

fn remember(found: BleBattery) {
    merge_result(&mut RESULTS.lock().unwrap_or_else(PoisonError::into_inner), found);
}

fn finish(peripheral: &AnyObject) {
    let Some(id) = identifier(peripheral) else { return };
    let mut central = CENTRAL.lock().unwrap_or_else(PoisonError::into_inner);
    let Some(central) = central.as_mut() else { return };
    if central.reading.remove(&id).is_some() {
        unsafe {
            let _: () = msg_send![&*central.manager, cancelPeripheralConnection: peripheral];
        }
    }
}

fn refresh_on_queue() {
    autoreleasepool(|_| {
        let mut guard = CENTRAL.lock().unwrap_or_else(PoisonError::into_inner);
        let Some(central) = guard.as_mut() else { return };
        let state: isize = unsafe { msg_send![&*central.manager, state] };
        if state != POWERED_ON {
            return;
        }
        central.refreshed = Some(Instant::now());
        let Some(services) = uuids(&[BATTERY_SERVICE]) else { return };
        let connected: Option<Retained<NSArray<AnyObject>>> =
            unsafe { msg_send![&*central.manager, retrieveConnectedPeripheralsWithServices: &*services] };
        let connected = list(connected);
        let ids: Vec<String> = connected.iter().filter_map(|peripheral| identifier(peripheral)).collect();
        RESULTS.lock().unwrap_or_else(PoisonError::into_inner).retain(|item| ids.contains(&item.id));
        let stale: Vec<String> = central.reading.iter().filter(|(_, (_, at))| at.elapsed() >= GIVE_UP).map(|(id, _)| id.clone()).collect();
        for id in stale {
            if let Some((peripheral, _)) = central.reading.remove(&id) {
                unsafe {
                    let _: () = msg_send![&*central.manager, cancelPeripheralConnection: &*peripheral];
                }
            }
        }
        for peripheral in connected {
            let Some(id) = identifier(&peripheral) else { continue };
            if central.reading.contains_key(&id) {
                continue;
            }
            unsafe {
                let _: () = msg_send![&*central.manager, connectPeripheral: &*peripheral, options: None::<&AnyObject>];
            }
            central.reading.insert(id, (peripheral, Instant::now()));
        }
    });
}

pub(crate) fn start() {
    let mut guard = CENTRAL.lock().unwrap_or_else(PoisonError::into_inner);
    if guard.is_some() {
        return;
    }
    let Some(class) = AnyClass::get(c"CBCentralManager") else { return };
    let queue = DispatchQueue::new("com.tixxin.fuyu.ble-battery", None);
    let delegate = CentralDelegate::new();
    let manager: Option<Retained<AnyObject>> = unsafe {
        let allocated: Allocated<AnyObject> = msg_send![class, alloc];
        msg_send![allocated, initWithDelegate: &*delegate, queue: &*queue]
    };
    let Some(manager) = manager else { return };
    *guard = Some(Central { manager, _delegate: delegate, queue, reading: HashMap::new(), refreshed: None });
}

pub(crate) fn refresh_now() {
    let queue = CENTRAL.lock().unwrap_or_else(PoisonError::into_inner).as_ref().map(|central| central.queue.clone());
    if let Some(queue) = queue {
        queue.exec_async(refresh_on_queue);
    }
}

pub(crate) fn ble_batteries() -> Vec<BleBattery> {
    if !allowed() {
        return Vec::new();
    }
    start();
    let due = CENTRAL
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .as_ref()
        .is_some_and(|central| central.refreshed.is_none_or(|at| at.elapsed() >= REFRESH));
    if due {
        refresh_now();
    }
    RESULTS.lock().unwrap_or_else(PoisonError::into_inner).clone()
}

#[cfg(test)]
mod tests {
    use super::{merge_result, BleBattery};

    fn battery(id: &str, level: u8) -> BleBattery {
        BleBattery { id: id.into(), name: "MX Master".into(), battery: level }
    }

    #[test]
    fn a_new_reading_replaces_the_old_one_for_the_same_device() {
        let mut results = vec![battery("A", 80)];
        merge_result(&mut results, battery("A", 75));
        merge_result(&mut results, battery("B", 40));
        assert_eq!(results, vec![battery("A", 75), battery("B", 40)]);
    }
}
