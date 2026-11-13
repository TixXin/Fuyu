use std::sync::Arc;

use windows::{
    core::{factory, Interface, Result},
    Foundation::{TimeSpan, TypedEventHandler},
    Graphics::{
        Capture::{Direct3D11CaptureFramePool, GraphicsCaptureItem, GraphicsCaptureSession},
        DirectX::{Direct3D11::IDirect3DDevice, DirectXPixelFormat},
    },
    Win32::{
        Foundation::{E_FAIL, HMODULE, POINT, RECT},
        Graphics::{
            Direct3D::D3D_DRIVER_TYPE_HARDWARE,
            Direct3D11::{
                D3D11CreateDevice, ID3D11Device, ID3D11DeviceContext, ID3D11Multithread, ID3D11Texture2D,
                D3D11_BIND_RENDER_TARGET, D3D11_BIND_SHADER_RESOURCE, D3D11_BOX, D3D11_CREATE_DEVICE_BGRA_SUPPORT,
                D3D11_CREATE_DEVICE_VIDEO_SUPPORT, D3D11_SDK_VERSION, D3D11_TEXTURE2D_DESC, D3D11_USAGE_DEFAULT,
            },
            Dxgi::{Common::{DXGI_FORMAT_B8G8R8A8_UNORM, DXGI_SAMPLE_DESC}, IDXGIDevice},
            Gdi::{GetMonitorInfoW, MonitorFromPoint, HMONITOR, MONITORINFO, MONITOR_DEFAULTTONULL},
        },
        System::{
            Performance::{QueryPerformanceCounter, QueryPerformanceFrequency},
            WinRT::{
                Direct3D11::{CreateDirect3D11DeviceFromDXGIDevice, IDirect3DDxgiInterfaceAccess},
                Graphics::Capture::IGraphicsCaptureItemInterop,
            },
        },
    },
};

#[derive(Clone)]
pub(crate) struct Gpu {
    device: ID3D11Device,
    context: ID3D11DeviceContext,
    direct3d: IDirect3DDevice,
}

unsafe impl Send for Gpu {}
unsafe impl Sync for Gpu {}

impl Gpu {
    pub(crate) fn create() -> Result<Self> {
        let mut device = None;
        let mut context = None;
        unsafe {
            D3D11CreateDevice(
                None,
                D3D_DRIVER_TYPE_HARDWARE,
                HMODULE::default(),
                D3D11_CREATE_DEVICE_BGRA_SUPPORT | D3D11_CREATE_DEVICE_VIDEO_SUPPORT,
                None,
                D3D11_SDK_VERSION,
                Some(&mut device),
                None,
                Some(&mut context),
            )
        }?;
        let (device, context) = device.zip(context).ok_or_else(|| windows::core::Error::from(E_FAIL))?;
        let _ = unsafe { device.cast::<ID3D11Multithread>()?.SetMultithreadProtected(true) };
        let dxgi: IDXGIDevice = device.cast()?;
        let direct3d = unsafe { CreateDirect3D11DeviceFromDXGIDevice(&dxgi) }?.cast()?;
        Ok(Self { device, context, direct3d })
    }

    pub(crate) fn device(&self) -> &ID3D11Device {
        &self.device
    }

    fn copy(&self, source: &ID3D11Texture2D, area: &MonitorArea) -> Result<Option<GpuFrame>> {
        let mut described = D3D11_TEXTURE2D_DESC::default();
        unsafe { source.GetDesc(&mut described) };
        let (right, bottom) = (area.x + area.width, area.y + area.height);
        if right > described.Width || bottom > described.Height {
            return Ok(None);
        }
        let wanted = D3D11_TEXTURE2D_DESC {
            Width: area.width,
            Height: area.height,
            MipLevels: 1,
            ArraySize: 1,
            Format: DXGI_FORMAT_B8G8R8A8_UNORM,
            SampleDesc: DXGI_SAMPLE_DESC { Count: 1, Quality: 0 },
            Usage: D3D11_USAGE_DEFAULT,
            BindFlags: (D3D11_BIND_SHADER_RESOURCE.0 | D3D11_BIND_RENDER_TARGET.0) as u32,
            CPUAccessFlags: 0,
            MiscFlags: 0,
        };
        let mut texture = None;
        unsafe { self.device.CreateTexture2D(&wanted, None, Some(&mut texture)) }?;
        let texture = texture.ok_or_else(|| windows::core::Error::from(E_FAIL))?;
        let region = D3D11_BOX { left: area.x, top: area.y, front: 0, right, bottom, back: 1 };
        unsafe { self.context.CopySubresourceRegion(&texture, 0, 0, 0, 0, source, 0, Some(&region)) };
        Ok(Some(GpuFrame(texture)))
    }
}

#[derive(Clone)]
pub(crate) struct GpuFrame(ID3D11Texture2D);

unsafe impl Send for GpuFrame {}

impl GpuFrame {
    pub(crate) fn texture(&self) -> &ID3D11Texture2D {
        &self.0
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) struct MonitorArea {
    monitor: isize,
    pub(crate) x: u32,
    pub(crate) y: u32,
    pub(crate) width: u32,
    pub(crate) height: u32,
}

impl MonitorArea {
    pub(crate) fn with_size(self, width: u32, height: u32) -> Self {
        Self { width: width.min(self.width), height: height.min(self.height), ..self }
    }
}

pub(crate) fn monitor_area(x: i32, y: i32, width: u32, height: u32) -> Option<MonitorArea> {
    let centre = POINT { x: x.saturating_add((width / 2) as i32), y: y.saturating_add((height / 2) as i32) };
    let monitor = unsafe { MonitorFromPoint(centre, MONITOR_DEFAULTTONULL) };
    if monitor.is_invalid() {
        return None;
    }
    let mut info = MONITORINFO { cbSize: size_of::<MONITORINFO>() as u32, ..Default::default() };
    if !unsafe { GetMonitorInfoW(monitor, &mut info) }.as_bool() {
        return None;
    }
    let RECT { left, top, right, bottom } = info.rcMonitor;
    let start_x = x.clamp(left, right);
    let start_y = y.clamp(top, bottom);
    let end_x = x.saturating_add(width as i32).clamp(left, right);
    let end_y = y.saturating_add(height as i32).clamp(top, bottom);
    Some(MonitorArea {
        monitor: monitor.0 as isize,
        x: (start_x - left) as u32,
        y: (start_y - top) as u32,
        width: (end_x - start_x) as u32,
        height: (end_y - start_y) as u32,
    })
}

pub(crate) fn now() -> i64 {
    let (mut count, mut frequency) = (0i64, 0i64);
    unsafe {
        let _ = QueryPerformanceCounter(&mut count);
        let _ = QueryPerformanceFrequency(&mut frequency);
    }
    if frequency <= 0 {
        return 0;
    }
    (i128::from(count) * 10_000_000 / i128::from(frequency)) as i64
}

pub(crate) struct MonitorCapture {
    pool: Direct3D11CaptureFramePool,
    session: GraphicsCaptureSession,
    token: i64,
}

impl MonitorCapture {
    pub(crate) fn start<F>(gpu: &Gpu, area: MonitorArea, buffers: u32, interval: i64, on_frame: F) -> Result<Self>
    where
        F: Fn(GpuFrame, i64) + Send + Sync + 'static,
    {
        let interop = factory::<GraphicsCaptureItem, IGraphicsCaptureItemInterop>()?;
        let item: GraphicsCaptureItem = unsafe { interop.CreateForMonitor(HMONITOR(area.monitor as *mut _)) }?;
        let pool = Direct3D11CaptureFramePool::CreateFreeThreaded(
            &gpu.direct3d,
            DirectXPixelFormat::B8G8R8A8UIntNormalized,
            buffers.clamp(1, 4) as i32,
            item.Size()?,
        )?;
        let shared = Arc::new((gpu.clone(), area, on_frame));
        let source = pool.clone();
        let token = pool.FrameArrived(&TypedEventHandler::new(move |_, _| {
            let (gpu, area, on_frame) = &*shared;
            let frame = source.TryGetNextFrame()?;
            let time = frame.SystemRelativeTime()?.Duration;
            let access: IDirect3DDxgiInterfaceAccess = frame.Surface()?.cast()?;
            let texture: ID3D11Texture2D = unsafe { access.GetInterface() }?;
            if let Some(copy) = gpu.copy(&texture, area)? {
                on_frame(copy, time);
            }
            frame.Close()
        }))?;
        let session = pool.CreateCaptureSession(&item)?;
        let _ = session.SetIsCursorCaptureEnabled(true);
        let _ = session.SetIsBorderRequired(false);
        let _ = session.SetMinUpdateInterval(TimeSpan { Duration: interval });
        session.StartCapture()?;
        Ok(Self { pool, session, token })
    }
}

impl Drop for MonitorCapture {
    fn drop(&mut self) {
        let _ = self.pool.RemoveFrameArrived(self.token);
        let _ = self.session.Close();
        let _ = self.pool.Close();
    }
}
