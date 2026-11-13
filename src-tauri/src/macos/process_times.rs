pub(crate) fn start_time(process_id: u32) -> Option<u64> {
    let info = super::proc_info::bsd_info(process_id)?;
    Some(info.pbi_start_tvsec.saturating_mul(1_000_000).saturating_add(info.pbi_start_tvusec))
}
