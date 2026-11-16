use std::{
    io::{BufReader, ErrorKind},
    net::{TcpListener, TcpStream},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Condvar, Mutex, MutexGuard, PoisonError,
    },
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use super::{
    decision::{permission_response, question_response, route, Activity, Agent, Decision, HookInput, Kind, ACTIVITY_PATH},
    http::{check_access, read_request, write_response, HttpError},
    queue::{ApprovalRequest, CloseReason, Outcome, Queue},
};
use crate::agent_status::claimed_elsewhere;
use crate::system::windows_home_dir;

const READ_TIMEOUT: Duration = Duration::from_secs(10);
const POLL_INTERVAL: Duration = Duration::from_millis(250);
const SHUTDOWN_WAIT: Duration = Duration::from_secs(1);

#[derive(Debug, Clone, PartialEq)]
pub(crate) enum ApprovalEvent {
    Requested(ApprovalRequest),
    Closed { id: u64, reason: CloseReason },
}

pub(super) type Notify = Arc<dyn Fn(ApprovalEvent) + Send + Sync>;

pub(super) struct Shared {
    queue: Mutex<Queue>,
    changed: Condvar,
    enabled: AtomicBool,
    wait_limit: Duration,
    notify: Notify,
}

impl Shared {
    fn queue(&self) -> MutexGuard<'_, Queue> {
        self.queue.lock().unwrap_or_else(PoisonError::into_inner)
    }

    pub fn set_enabled(&self, enabled: bool) {
        self.enabled.store(enabled, Ordering::Relaxed);
    }

    pub fn decide(&self, id: u64, outcome: Outcome) -> Result<(), String> {
        self.queue().decide(id, outcome)?;
        self.changed.notify_all();
        Ok(())
    }

    pub fn pending(&self) -> Vec<ApprovalRequest> {
        self.queue().shown()
    }

    pub fn settle_elsewhere(&self, agent: Agent, activity: &Activity) -> Vec<u64> {
        let settled = self.queue().settle_elsewhere(agent, activity);
        if !settled.is_empty() {
            self.changed.notify_all();
        }
        settled
    }

    pub fn offer(&self, agent: Agent, input: HookInput) -> Option<ApprovalRequest> {
        if !self.enabled.load(Ordering::Relaxed) || self.queue().is_shutting_down() {
            return None;
        }
        let (request, shown) = self.queue().push(agent, Kind::Permission, input, unix_millis());
        if shown {
            (self.notify)(ApprovalEvent::Requested(request.clone()));
        }
        Some(request)
    }

    pub fn wait_for(&self, id: u64) -> (Option<Outcome>, CloseReason) {
        wait(self, None, id, Instant::now() + self.wait_limit)
    }

    pub fn close_elsewhere(&self, id: u64) {
        if self.queue().mark_elsewhere(id) {
            self.changed.notify_all();
        }
    }

    pub fn close(&self, id: u64, reason: CloseReason) {
        let next = self.queue().remove(id);
        self.changed.notify_all();
        (self.notify)(ApprovalEvent::Closed { id, reason });
        if let Some(next) = next {
            (self.notify)(ApprovalEvent::Requested(next));
        }
    }

    pub fn reopen(&self) {
        self.queue().reopen();
    }

    pub fn shut_down(&self) {
        self.queue().shut_down();
        self.changed.notify_all();
        let deadline = Instant::now() + SHUTDOWN_WAIT;
        let mut queue = self.queue();
        while queue.len() > 0 && Instant::now() < deadline {
            queue = self
                .changed
                .wait_timeout(queue, POLL_INTERVAL)
                .unwrap_or_else(PoisonError::into_inner)
                .0;
        }
    }
}

pub(super) struct Listener {
    stopping: Arc<AtomicBool>,
    port: u16,
    thread: thread::JoinHandle<()>,
}

impl Listener {
    pub fn port(&self) -> u16 {
        self.port
    }

    pub fn stop(self) {
        self.stopping.store(true, Ordering::SeqCst);
        let _ = TcpStream::connect(("127.0.0.1", self.port));
        let _ = self.thread.join();
    }
}

pub(super) fn new_shared(wait_limit: Duration, notify: Notify) -> Arc<Shared> {
    Arc::new(Shared {
        queue: Mutex::new(Queue::default()),
        changed: Condvar::new(),
        enabled: AtomicBool::new(false),
        wait_limit,
        notify,
    })
}

pub(super) fn serve(shared: &Arc<Shared>, preferred_port: u16, fallback: bool, token: &str) -> Result<Listener, String> {
    let listener = TcpListener::bind(("127.0.0.1", preferred_port))
        .or_else(|error| if fallback { TcpListener::bind(("127.0.0.1", 0)) } else { Err(error) })
        .map_err(|error| format!("Could not start the approval endpoint: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("The approval endpoint has no address: {error}"))?
        .port();
    let accepting = Arc::clone(shared);
    let token: Arc<str> = Arc::from(token);
    let stopping = Arc::new(AtomicBool::new(false));
    let stopped = Arc::clone(&stopping);
    let thread = thread::Builder::new()
        .name("agent-approval".into())
        .spawn(move || {
            for stream in listener.incoming() {
                if stopped.load(Ordering::SeqCst) {
                    break;
                }
                let Ok(stream) = stream else { continue };
                let shared = Arc::clone(&accepting);
                let token = Arc::clone(&token);
                let _ = thread::Builder::new()
                    .name("agent-approval-request".into())
                    .spawn(move || handle(&shared, stream, port, &token));
            }
        })
        .map_err(|error| format!("Could not start the approval endpoint thread: {error}"))?;
    Ok(Listener { stopping, port, thread })
}

#[cfg(test)]
pub(super) fn listen(preferred_port: u16, token: String, wait_limit: Duration, notify: Notify) -> Result<(Arc<Shared>, u16), String> {
    let shared = new_shared(wait_limit, notify);
    let port = serve(&shared, preferred_port, true, &token)?.port();
    Ok((shared, port))
}

fn handle(shared: &Shared, stream: TcpStream, port: u16, token: &str) {
    let (status, body) = match answer(shared, &stream, port, token) {
        Ok(Some(body)) => (200, body),
        Ok(None) => return,
        Err(error) => (error.status, serde_json::json!({ "error": error.message }).to_string()),
    };
    let _ = stream.set_nonblocking(false);
    let _ = write_response(&mut &stream, status, &body);
}

fn answer(shared: &Shared, stream: &TcpStream, port: u16, token: &str) -> Result<Option<String>, HttpError> {
    let _ = stream.set_read_timeout(Some(READ_TIMEOUT));
    let request = read_request(&mut BufReader::new(stream))?;
    if request.method != "POST" {
        return Err(HttpError { status: 405, message: "Only POST is accepted." });
    }
    let route = route(&request.path);
    if route.is_none() && request.path != ACTIVITY_PATH {
        return Err(HttpError { status: 404, message: "Unknown path." });
    }
    let remote_host = check_access(&request, token, port)?;
    let claude_route = route.is_none_or(|(agent, _)| agent == Agent::ClaudeCode);
    if claude_route && claimed_elsewhere(&request.body, windows_home_dir().ok().as_deref()).is_some() {
        return Ok(Some("{}".to_string()));
    }
    let Some((agent, kind)) = route else {
        let activity = Activity::parse(&request.body).map_err(|message| HttpError { status: 400, message })?;
        if let Some(activity) = activity {
            shared.settle_elsewhere(Agent::ClaudeCode, &activity);
        }
        return Ok(Some("{}".to_string()));
    };
    let mut input = HookInput::parse_for(agent, &request.body).map_err(|message| HttpError { status: 400, message })?;
    input.remote_host = remote_host;

    let question_elsewhere = match kind {
        Kind::Permission => input.is_question(),
        Kind::Question => !input.is_question(),
    };
    let hand_back = !shared.enabled.load(Ordering::Relaxed) || question_elsewhere || shared.queue().is_shutting_down();
    if hand_back {
        return Ok(Some("{}".to_string()));
    }

    let suggestions = input.permission_suggestions.clone();
    let tool_input = input.tool_input.clone();
    let (request, shown) = shared.queue().push(agent, kind, input, unix_millis());
    if shown {
        (shared.notify)(ApprovalEvent::Requested(request.clone()));
    }
    let (outcome, reason) = wait(shared, Some(stream), request.id, Instant::now() + shared.wait_limit);
    shared.close(request.id, reason);
    if reason == CloseReason::Disconnected {
        return Ok(None);
    }
    let decision = outcome.as_ref().map(|outcome| outcome.decision);
    Ok(Some(match kind {
        Kind::Permission => {
            let message = outcome.as_ref().and_then(|outcome| outcome.message.as_deref());
            permission_response(agent, decision, message, suggestions.as_ref())
        }
        Kind::Question => {
            let answers = outcome.as_ref().filter(|_| decision == Some(Decision::Answer)).and_then(|outcome| outcome.answers.as_ref());
            question_response(answers, &tool_input)
        }
    }))
}

fn wait(shared: &Shared, stream: Option<&TcpStream>, id: u64, deadline: Instant) -> (Option<Outcome>, CloseReason) {
    loop {
        {
            let queue = shared.queue();
            if let Some(outcome) = queue.outcome(id) {
                let reason = if outcome.decision == Decision::Terminal { CloseReason::HandedBack } else { CloseReason::Decided };
                return (Some(outcome), reason);
            }
            if queue.answered_elsewhere(id) {
                return (None, CloseReason::AnsweredElsewhere);
            }
            if queue.is_shutting_down() {
                return (None, CloseReason::Shutdown);
            }
            let now = Instant::now();
            if now >= deadline {
                return (None, CloseReason::Timeout);
            }
            let _ = shared
                .changed
                .wait_timeout(queue, POLL_INTERVAL.min(deadline - now))
                .unwrap_or_else(PoisonError::into_inner);
        }
        if stream.is_some_and(hung_up) {
            return (None, CloseReason::Disconnected);
        }
    }
}

fn hung_up(stream: &TcpStream) -> bool {
    if stream.set_nonblocking(true).is_err() {
        return false;
    }
    let mut byte = [0u8; 1];
    let closed = match stream.peek(&mut byte) {
        Ok(0) => true,
        Ok(_) => false,
        Err(error) => error.kind() != ErrorKind::WouldBlock,
    };
    let _ = stream.set_nonblocking(false);
    closed
}

fn unix_millis() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX))
        .unwrap_or(0)
}
