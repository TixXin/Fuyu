use plugin_base::{host_service, Serve};

mod first {
    #[plugin_base::host_service("dup.same")]
    pub fn one() -> u8 {
        1
    }
}

mod second {
    #[super::host_service("dup.same")]
    pub fn two() -> u8 {
        2
    }
}

#[test]
fn two_functions_with_one_name_stop_the_table_and_both_are_named() {
    let Err(error) = Serve::registered() else { panic!("a duplicate name must be refused") };
    assert!(error.starts_with("the Rust method dup.same is registered twice: macros_duplicate::first::one ("), "{error}");
    assert!(error.contains(" and macros_duplicate::second::two ("), "{error}");
    assert!(error.contains("macros_duplicate.rs:"), "{error}");
    assert_eq!(plugin_base::duplicates(&plugin_base::registrations()).len(), 1);
    assert_eq!(first::one() + second::two(), 3);
}
