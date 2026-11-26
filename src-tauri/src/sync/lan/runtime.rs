use std::{
    path::Path,
    sync::{Arc, Mutex, MutexGuard, PoisonError},
};

use crate::user_error::UserError;

use super::{
    discovery::{self, Discovery, Seen},
    host::Host,
    identity,
    server::{self, Listener, DEFAULT_PORT},
    store::StoreServe,
};

pub(crate) type Wake = Arc<dyn Fn() + Send + Sync>;

struct Runtime {
    host: Arc<Host>,
    listener: Listener,
    discovery: Option<Discovery>,
}

static RUNTIME: Mutex<Option<Runtime>> = Mutex::new(None);

fn slot() -> MutexGuard<'static, Option<Runtime>> {
    RUNTIME.lock().unwrap_or_else(PoisonError::into_inner)
}

pub(crate) fn start(home: &Path, me: &str, name: &str, wake: Wake) -> Result<Arc<Host>, UserError> {
    let mut slot = slot();
    if let Some(runtime) = slot.as_ref() {
        return Ok(runtime.host.clone());
    }
    let identity = identity::load_or_create()?;
    let serve = Arc::new(StoreServe::new(home, me, wake.clone()));
    let host = Host::new(identity, me.to_string(), name.to_string(), home.to_path_buf(), serve);
    let listener = server::listen(host.clone(), DEFAULT_PORT)
        .map_err(|error| UserError::new("sync.lanListen", "Could not open a port for the local network link.").detail(error.to_string()))?;
    let found = host.clone();
    let discovery = discovery::start(me, name, listener.port(), move |seen| match seen {
        Seen::Found { id, name, addr } => {
            if found.remember_device(&id, &name, &addr.to_string()) {
                wake();
            }
        }
        Seen::Lost { id } => found.forget_nearby(&id),
    })
    .ok();
    *slot = Some(Runtime { host: host.clone(), listener, discovery });
    Ok(host)
}

pub(crate) fn stop() {
    let taken = slot().take();
    drop(taken);
}

pub(crate) fn host() -> Option<Arc<Host>> {
    slot().as_ref().map(|runtime| runtime.host.clone())
}

pub(crate) struct Running {
    pub(crate) host: Arc<Host>,
    pub(crate) port: u16,
    pub(crate) announced: bool,
}

pub(crate) fn running() -> Option<Running> {
    slot().as_ref().map(|runtime| Running { host: runtime.host.clone(), port: runtime.listener.port(), announced: runtime.discovery.is_some() })
}
