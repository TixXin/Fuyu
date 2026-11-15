use std::{
    sync::{Arc, Mutex, PoisonError},
    thread,
};

use serde_json::Value;

use super::decision::{Agent, Decision, HookInput};
use super::queue::CloseReason;

#[derive(Debug, Clone, PartialEq)]
pub(crate) struct ExternalRequest {
    pub key: String,
    pub session_id: String,
    pub cwd: Option<String>,
    pub tool_name: String,
    pub tool_input: Value,
}

pub(crate) type Answer = Arc<dyn Fn(&ExternalRequest, Decision, Option<&str>) + Send + Sync>;

enum State {
    Open(u64),
    Settled,
}

struct Tracked {
    agent: Agent,
    key: String,
    state: State,
}

static TRACKED: Mutex<Vec<Tracked>> = Mutex::new(Vec::new());
static ANSWERS: Mutex<Vec<(Agent, Answer)>> = Mutex::new(Vec::new());

pub(crate) fn sync(agent: Agent, open: Vec<ExternalRequest>, answer: Answer) {
    {
        let mut answers = ANSWERS.lock().unwrap_or_else(PoisonError::into_inner);
        answers.retain(|(known, _)| *known != agent);
        answers.push((agent, answer));
    }
    let Some(service) = super::SERVICE.get() else { return };
    let shared = Arc::clone(&service.shared);
    let mut tracked = TRACKED.lock().unwrap_or_else(PoisonError::into_inner);
    tracked.retain(|entry| {
        if entry.agent != agent || open.iter().any(|request| request.key == entry.key) {
            return true;
        }
        if let State::Open(id) = entry.state {
            shared.close_elsewhere(id);
        }
        false
    });
    for request in open {
        if tracked.iter().any(|entry| entry.agent == agent && entry.key == request.key) {
            continue;
        }
        let input = HookInput {
            session_id: request.session_id.clone(),
            cwd: request.cwd.clone(),
            tool_name: request.tool_name.clone(),
            tool_input: request.tool_input.clone(),
            permission_suggestions: None,
            agent_id: None,
            remote_host: None,
        };
        let Some(offered) = shared.offer(agent, input) else { continue };
        tracked.push(Tracked { agent, key: request.key.clone(), state: State::Open(offered.id) });
        let key = request.key.clone();
        let waiting = Arc::clone(&shared);
        let spawned = thread::Builder::new().name("agent-approval-external".into()).spawn(move || {
            let shared = waiting;
            let (outcome, reason) = shared.wait_for(offered.id);
            if let Some(outcome) = outcome.filter(|_| reason == CloseReason::Decided) {
                if let Some(answer) = answer_for(agent) {
                    answer(&request, outcome.decision, outcome.message.as_deref());
                }
            }
            shared.close(offered.id, reason);
            settle(agent, &request.key);
        });
        if spawned.is_err() {
            shared.close(offered.id, CloseReason::Shutdown);
            if let Some(entry) = tracked.iter_mut().find(|entry| entry.agent == agent && entry.key == key) {
                entry.state = State::Settled;
            }
        }
    }
}

fn answer_for(agent: Agent) -> Option<Answer> {
    let answers = ANSWERS.lock().unwrap_or_else(PoisonError::into_inner);
    answers.iter().find(|(known, _)| *known == agent).map(|(_, answer)| Arc::clone(answer))
}

fn settle(agent: Agent, key: &str) {
    let mut tracked = TRACKED.lock().unwrap_or_else(PoisonError::into_inner);
    if let Some(entry) = tracked.iter_mut().find(|entry| entry.agent == agent && entry.key == key) {
        entry.state = State::Settled;
    }
}
