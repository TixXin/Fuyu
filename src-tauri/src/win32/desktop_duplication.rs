use windows::{
    core::{Interface, BOOL, PCSTR},
    Win32::{
        Foundation::{E_ACCESSDENIED, E_FAIL, E_NOTIMPL, HMODULE, HWND, RECT},
        Graphics::{
            Direct3D::{D3D_DRIVER_TYPE_UNKNOWN, D3D11_SRV_DIMENSION_TEXTURE2D},
            Direct3D11::{
                D3D11CreateDevice, ID3D11Device, ID3D11DeviceContext, ID3D11ShaderResourceView,
                ID3D11Texture2D, D3D11_BIND_RENDER_TARGET, D3D11_BIND_SHADER_RESOURCE, D3D11_BOX,
                D3D11_CPU_ACCESS_READ, D3D11_CREATE_DEVICE_BGRA_SUPPORT, D3D11_MAPPED_SUBRESOURCE,
                D3D11_MAP_READ, D3D11_RESOURCE_MISC_GENERATE_MIPS, D3D11_SDK_VERSION,
                D3D11_SHADER_RESOURCE_VIEW_DESC, D3D11_SHADER_RESOURCE_VIEW_DESC_0, D3D11_TEX2D_SRV,
                D3D11_TEXTURE2D_DESC, D3D11_USAGE_DEFAULT, D3D11_USAGE_STAGING,
            },
            Dxgi::{
                Common::{
                    DXGI_FORMAT_B8G8R8A8_UNORM, DXGI_MODE_ROTATION_IDENTITY,
                    DXGI_MODE_ROTATION_UNSPECIFIED, DXGI_SAMPLE_DESC,
                },
                CreateDXGIFactory1, IDXGIFactory1, IDXGIOutput1, IDXGIOutputDuplication,
                IDXGIResource, DXGI_ERROR_NOT_FOUND, DXGI_ERROR_WAIT_TIMEOUT,
                DXGI_OUTDUPL_FRAME_INFO, DXGI_OUTDUPL_MOVE_RECT,
            },
        },
        System::LibraryLoader::{GetModuleHandleW, GetProcAddress},
        UI::WindowsAndMessaging::{GetSystemMetrics, SM_REMOTESESSION},
    },
};

const MAX_READ_WIDTH: u32 = 320;
const MIN_READ_LEVEL: u32 = 2;
const MAX_READ_LEVEL: u32 = 4;
const WCA_EXCLUDED_FROM_DDA: u32 = 24;

pub(crate) type ScreenRect = (i32, i32, i32, i32);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum Frame {
    Timeout,
    New { touches: bool },
}

#[derive(Debug)]
pub(crate) enum OpenError {
    NoDevice,
    SecureDesktop,
    Other(windows::core::Error),
}

impl std::fmt::Display for OpenError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NoDevice => formatter.write_str("no Direct3D 11 device"),
            Self::SecureDesktop => formatter.write_str("the secure desktop is showing"),
            Self::Other(error) => write!(formatter, "{error}"),
        }
    }
}

pub(crate) struct Readback {
    pub(crate) rect: ScreenRect,
    pub(crate) width: u32,
    pub(crate) height: u32,
    pub(crate) level: u32,
    pub(crate) bgra: Vec<u8>,
}

#[derive(Clone)]
struct RegionTextures {
    size: (u32, u32),
    level: u32,
    mips: ID3D11Texture2D,
    view: ID3D11ShaderResourceView,
    staging: ID3D11Texture2D,
}

pub(crate) struct Duplication {
    device: ID3D11Device,
    context: ID3D11DeviceContext,
    duplication: IDXGIOutputDuplication,
    pub(crate) monitor: ScreenRect,
    desktop: Option<ID3D11Texture2D>,
    region: Option<RegionTextures>,
    metadata: Vec<u8>,
}

pub(crate) fn contains(rect: ScreenRect, point: (i32, i32)) -> bool {
    point.0 >= rect.0 && point.0 < rect.2 && point.1 >= rect.1 && point.1 < rect.3
}

pub(crate) fn intersects(a: ScreenRect, b: ScreenRect) -> bool {
    a.0 < b.2 && b.0 < a.2 && a.1 < b.3 && b.1 < a.3
}

pub(crate) fn read_level(width: u32) -> u32 {
    (MIN_READ_LEVEL..MAX_READ_LEVEL)
        .find(|level| width >> level <= MAX_READ_WIDTH)
        .unwrap_or(MAX_READ_LEVEL)
}

fn from_rect(rect: RECT) -> ScreenRect {
    (rect.left, rect.top, rect.right, rect.bottom)
}

fn is_secure_desktop(error: &windows::core::Error) -> bool {
    error.code() == E_ACCESSDENIED
}

fn create_device(adapter: &windows::Win32::Graphics::Dxgi::IDXGIAdapter1) -> Result<(ID3D11Device, ID3D11DeviceContext), OpenError> {
    let mut device = None;
    let mut context = None;
    unsafe {
        D3D11CreateDevice(
            adapter,
            D3D_DRIVER_TYPE_UNKNOWN,
            HMODULE::default(),
            D3D11_CREATE_DEVICE_BGRA_SUPPORT,
            None,
            D3D11_SDK_VERSION,
            Some(&mut device),
            None,
            Some(&mut context),
        )
    }
    .map_err(|_| OpenError::NoDevice)?;
    device.zip(context).ok_or(OpenError::NoDevice)
}

impl Duplication {
    pub(crate) fn open(point: (i32, i32)) -> Result<Self, OpenError> {
        let factory: IDXGIFactory1 = unsafe { CreateDXGIFactory1() }.map_err(OpenError::Other)?;
        let mut adapter_index = 0;
        while let Ok(adapter) = unsafe { factory.EnumAdapters1(adapter_index) } {
            adapter_index += 1;
            let mut output_index = 0;
            while let Ok(output) = unsafe { adapter.EnumOutputs(output_index) } {
                output_index += 1;
                let description = unsafe { output.GetDesc() }.map_err(OpenError::Other)?;
                let monitor = from_rect(description.DesktopCoordinates);
                if !contains(monitor, point) {
                    continue;
                }
                let (device, context) = create_device(&adapter)?;
                let output = output.cast::<IDXGIOutput1>().map_err(OpenError::Other)?;
                let duplication = unsafe { output.DuplicateOutput(&device) }.map_err(|error| {
                    if is_secure_desktop(&error) {
                        OpenError::SecureDesktop
                    } else {
                        OpenError::Other(error)
                    }
                })?;
                let rotation = unsafe { duplication.GetDesc() }.Rotation;
                if rotation != DXGI_MODE_ROTATION_IDENTITY && rotation != DXGI_MODE_ROTATION_UNSPECIFIED {
                    return Err(OpenError::Other(E_NOTIMPL.into()));
                }
                return Ok(Self {
                    device,
                    context,
                    duplication,
                    monitor,
                    desktop: None,
                    region: None,
                    metadata: Vec::new(),
                });
            }
        }
        Err(OpenError::Other(DXGI_ERROR_NOT_FOUND.into()))
    }

    pub(crate) fn next_frame(&mut self, timeout_ms: u32, region: ScreenRect) -> windows::core::Result<Frame> {
        let mut info = DXGI_OUTDUPL_FRAME_INFO::default();
        let mut resource: Option<IDXGIResource> = None;
        match unsafe { self.duplication.AcquireNextFrame(timeout_ms, &mut info, &mut resource) } {
            Ok(()) => {}
            Err(error) if error.code() == DXGI_ERROR_WAIT_TIMEOUT => return Ok(Frame::Timeout),
            Err(error) => return Err(error),
        }
        let result = self.take_frame(&info, resource, region);
        let released = unsafe { self.duplication.ReleaseFrame() };
        let frame = result?;
        released?;
        Ok(frame)
    }

    fn take_frame(
        &mut self,
        info: &DXGI_OUTDUPL_FRAME_INFO,
        resource: Option<IDXGIResource>,
        region: ScreenRect,
    ) -> windows::core::Result<Frame> {
        if info.LastPresentTime == 0 {
            return Ok(Frame::New { touches: false });
        }
        let Some(resource) = resource else {
            return Ok(Frame::New { touches: false });
        };
        let texture: ID3D11Texture2D = resource.cast()?;
        let first = self.desktop.is_none();
        if first {
            let mut description = D3D11_TEXTURE2D_DESC::default();
            unsafe { texture.GetDesc(&mut description) };
            description.Usage = D3D11_USAGE_DEFAULT;
            description.BindFlags = 0;
            description.CPUAccessFlags = 0;
            description.MiscFlags = 0;
            let mut copy = None;
            unsafe { self.device.CreateTexture2D(&description, None, Some(&mut copy)) }?;
            self.desktop = copy;
        }
        let Some(desktop) = &self.desktop else {
            return Ok(Frame::New { touches: false });
        };
        unsafe { self.context.CopyResource(desktop, &texture) };
        let touches = first || self.changed_inside(info, region)?;
        Ok(Frame::New { touches })
    }

    fn changed_inside(&mut self, info: &DXGI_OUTDUPL_FRAME_INFO, region: ScreenRect) -> windows::core::Result<bool> {
        let size = info.TotalMetadataBufferSize as usize;
        if size == 0 {
            return Ok(true);
        }
        let local = (
            region.0 - self.monitor.0,
            region.1 - self.monitor.1,
            region.2 - self.monitor.0,
            region.3 - self.monitor.1,
        );
        if self.metadata.len() < size {
            self.metadata.resize(size, 0);
        }
        let mut used = 0u32;
        unsafe {
            self.duplication.GetFrameMoveRects(
                size as u32,
                self.metadata.as_mut_ptr().cast::<DXGI_OUTDUPL_MOVE_RECT>(),
                &mut used,
            )?;
        }
        let moves = used as usize / std::mem::size_of::<DXGI_OUTDUPL_MOVE_RECT>();
        let mut touched = (0..moves).any(|index| {
            let moved = unsafe {
                std::ptr::read_unaligned(self.metadata.as_ptr().cast::<DXGI_OUTDUPL_MOVE_RECT>().add(index))
            };
            intersects(from_rect(moved.DestinationRect), local)
        });
        if touched {
            return Ok(true);
        }
        unsafe {
            self.duplication.GetFrameDirtyRects(size as u32, self.metadata.as_mut_ptr().cast::<RECT>(), &mut used)?;
        }
        let dirty = used as usize / std::mem::size_of::<RECT>();
        touched = (0..dirty).any(|index| {
            let rect = unsafe { std::ptr::read_unaligned(self.metadata.as_ptr().cast::<RECT>().add(index)) };
            intersects(from_rect(rect), local)
        });
        Ok(touched)
    }

    pub(crate) fn read_region(&mut self, region: ScreenRect) -> windows::core::Result<Option<Readback>> {
        let Some(desktop) = self.desktop.clone() else {
            return Ok(None);
        };
        let clamped = (
            region.0.max(self.monitor.0),
            region.1.max(self.monitor.1),
            region.2.min(self.monitor.2),
            region.3.min(self.monitor.3),
        );
        let width = (clamped.2 - clamped.0).max(0) as u32;
        let height = (clamped.3 - clamped.1).max(0) as u32;
        if width < 16 || height < 16 {
            return Ok(None);
        }
        let textures = self.region_textures((width, height))?;
        let level = textures.level;
        let source = D3D11_BOX {
            left: (clamped.0 - self.monitor.0) as u32,
            top: (clamped.1 - self.monitor.1) as u32,
            front: 0,
            right: (clamped.2 - self.monitor.0) as u32,
            bottom: (clamped.3 - self.monitor.1) as u32,
            back: 1,
        };
        let (out_width, out_height) = ((width >> level).max(1), (height >> level).max(1));
        let mut mapped = D3D11_MAPPED_SUBRESOURCE::default();
        unsafe {
            self.context.CopySubresourceRegion(&textures.mips, 0, 0, 0, 0, &desktop, 0, Some(&source));
            self.context.GenerateMips(&textures.view);
            self.context.CopySubresourceRegion(&textures.staging, 0, 0, 0, 0, &textures.mips, level, None);
            self.context.Map(&textures.staging, 0, D3D11_MAP_READ, 0, Some(&mut mapped))?;
        }
        let row = out_width as usize * 4;
        let mut bgra = vec![0u8; row * out_height as usize];
        for (line, target) in bgra.chunks_exact_mut(row).enumerate() {
            let source = unsafe {
                std::slice::from_raw_parts((mapped.pData as *const u8).add(line * mapped.RowPitch as usize), row)
            };
            target.copy_from_slice(source);
        }
        unsafe { self.context.Unmap(&textures.staging, 0) };
        Ok(Some(Readback { rect: clamped, width: out_width, height: out_height, level, bgra }))
    }

    fn region_textures(&mut self, size: (u32, u32)) -> windows::core::Result<RegionTextures> {
        if let Some(textures) = self.region.as_ref().filter(|textures| textures.size == size) {
            return Ok(textures.clone());
        }
        let level = read_level(size.0);
        let base = D3D11_TEXTURE2D_DESC {
            Width: size.0,
            Height: size.1,
            MipLevels: level + 1,
            ArraySize: 1,
            Format: DXGI_FORMAT_B8G8R8A8_UNORM,
            SampleDesc: DXGI_SAMPLE_DESC { Count: 1, Quality: 0 },
            Usage: D3D11_USAGE_DEFAULT,
            BindFlags: (D3D11_BIND_RENDER_TARGET.0 | D3D11_BIND_SHADER_RESOURCE.0) as u32,
            CPUAccessFlags: 0,
            MiscFlags: D3D11_RESOURCE_MISC_GENERATE_MIPS.0 as u32,
        };
        let staging_description = D3D11_TEXTURE2D_DESC {
            Width: (size.0 >> level).max(1),
            Height: (size.1 >> level).max(1),
            MipLevels: 1,
            Usage: D3D11_USAGE_STAGING,
            BindFlags: 0,
            CPUAccessFlags: D3D11_CPU_ACCESS_READ.0 as u32,
            MiscFlags: 0,
            ..base
        };
        let view_description = D3D11_SHADER_RESOURCE_VIEW_DESC {
            Format: DXGI_FORMAT_B8G8R8A8_UNORM,
            ViewDimension: D3D11_SRV_DIMENSION_TEXTURE2D,
            Anonymous: D3D11_SHADER_RESOURCE_VIEW_DESC_0 {
                Texture2D: D3D11_TEX2D_SRV { MostDetailedMip: 0, MipLevels: level + 1 },
            },
        };
        let (mut mips, mut staging, mut view) = (None, None, None);
        unsafe {
            self.device.CreateTexture2D(&base, None, Some(&mut mips))?;
            self.device.CreateTexture2D(&staging_description, None, Some(&mut staging))?;
        }
        let (Some(mips), Some(staging)) = (mips, staging) else {
            return Err(E_FAIL.into());
        };
        unsafe { self.device.CreateShaderResourceView(&mips, Some(&view_description), Some(&mut view)) }?;
        let Some(view) = view else {
            return Err(E_FAIL.into());
        };
        let textures = RegionTextures { size, level, mips, view, staging };
        self.region = Some(textures.clone());
        Ok(textures)
    }
}

#[repr(C)]
struct CompositionData {
    attribute: u32,
    data: *mut std::ffi::c_void,
    size: usize,
}

type SetCompositionFn = unsafe extern "system" fn(HWND, *mut CompositionData) -> BOOL;

pub(crate) fn exclude_from_duplication(window: HWND, exclude: bool) -> bool {
    unsafe {
        let Ok(user32) = GetModuleHandleW(windows::core::w!("user32.dll")) else {
            return false;
        };
        let Some(function) = GetProcAddress(user32, PCSTR(c"SetWindowCompositionAttribute".as_ptr().cast())) else {
            return false;
        };
        let set: SetCompositionFn = std::mem::transmute(function);
        let mut value = BOOL::from(exclude);
        let mut data = CompositionData {
            attribute: WCA_EXCLUDED_FROM_DDA,
            data: (&mut value as *mut BOOL).cast(),
            size: std::mem::size_of::<BOOL>(),
        };
        set(window, &mut data).as_bool()
    }
}

pub(crate) fn is_remote_session() -> bool {
    unsafe { GetSystemMetrics(SM_REMOTESESSION) != 0 }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn process_cpu_ms() -> f64 {
        use windows::Win32::{
            Foundation::FILETIME,
            System::Threading::{GetCurrentProcess, GetProcessTimes},
        };
        let mut times = [FILETIME::default(); 4];
        let [created, exited, kernel, user] = &mut times;
        unsafe { GetProcessTimes(GetCurrentProcess(), created, exited, kernel, user) }.unwrap();
        let ticks = |time: FILETIME| (((time.dwHighDateTime as u64) << 32) | time.dwLowDateTime as u64) as f64;
        (ticks(times[2]) + ticks(times[3])) / 10_000.0
    }

    #[test]
    #[ignore]
    fn capture_cost() {
        for forced in [false, true] {
            let mut duplication = Duplication::open((1, 1)).unwrap();
            let monitor = duplication.monitor;
            let left = (monitor.0 + monitor.2) / 2 - 615;
            let region = (left, monitor.1, left + 1230, monitor.1 + 690);
            let (cpu_start, start) = (process_cpu_ms(), std::time::Instant::now());
            let (mut frames, mut touched, mut reads, mut read_ms, mut bytes) = (0, 0, 0, 0.0, 0usize);
            let mut last = std::time::Instant::now() - std::time::Duration::from_secs(1);
            let mut pending = false;
            while start.elapsed().as_secs() < 10 {
                match duplication.next_frame(if forced { 5 } else { 50 }, region).unwrap() {
                    Frame::Timeout => {}
                    Frame::New { touches } => {
                        frames += 1;
                        if touches {
                            touched += 1;
                            pending = true;
                        }
                    }
                }
                if (pending || forced) && last.elapsed().as_millis() >= 33 {
                    let at = std::time::Instant::now();
                    if let Some(read) = duplication.read_region(region).unwrap() {
                        let options = crate::island::glass_capture::BlurOptions { blur: 24.0, scale: 1.5, saturation: 120.0 };
                        let message = crate::island::glass_capture::encode(read, options, (0, 0));
                        bytes += message.len();
                        reads += 1;
                    }
                    read_ms += at.elapsed().as_secs_f64() * 1000.0;
                    pending = false;
                    last = std::time::Instant::now();
                }
            }
            let cpu = process_cpu_ms() - cpu_start;
            let wall = start.elapsed().as_secs_f64() * 1000.0;
            println!(
                "forced={forced} frames={frames} touched={touched} reads={reads} bytes/frame={} read+blur avg={:.2}ms cpu={:.1}ms ({:.2}% of one core)",
                bytes.checked_div(reads).unwrap_or(0),
                if reads > 0 { read_ms / reads as f64 } else { 0.0 },
                cpu,
                cpu / wall * 100.0
            );
        }
    }

    #[test]
    fn rectangles_meet_only_when_they_overlap() {
        assert!(intersects((0, 0, 10, 10), (5, 5, 20, 20)));
        assert!(!intersects((0, 0, 10, 10), (10, 0, 20, 10)));
        assert!(contains((0, 0, 10, 10), (0, 9)));
        assert!(!contains((0, 0, 10, 10), (10, 5)));
    }

    #[test]
    fn wide_regions_read_back_from_a_smaller_mip_so_frames_stay_small() {
        assert_eq!(read_level(840), 2);
        assert_eq!(read_level(1230), 2);
        assert_eq!(read_level(1640), 3);
        assert_eq!(read_level(5000), 4);
    }
}
