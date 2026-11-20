use objc2_core_media::CMSampleBuffer;
use objc2_core_video::{
    CVPixelBufferGetBaseAddress, CVPixelBufferGetBytesPerRow, CVPixelBufferGetHeight, CVPixelBufferGetWidth, CVPixelBufferLockBaseAddress,
    CVPixelBufferLockFlags, CVPixelBufferUnlockBaseAddress,
};

#[derive(Clone)]
pub(crate) struct Pixels {
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) rgba: Vec<u8>,
}

pub(crate) fn step_for(width: usize, max_width: usize) -> usize {
    (width / max_width.max(1)).max(1)
}

pub(crate) fn shrink_bgra(source: &[u8], width: usize, height: usize, stride: usize, step: usize) -> Pixels {
    let step = step.max(1);
    let (out_width, out_height) = (width / step, height / step);
    let mut rgba = Vec::with_capacity(out_width * out_height * 4);
    let area = (step * step) as u32;
    for row in 0..out_height {
        for column in 0..out_width {
            let mut sum = [0u32; 4];
            for y in row * step..(row + 1) * step {
                let line = y * stride;
                for x in column * step..(column + 1) * step {
                    let at = line + x * 4;
                    for (total, byte) in sum.iter_mut().zip(&source[at..at + 4]) {
                        *total += u32::from(*byte);
                    }
                }
            }
            let [b, g, r, _] = sum.map(|total| (total / area) as u8);
            rgba.extend_from_slice(&[r, g, b, 255]);
        }
    }
    Pixels { width: out_width as u32, height: out_height as u32, rgba }
}

pub(crate) fn rgba(buffer: &CMSampleBuffer, max_width: usize) -> Option<Pixels> {
    let image = unsafe { buffer.image_buffer() }?;
    if unsafe { CVPixelBufferLockBaseAddress(&image, CVPixelBufferLockFlags::ReadOnly) } != 0 {
        return None;
    }
    let (width, height, stride) = (CVPixelBufferGetWidth(&image), CVPixelBufferGetHeight(&image), CVPixelBufferGetBytesPerRow(&image));
    let base = CVPixelBufferGetBaseAddress(&image);
    let pixels = (!base.is_null() && width > 0 && height > 0 && stride >= width * 4).then(|| {
        let source = unsafe { std::slice::from_raw_parts(base.cast::<u8>().cast_const(), stride * height) };
        shrink_bgra(source, width, height, stride, step_for(width, max_width))
    });
    unsafe { CVPixelBufferUnlockBaseAddress(&image, CVPixelBufferLockFlags::ReadOnly) };
    pixels.filter(|pixels| pixels.width > 0 && pixels.height > 0)
}

#[cfg(test)]
mod tests {
    use super::{shrink_bgra, step_for};

    #[test]
    fn bgra_turns_into_opaque_rgba_and_skips_row_padding() {
        let source = [1, 2, 3, 0, 4, 5, 6, 0, 9, 9, 9, 9, 7, 8, 9, 0, 10, 11, 12, 0, 9, 9, 9, 9];
        let pixels = shrink_bgra(&source, 2, 2, 12, 1);
        assert_eq!((pixels.width, pixels.height), (2, 2));
        assert_eq!(pixels.rgba, [3, 2, 1, 255, 6, 5, 4, 255, 9, 8, 7, 255, 12, 11, 10, 255]);
    }

    #[test]
    fn a_wide_frame_is_averaged_down_by_whole_steps() {
        let source = [0, 0, 0, 0, 100, 100, 100, 0, 50, 50, 50, 0, 250, 250, 250, 0];
        let pixels = shrink_bgra(&source, 2, 2, 8, 2);
        assert_eq!((pixels.width, pixels.height), (1, 1));
        assert_eq!(pixels.rgba, [100, 100, 100, 255]);
        assert_eq!(step_for(3840, 960), 4);
        assert_eq!(step_for(1600, 960), 1);
        assert_eq!(step_for(100, 0), 100);
    }
}
