use windows::{
    core::{w, BSTR},
    Win32::System::{
        Com::{
            CoCreateInstance, CoSetProxyBlanket, CLSCTX_INPROC_SERVER, EOAC_NONE, RPC_C_AUTHN_LEVEL_CALL,
            RPC_C_IMP_LEVEL_IMPERSONATE,
        },
        Variant::VARIANT,
        Wmi::{
            IWbemClassObject, IWbemLocator, IWbemServices, WbemLocator, WBEM_FLAG_FORWARD_ONLY,
            WBEM_FLAG_RETURN_IMMEDIATELY, WBEM_GENERIC_FLAG_TYPE,
        },
    },
};

const AUTHN_WINNT: u32 = 10;
const AUTHZ_NONE: u32 = 0;
const READ_TIMEOUT_MS: i32 = 1000;

pub(crate) struct DisplayBrightness(IWbemServices);

impl DisplayBrightness {
    pub(crate) fn open() -> windows::core::Result<Self> {
        unsafe {
            let locator: IWbemLocator = CoCreateInstance(&WbemLocator, None, CLSCTX_INPROC_SERVER)?;
            let empty = BSTR::new();
            let services =
                locator.ConnectServer(&BSTR::from(r"ROOT\WMI"), &empty, &empty, &empty, 0, &empty, None)?;
            CoSetProxyBlanket(
                &services,
                AUTHN_WINNT,
                AUTHZ_NONE,
                None,
                RPC_C_AUTHN_LEVEL_CALL,
                RPC_C_IMP_LEVEL_IMPERSONATE,
                None,
                EOAC_NONE,
            )?;
            Ok(Self(services))
        }
    }

    pub(crate) fn percent(&self) -> Option<u32> {
        let flags = WBEM_GENERIC_FLAG_TYPE(WBEM_FLAG_FORWARD_ONLY.0 | WBEM_FLAG_RETURN_IMMEDIATELY.0);
        let query = BSTR::from("SELECT CurrentBrightness FROM WmiMonitorBrightness WHERE Active = TRUE");
        unsafe {
            let found = self.0.ExecQuery(&BSTR::from("WQL"), &query, flags, None).ok()?;
            let mut rows: [Option<IWbemClassObject>; 1] = [None];
            let mut returned = 0u32;
            let _ = found.Next(READ_TIMEOUT_MS, &mut rows, &mut returned);
            let row = rows[0].take().filter(|_| returned == 1)?;
            let mut value = VARIANT::default();
            row.Get(w!("CurrentBrightness"), 0, &mut value, None, None).ok()?;
            u32::try_from(&value).ok().map(|percent| percent.min(100))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::win32::com::ComApartment;

    #[test]
    fn brightness_reads_as_a_percentage_or_nothing() {
        let _com = ComApartment::multithreaded().unwrap();
        if let Ok(brightness) = DisplayBrightness::open() {
            assert!(brightness.percent().is_none_or(|percent| percent <= 100));
        }
    }
}
