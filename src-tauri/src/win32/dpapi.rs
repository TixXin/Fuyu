use windows::Win32::{
    Foundation::{LocalFree, HLOCAL},
    Security::Cryptography::{CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB},
};

pub(crate) fn unprotect(data: &[u8]) -> Option<Vec<u8>> {
    let input = CRYPT_INTEGER_BLOB { cbData: u32::try_from(data.len()).ok()?, pbData: data.as_ptr().cast_mut() };
    let mut output = CRYPT_INTEGER_BLOB::default();
    unsafe { CryptUnprotectData(&input, None, None, None, None, CRYPTPROTECT_UI_FORBIDDEN, &mut output) }.ok()?;
    if output.pbData.is_null() {
        return None;
    }
    let plain = unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize) }.to_vec();
    unsafe {
        let _ = LocalFree(Some(HLOCAL(output.pbData.cast())));
    }
    Some(plain)
}
