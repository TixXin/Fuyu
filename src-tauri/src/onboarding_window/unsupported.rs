crate::user_error::unsupported_commands!(open_onboarding_window, show_onboarding_window);

pub(crate) mod overlay {
    crate::user_error::unsupported_commands!(set_onboarding_card_rects);
}

macro_rules! tauri_commands {
    ($next:ident [$($done:tt)*] $($rest:tt)*) => {
        $next!([$($done)*
            crate::onboarding_window::open_onboarding_window,
            crate::onboarding_window::show_onboarding_window,
            crate::onboarding_window::overlay::set_onboarding_card_rects,
        ] $($rest)*)
    };
}
pub(crate) use tauri_commands;
