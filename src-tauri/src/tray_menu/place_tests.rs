use super::{place, screen_for, taskbar_edge, Edge, Platform, Rect, Screen};

const CARD: (f64, f64) = (320.0, 400.0);

fn screen(bounds: (f64, f64, f64, f64), work: (f64, f64, f64, f64), scale: f64) -> Screen {
    Screen { bounds: Rect::new(bounds.0, bounds.1, bounds.2, bounds.3), work: Rect::new(work.0, work.1, work.2, work.3), scale }
}

fn icon(left: f64, top: f64, size: f64) -> Option<Rect> {
    Some(Rect::new(left, top, size, size))
}

fn bottom_taskbar() -> Screen {
    screen((0.0, 0.0, 1920.0, 1080.0), (0.0, 0.0, 1920.0, 1040.0), 1.0)
}

#[test]
fn a_bottom_taskbar_opens_the_card_above_the_icon() {
    let screen = bottom_taskbar();
    assert_eq!(taskbar_edge(&screen, Rect::new(1700.0, 1050.0, 24.0, 24.0)), Edge::Bottom);
    assert_eq!(place(Platform::Windows, icon(1700.0, 1050.0, 24.0), (0.0, 0.0), &screen, CARD), (1552.0, 632.0));
    assert_eq!(place(Platform::Windows, icon(1880.0, 1050.0, 24.0), (0.0, 0.0), &screen, CARD), (1592.0, 632.0));
}

#[test]
fn a_top_taskbar_opens_the_card_below_the_icon() {
    let screen = screen((0.0, 0.0, 1920.0, 1080.0), (0.0, 40.0, 1920.0, 1040.0), 1.0);
    assert_eq!(place(Platform::Windows, icon(1700.0, 8.0, 24.0), (0.0, 0.0), &screen, CARD), (1552.0, 48.0));
}

#[test]
fn side_taskbars_open_the_card_beside_the_icon_and_keep_it_on_screen() {
    let left = screen((0.0, 0.0, 1920.0, 1080.0), (60.0, 0.0, 1860.0, 1080.0), 1.0);
    assert_eq!(place(Platform::Windows, icon(18.0, 900.0, 24.0), (0.0, 0.0), &left, CARD), (68.0, 672.0));
    let right = screen((0.0, 0.0, 1920.0, 1080.0), (0.0, 0.0, 1860.0, 1080.0), 1.0);
    assert_eq!(place(Platform::Windows, icon(1878.0, 500.0, 24.0), (0.0, 0.0), &right, CARD), (1532.0, 312.0));
}

#[test]
fn an_icon_in_the_overflow_flyout_still_anchors_the_card() {
    let screen = bottom_taskbar();
    assert_eq!(place(Platform::Windows, icon(1600.0, 950.0, 24.0), (0.0, 0.0), &screen, CARD), (1452.0, 542.0));
}

#[test]
fn an_auto_hidden_taskbar_is_guessed_from_where_the_icon_is() {
    let screen = screen((0.0, 0.0, 1920.0, 1080.0), (0.0, 0.0, 1920.0, 1080.0), 1.0);
    assert_eq!(taskbar_edge(&screen, Rect::new(1700.0, 1060.0, 24.0, 20.0)), Edge::Bottom);
    assert_eq!(taskbar_edge(&screen, Rect::new(4.0, 500.0, 24.0, 24.0)), Edge::Left);
    assert_eq!(place(Platform::Windows, Some(Rect::new(1700.0, 1060.0, 24.0, 20.0)), (0.0, 0.0), &screen, CARD), (1552.0, 652.0));
}

#[test]
fn the_card_uses_the_scale_of_the_screen_the_icon_is_on() {
    let screens = [bottom_taskbar(), screen((1920.0, 0.0, 3840.0, 2160.0), (1920.0, 0.0, 3840.0, 2088.0), 1.5)];
    let anchor = Rect::new(5600.0, 2100.0, 36.0, 36.0);
    let chosen = screen_for(&screens, (5618.0, 2118.0)).expect("second screen");
    assert_eq!(chosen.scale, 1.5);
    assert_eq!(place(Platform::Windows, Some(anchor), (0.0, 0.0), &chosen, CARD), (5268.0, 1476.0));
    assert!(screen_for(&screens, (-10.0, 10.0)).is_none());
}

#[test]
fn a_broken_icon_rect_falls_back_to_the_pointer() {
    let screen = bottom_taskbar();
    assert_eq!(place(Platform::Windows, Some(Rect::new(0.0, 0.0, 0.0, 0.0)), (1200.0, 1060.0), &screen, CARD), (1040.0, 632.0));
    assert_eq!(place(Platform::Windows, None, (1200.0, 1060.0), &screen, CARD), (1040.0, 632.0));
}

fn mac_screen() -> Screen {
    screen((0.0, 0.0, 1512.0, 982.0), (0.0, 37.0, 1512.0, 945.0), 1.0)
}

#[test]
fn the_mac_card_hangs_below_the_menu_bar_right_aligned_to_the_icon() {
    let screen = mac_screen();
    assert_eq!(place(Platform::MacOs, icon(1300.0, 0.0, 30.0), (0.0, 0.0), &screen, CARD), (1010.0, 41.0));
    assert_eq!(place(Platform::MacOs, icon(1480.0, 0.0, 30.0), (0.0, 0.0), &screen, CARD), (1184.0, 41.0));
}

#[test]
fn an_untrustworthy_mac_rect_falls_back_to_the_pointer() {
    let screen = mac_screen();
    assert_eq!(place(Platform::MacOs, icon(1300.0, 500.0, 30.0), (1250.0, 12.0), &screen, CARD), (930.0, 41.0));
    assert_eq!(place(Platform::MacOs, None, (1250.0, 12.0), &screen, CARD), (930.0, 41.0));
    assert_eq!(place(Platform::MacOs, icon(3000.0, 0.0, 30.0), (1250.0, 12.0), &screen, CARD), (930.0, 41.0));
}
