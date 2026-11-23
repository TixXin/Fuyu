use windows::{
    core::BOOL,
    Win32::{
        Devices::Display::{
            DestroyPhysicalMonitors, GetMonitorBrightness, GetNumberOfPhysicalMonitorsFromHMONITOR,
            GetPhysicalMonitorsFromHMONITOR, SetMonitorBrightness, PHYSICAL_MONITOR,
        },
        Foundation::{HANDLE, LPARAM, RECT},
        Graphics::Gdi::{EnumDisplayMonitors, HDC, HMONITOR},
    },
};

struct PhysicalMonitors(Vec<PHYSICAL_MONITOR>);

impl Drop for PhysicalMonitors {
    fn drop(&mut self) {
        if !self.0.is_empty() {
            let _ = unsafe { DestroyPhysicalMonitors(&self.0) };
        }
    }
}

impl PhysicalMonitors {
    fn handles(&self) -> impl Iterator<Item = HANDLE> + '_ {
        self.0.iter().map(|monitor| monitor.hPhysicalMonitor)
    }
}

unsafe extern "system" fn collect(monitor: HMONITOR, _: HDC, _: *mut RECT, data: LPARAM) -> BOOL {
    let list = unsafe { &mut *(data.0 as *mut Vec<HMONITOR>) };
    list.push(monitor);
    BOOL(1)
}

fn physical_monitors() -> PhysicalMonitors {
    let mut screens: Vec<HMONITOR> = Vec::new();
    let _ = unsafe {
        EnumDisplayMonitors(None, None, Some(collect), LPARAM(&mut screens as *mut Vec<HMONITOR> as isize))
    };
    let mut all = Vec::new();
    for screen in screens {
        let mut count = 0u32;
        if unsafe { GetNumberOfPhysicalMonitorsFromHMONITOR(screen, &mut count) }.is_err() || count == 0 {
            continue;
        }
        let mut found = vec![PHYSICAL_MONITOR::default(); count as usize];
        if unsafe { GetPhysicalMonitorsFromHMONITOR(screen, &mut found) }.is_ok() {
            all.extend(found);
        }
    }
    PhysicalMonitors(all)
}

fn range(monitor: HANDLE) -> Option<(u32, u32, u32)> {
    let (mut low, mut current, mut high) = (0u32, 0u32, 0u32);
    let ok = unsafe { GetMonitorBrightness(monitor, &mut low, &mut current, &mut high) } != 0;
    (ok && high > low).then_some((low, current.clamp(low, high), high))
}

pub(crate) fn percent() -> Option<u32> {
    let monitors = physical_monitors();
    let found = monitors.handles().find_map(range);
    found.map(|(low, current, high)| ((current - low) * 100 + (high - low) / 2) / (high - low))
}

pub(crate) fn set_percent(percent: u32) -> bool {
    let percent = percent.min(100);
    let monitors = physical_monitors();
    let mut changed = false;
    for monitor in monitors.handles() {
        if let Some((low, _, high)) = range(monitor) {
            let value = low + ((high - low) * percent + 50) / 100;
            changed |= unsafe { SetMonitorBrightness(monitor, value) } != 0;
        }
    }
    changed
}
