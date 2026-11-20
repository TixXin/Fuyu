use tauri::{
    menu::{AboutMetadata, Menu, PredefinedMenuItem, Submenu},
    AppHandle, Manager, Wry,
};

use crate::tray::TrayLanguage;

struct Labels {
    name: &'static str,
    about: &'static str,
    services: &'static str,
    hide: &'static str,
    hide_others: &'static str,
    show_all: &'static str,
    quit: &'static str,
    edit: &'static str,
    undo: &'static str,
    redo: &'static str,
    cut: &'static str,
    copy: &'static str,
    paste: &'static str,
    select_all: &'static str,
    window: &'static str,
    minimize: &'static str,
    zoom: &'static str,
    close: &'static str,
}

const CHINESE: Labels = Labels {
    name: "浮屿",
    about: "关于浮屿",
    services: "服务",
    hide: "隐藏浮屿",
    hide_others: "隐藏其他",
    show_all: "全部显示",
    quit: "退出浮屿",
    edit: "编辑",
    undo: "撤销",
    redo: "重做",
    cut: "剪切",
    copy: "拷贝",
    paste: "粘贴",
    select_all: "全选",
    window: "窗口",
    minimize: "最小化",
    zoom: "缩放",
    close: "关闭窗口",
};

const ENGLISH: Labels = Labels {
    name: "Fuyu",
    about: "About Fuyu",
    services: "Services",
    hide: "Hide Fuyu",
    hide_others: "Hide Others",
    show_all: "Show All",
    quit: "Quit Fuyu",
    edit: "Edit",
    undo: "Undo",
    redo: "Redo",
    cut: "Cut",
    copy: "Copy",
    paste: "Paste",
    select_all: "Select All",
    window: "Window",
    minimize: "Minimize",
    zoom: "Zoom",
    close: "Close Window",
};

fn labels(language: TrayLanguage) -> &'static Labels {
    match language {
        TrayLanguage::Chinese => &CHINESE,
        TrayLanguage::English => &ENGLISH,
    }
}

pub(super) fn build(app: &AppHandle, language: TrayLanguage) -> tauri::Result<Menu<Wry>> {
    let text = labels(language);
    let about = AboutMetadata {
        name: Some(text.name.to_string()),
        version: Some(app.package_info().version.to_string()),
        ..Default::default()
    };
    let application = Submenu::with_items(
        app,
        text.name,
        true,
        &[
            &PredefinedMenuItem::about(app, Some(text.about), Some(about))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::services(app, Some(text.services))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::hide(app, Some(text.hide))?,
            &PredefinedMenuItem::hide_others(app, Some(text.hide_others))?,
            &PredefinedMenuItem::show_all(app, Some(text.show_all))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::quit(app, Some(text.quit))?,
        ],
    )?;
    let edit = Submenu::with_items(
        app,
        text.edit,
        true,
        &[
            &PredefinedMenuItem::undo(app, Some(text.undo))?,
            &PredefinedMenuItem::redo(app, Some(text.redo))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::cut(app, Some(text.cut))?,
            &PredefinedMenuItem::copy(app, Some(text.copy))?,
            &PredefinedMenuItem::paste(app, Some(text.paste))?,
            &PredefinedMenuItem::select_all(app, Some(text.select_all))?,
        ],
    )?;
    let window = Submenu::with_items(
        app,
        text.window,
        true,
        &[
            &PredefinedMenuItem::minimize(app, Some(text.minimize))?,
            &PredefinedMenuItem::maximize(app, Some(text.zoom))?,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::close_window(app, Some(text.close))?,
        ],
    )?;
    Menu::with_items(app, &[&application, &edit, &window])
}
