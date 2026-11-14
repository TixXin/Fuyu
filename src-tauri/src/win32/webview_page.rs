use std::rc::Rc;
use webview2_com::{
    take_pwstr, AcceleratorKeyPressedEventHandler, AddScriptToExecuteOnDocumentCreatedCompletedHandler,
    CreateCoreWebView2ControllerCompletedHandler, DownloadStartingEventHandler, FocusChangedEventHandler, Microsoft::Web::WebView2::Win32::*, NavigationStartingEventHandler,
    NewWindowRequestedEventHandler, PermissionRequestedEventHandler, WebMessageReceivedEventHandler,
    WebResourceRequestedEventHandler,
};
use windows::{
    core::{Interface, HSTRING, PWSTR},
    Win32::{
        Foundation::{HWND, RECT},
        UI::{
            Input::KeyboardAndMouse::VK_ESCAPE,
            Shell::SHCreateMemStream,
            WindowsAndMessaging::{GetAncestor, GetWindow, SetWindowPos, GA_ROOT, GW_CHILD, GW_HWNDNEXT, HWND_TOP, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE},
        },
    },
};

pub(crate) use webview2_com::Microsoft::Web::WebView2::Win32::{ICoreWebView2Controller, ICoreWebView2Environment};

pub(crate) struct Resource {
    pub status: u16,
    pub headers: Vec<String>,
    pub body: Vec<u8>,
}

pub(crate) trait PageHost {
    fn resource(&self, url: &str) -> Option<Resource>;
    fn may_navigate(&self, url: &str, frame: bool) -> bool;
    fn message(&self, source: &str, json: String);
    fn escape(&self) -> bool {
        false
    }
    fn focused(&self) {}
}

pub(crate) struct PageOptions {
    pub start_url: String,
    pub init_script: String,
    pub dev_tools: bool,
}

pub(crate) struct Page {
    controller: ICoreWebView2Controller,
    webview: ICoreWebView2,
    window: Option<HWND>,
}

fn child_windows(parent: HWND) -> Vec<HWND> {
    let mut windows = Vec::new();
    let mut next = unsafe { GetWindow(parent, GW_CHILD) };
    while let Ok(window) = next {
        if window.is_invalid() || windows.len() >= 64 {
            break;
        }
        windows.push(window);
        next = unsafe { GetWindow(window, GW_HWNDNEXT) };
    }
    windows
}

pub(crate) fn parent_window(controller: &ICoreWebView2Controller) -> Result<HWND, String> {
    let mut hwnd = HWND::default();
    unsafe { controller.ParentWindow(&mut hwnd) }.map_err(|error| format!("Could not find the island window: {error}"))?;
    let root = unsafe { GetAncestor(hwnd, GA_ROOT) };
    Ok(if root.is_invalid() { hwnd } else { root })
}

pub(crate) fn create(
    env: &ICoreWebView2Environment,
    parent: HWND,
    options: PageOptions,
    host: Rc<dyn PageHost>,
    done: impl FnOnce(Result<Page, String>) + 'static,
) -> Result<(), String> {
    let env10: ICoreWebView2Environment10 = env
        .cast()
        .map_err(|_| "Plugin pages need a newer WebView2 runtime.".to_string())?;
    let page_env = env.clone();
    let before = child_windows(parent);
    let handler = CreateCoreWebView2ControllerCompletedHandler::create(Box::new(move |result, controller| {
        let window = child_windows(parent).into_iter().find(|window| !before.contains(window));
        let page = result
            .map_err(|error| format!("WebView2 could not create the page: {error}"))
            .and_then(|()| controller.ok_or_else(|| "WebView2 returned no page.".to_string()))
            .and_then(|controller| set_up(&page_env, controller, window, options, host));
        done(page);
        Ok(())
    }));
    unsafe {
        let controller_options = env10
            .CreateCoreWebView2ControllerOptions()
            .map_err(|error| format!("Could not set up the page: {error}"))?;
        controller_options
            .SetIsInPrivateModeEnabled(true)
            .map_err(|error| format!("Could not set up the page: {error}"))?;
        env10
            .CreateCoreWebView2ControllerWithOptions(parent, &controller_options, &handler)
            .map_err(|error| format!("Could not create the page: {error}"))
    }
}

fn set_up(
    env: &ICoreWebView2Environment,
    controller: ICoreWebView2Controller,
    window: Option<HWND>,
    options: PageOptions,
    host: Rc<dyn PageHost>,
) -> Result<Page, String> {
    let fail = |error: windows::core::Error| format!("Could not set up the page: {error}");
    let webview = unsafe {
        controller.SetIsVisible(false).map_err(fail)?;
        if let Ok(controller2) = controller.cast::<ICoreWebView2Controller2>() {
            controller2.SetDefaultBackgroundColor(COREWEBVIEW2_COLOR { A: 0, R: 0, G: 0, B: 0 }).map_err(fail)?;
        }
        let webview = controller.CoreWebView2().map_err(fail)?;
        harden(&webview, options.dev_tools).map_err(fail)?;
        guard_requests(&webview, env, host.clone()).map_err(fail)?;
        guard_navigation(&webview, host.clone()).map_err(fail)?;
        listen_for_messages(&webview, host.clone()).map_err(fail)?;
        listen_for_keys_and_focus(&controller, host).map_err(fail)?;
        webview
    };
    let page = Page { controller, webview, window };
    let navigate_webview = page.webview.clone();
    let start_url = HSTRING::from(options.start_url);
    let after_script = AddScriptToExecuteOnDocumentCreatedCompletedHandler::create(Box::new(move |_, _| {
        unsafe { navigate_webview.Navigate(&start_url) }
    }));
    unsafe { page.webview.AddScriptToExecuteOnDocumentCreated(&HSTRING::from(options.init_script), &after_script) }.map_err(fail)?;
    Ok(page)
}

unsafe fn harden(webview: &ICoreWebView2, dev_tools: bool) -> windows::core::Result<()> {
    let new_window = NewWindowRequestedEventHandler::create(Box::new(|_, args| {
        if let Some(args) = args {
            unsafe { args.SetHandled(true)? };
        }
        Ok(())
    }));
    let permission = PermissionRequestedEventHandler::create(Box::new(|_, args| {
        if let Some(args) = args {
            unsafe { args.SetState(COREWEBVIEW2_PERMISSION_STATE_DENY)? };
        }
        Ok(())
    }));
    let download = DownloadStartingEventHandler::create(Box::new(|_, args| {
        if let Some(args) = args {
            unsafe { args.SetCancel(true)? };
        }
        Ok(())
    }));
    unsafe {
        let settings = webview.Settings()?;
        settings.SetIsScriptEnabled(true)?;
        settings.SetIsWebMessageEnabled(true)?;
        settings.SetAreHostObjectsAllowed(false)?;
        settings.SetAreDefaultScriptDialogsEnabled(false)?;
        settings.SetIsStatusBarEnabled(false)?;
        settings.SetIsZoomControlEnabled(false)?;
        settings.SetAreDevToolsEnabled(dev_tools)?;
        settings.SetAreDefaultContextMenusEnabled(dev_tools)?;
        if let Ok(settings3) = settings.cast::<ICoreWebView2Settings3>() {
            settings3.SetAreBrowserAcceleratorKeysEnabled(dev_tools)?;
        }
        if let Ok(settings5) = settings.cast::<ICoreWebView2Settings5>() {
            settings5.SetIsPinchZoomEnabled(false)?;
        }
        if let Ok(settings6) = settings.cast::<ICoreWebView2Settings6>() {
            settings6.SetIsSwipeNavigationEnabled(false)?;
        }
        let mut token = 0i64;
        webview.add_NewWindowRequested(&new_window, &mut token)?;
        webview.add_PermissionRequested(&permission, &mut token)?;
        if let Ok(webview4) = webview.cast::<ICoreWebView2_4>() {
            webview4.add_DownloadStarting(&download, &mut token)?;
        }
        Ok(())
    }
}

unsafe fn guard_requests(webview: &ICoreWebView2, env: &ICoreWebView2Environment, host: Rc<dyn PageHost>) -> windows::core::Result<()> {
    let filter = HSTRING::from("*");
    let env = env.clone();
    let handler = WebResourceRequestedEventHandler::create(Box::new(move |_, args| {
        let Some(args) = args else { return Ok(()) };
        unsafe {
            let mut uri = PWSTR::null();
            args.Request()?.Uri(&mut uri)?;
            let uri = take_pwstr(uri);
            let response = match host.resource(&uri) {
                Some(resource) => {
                    let stream = if resource.body.is_empty() { None } else { SHCreateMemStream(Some(&resource.body)) };
                    env.CreateWebResourceResponse(
                        stream.as_ref(),
                        i32::from(resource.status),
                        &HSTRING::from(reason(resource.status)),
                        &HSTRING::from(resource.headers.join("\r\n")),
                    )?
                }
                None => env.CreateWebResourceResponse(None, 403, &HSTRING::from("Forbidden"), &HSTRING::new())?,
            };
            args.SetResponse(&response)
        }
    }));
    unsafe {
        match webview.cast::<ICoreWebView2_22>() {
            Ok(webview22) => webview22.AddWebResourceRequestedFilterWithRequestSourceKinds(
                &filter,
                COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL,
                COREWEBVIEW2_WEB_RESOURCE_REQUEST_SOURCE_KINDS_ALL,
            )?,
            Err(_) => webview.AddWebResourceRequestedFilter(&filter, COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL)?,
        }
        let mut token = 0i64;
        webview.add_WebResourceRequested(&handler, &mut token)
    }
}

fn reason(status: u16) -> &'static str {
    match status {
        200 => "OK",
        404 => "Not Found",
        _ => "Forbidden",
    }
}

unsafe fn guard_navigation(webview: &ICoreWebView2, host: Rc<dyn PageHost>) -> windows::core::Result<()> {
    let handler = |frame: bool, host: Rc<dyn PageHost>| {
        NavigationStartingEventHandler::create(Box::new(move |_, args| {
            let Some(args) = args else { return Ok(()) };
            unsafe {
                let mut uri = PWSTR::null();
                args.Uri(&mut uri)?;
                if !host.may_navigate(&take_pwstr(uri), frame) {
                    args.SetCancel(true)?;
                }
            }
            Ok(())
        }))
    };
    let mut token = 0i64;
    unsafe {
        webview.add_NavigationStarting(&handler(false, host.clone()), &mut token)?;
        webview.add_FrameNavigationStarting(&handler(true, host), &mut token)
    }
}

unsafe fn listen_for_messages(webview: &ICoreWebView2, host: Rc<dyn PageHost>) -> windows::core::Result<()> {
    let handler = WebMessageReceivedEventHandler::create(Box::new(move |_, args| {
        let Some(args) = args else { return Ok(()) };
        unsafe {
            let mut source = PWSTR::null();
            args.Source(&mut source)?;
            let mut json = PWSTR::null();
            args.WebMessageAsJson(&mut json)?;
            host.message(&take_pwstr(source), take_pwstr(json));
        }
        Ok(())
    }));
    let mut token = 0i64;
    unsafe { webview.add_WebMessageReceived(&handler, &mut token) }
}

unsafe fn listen_for_keys_and_focus(controller: &ICoreWebView2Controller, host: Rc<dyn PageHost>) -> windows::core::Result<()> {
    let key_host = host.clone();
    let keys = AcceleratorKeyPressedEventHandler::create(Box::new(move |_, args| {
        let Some(args) = args else { return Ok(()) };
        unsafe {
            let mut kind = COREWEBVIEW2_KEY_EVENT_KIND::default();
            args.KeyEventKind(&mut kind)?;
            let mut key = 0u32;
            args.VirtualKey(&mut key)?;
            let pressed = kind == COREWEBVIEW2_KEY_EVENT_KIND_KEY_DOWN || kind == COREWEBVIEW2_KEY_EVENT_KIND_SYSTEM_KEY_DOWN;
            if pressed && key == u32::from(VK_ESCAPE.0) && key_host.escape() {
                args.SetHandled(true)?;
            }
        }
        Ok(())
    }));
    let focus = FocusChangedEventHandler::create(Box::new(move |_, _| {
        host.focused();
        Ok(())
    }));
    let mut token = 0i64;
    unsafe {
        controller.add_AcceleratorKeyPressed(&keys, &mut token)?;
        controller.add_GotFocus(&focus, &mut token)
    }
}

impl Page {
    pub(crate) fn focus(&self) {
        let _ = unsafe { self.controller.MoveFocus(COREWEBVIEW2_MOVE_FOCUS_REASON_PROGRAMMATIC) };
    }

    pub(crate) fn parent_moved(&self) {
        let _ = unsafe { self.controller.NotifyParentWindowPositionChanged() };
    }

    pub(crate) fn set_background(&self, red: u8, green: u8, blue: u8, alpha: u8) {
        if let Ok(controller2) = self.controller.cast::<ICoreWebView2Controller2>() {
            let _ = unsafe { controller2.SetDefaultBackgroundColor(COREWEBVIEW2_COLOR { A: alpha, R: red, G: green, B: blue }) };
        }
    }

    pub(crate) fn place(&self, x: i32, y: i32, width: i32, height: i32) {
        let bounds = RECT { left: x, top: y, right: x + width.max(0), bottom: y + height.max(0) };
        unsafe {
            let _ = self.controller.SetBounds(bounds);
            let _ = self.controller.SetIsVisible(width > 0 && height > 0);
        }
        if let Some(window) = self.window {
            let _ = unsafe { SetWindowPos(window, Some(HWND_TOP), 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE) };
        }
    }

    pub(crate) fn post_json(&self, json: &str) -> Result<(), String> {
        unsafe { self.webview.PostWebMessageAsJson(&HSTRING::from(json)) }.map_err(|error| format!("Could not reach the page: {error}"))
    }
}

impl Drop for Page {
    fn drop(&mut self) {
        unsafe {
            let _ = self.controller.Close();
        }
    }
}
