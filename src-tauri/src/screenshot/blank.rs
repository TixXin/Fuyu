pub(super) fn is_blank(rgba: &[u8]) -> bool {
    rgba.as_chunks::<4>().0.iter().all(|pixel| pixel[0] == 0 && pixel[1] == 0 && pixel[2] == 0)
}

pub(super) fn pick<G, W>(exclusive_fullscreen: bool, gdi: G, wgc: W) -> Option<Vec<u8>>
where
    G: FnOnce() -> Option<Vec<u8>>,
    W: FnOnce() -> Option<Vec<u8>>,
{
    if exclusive_fullscreen {
        return wgc().or_else(gdi);
    }
    let shot = gdi();
    if shot.as_deref().is_none_or(is_blank) {
        return wgc().or(shot);
    }
    shot
}

#[cfg(test)]
mod tests {
    use std::cell::Cell;

    use super::{is_blank, pick};

    const BLACK: [u8; 8] = [0, 0, 0, 255, 0, 0, 0, 255];
    const DESKTOP: [u8; 8] = [0, 0, 0, 255, 12, 40, 90, 255];
    const GAME: [u8; 8] = [200, 10, 10, 255, 200, 10, 10, 255];

    #[test]
    fn only_a_frame_with_no_lit_pixel_is_blank() {
        assert!(is_blank(&BLACK));
        assert!(is_blank(&[]));
        assert!(!is_blank(&DESKTOP));
        assert!(!is_blank(&[0, 0, 1, 255]));
    }

    #[test]
    fn a_normal_desktop_never_starts_graphics_capture() {
        let asked = Cell::new(false);
        let shot = pick(false, || Some(DESKTOP.to_vec()), || {
            asked.set(true);
            Some(GAME.to_vec())
        });
        assert_eq!(shot.as_deref(), Some(&DESKTOP[..]));
        assert!(!asked.get());
    }

    #[test]
    fn a_black_gdi_shot_is_replaced_by_graphics_capture() {
        assert_eq!(pick(false, || Some(BLACK.to_vec()), || Some(GAME.to_vec())).as_deref(), Some(&GAME[..]));
        assert_eq!(pick(false, || None, || Some(GAME.to_vec())).as_deref(), Some(&GAME[..]));
        assert_eq!(pick(false, || Some(BLACK.to_vec()), || None).as_deref(), Some(&BLACK[..]));
    }

    #[test]
    fn an_exclusive_fullscreen_game_tries_graphics_capture_first() {
        let gdi_asked = Cell::new(false);
        let shot = pick(true, || {
            gdi_asked.set(true);
            Some(BLACK.to_vec())
        }, || Some(GAME.to_vec()));
        assert_eq!(shot.as_deref(), Some(&GAME[..]));
        assert!(!gdi_asked.get());
        assert_eq!(pick(true, || Some(DESKTOP.to_vec()), || None).as_deref(), Some(&DESKTOP[..]));
    }
}
