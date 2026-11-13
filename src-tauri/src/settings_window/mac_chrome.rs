use tauri::utils::config::{LogicalPosition, WindowConfig};
use tauri::window::{Effect, EffectState, EffectsBuilder};
use tauri::TitleBarStyle;

const TRAFFIC_LIGHTS: LogicalPosition = LogicalPosition { x: 18.0, y: 22.0 };

pub(super) fn apply(config: &mut WindowConfig) {
    config.decorations = true;
    config.title_bar_style = TitleBarStyle::Overlay;
    config.hidden_title = true;
    config.traffic_light_position = Some(TRAFFIC_LIGHTS);
    config.transparent = true;
    config.background_color = None;
    config.window_effects = Some(
        EffectsBuilder::new()
            .effect(Effect::Sidebar)
            .state(EffectState::FollowsWindowActiveState)
            .build(),
    );
}
