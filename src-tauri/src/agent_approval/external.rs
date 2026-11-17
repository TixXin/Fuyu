use std::{
    sync::{Arc, Mutex, PoisonError},
    thread,
    time::{Duration, Instant},
};

use serde_json::Value;

use super::decision::{Agent, Decision, HookInput};
use super::queue::CloseReason;

const MAX_TRACKED_REQUESTS: usize = 64;
const MAX_ANSWER_AGENTS: usize = 16;
const STALE_TRACKED_TTL: Duration = Duration::from_secs(10 * 60);

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
    last_seen: Instant,
}

static TRACKED: Mutex<Vec<Tracked>> = Mutex::new(Vec::new());
static ANSWERS: Mutex<Vec<(Agent, Answer, Instant)>> = Mutex::new(Vec::new());

fn sync_answers(
    answers: &mut Vec<(Agent, Answer, Instant)>,
    agent: Agent,
    answer: Option<Answer>,
    now: Instant,
) {
    answers.retain(|(known, _, at)| {
        *known != agent && now.saturating_duration_since(*at) <= STALE_TRACKED_TTL
    });
    if let Some(answer) = answer {
        if answers.len() >= MAX_ANSWER_AGENTS {
            answers.sort_by_key(|(_, _, at)| *at);
            answers.drain(..answers.len() + 1 - MAX_ANSWER_AGENTS);
        }
        answers.push((agent, answer, now));
    }
}

fn retain_tracked(
    tracked: &mut Vec<Tracked>,
    agent: Agent,
    open: &[ExternalRequest],
    now: Instant,
) -> Vec<u64> {
    let mut closed = Vec::new();
    tracked.retain_mut(|entry| {
        if entry.agent == agent {
            if open.iter().any(|request| request.key == entry.key) {
                entry.last_seen = now;
                return true;
            }
            if let State::Open(id) = entry.state {
                closed.push(id);
            }
            return false;
        }
        if now.saturating_duration_since(entry.last_seen) <= STALE_TRACKED_TTL {
            return true;
        }
        if let State::Open(id) = entry.state {
            closed.push(id);
        }
        false
    });
    closed
}

fn evict_one_for_capacity(tracked: &mut Vec<Tracked>) -> Option<u64> {
    if tracked.len() < MAX_TRACKED_REQUESTS {
        return None;
    }
    if let Some((index, _)) = tracked
        .iter()
        .enumerate()
        .filter(|(_, entry)| matches!(entry.state, State::Settled))
        .min_by_key(|(_, entry)| entry.last_seen)
    {
        tracked.remove(index);
        return None;
    }
    let (index, _) = tracked.iter().enumerate().min_by_key(|(_, entry)| entry.last_seen)?;
    let removed = tracked.remove(index);
    match removed.state {
        State::Open(id) => Some(id),
        State::Settled => None,
    }
}

pub(crate) fn sync(agent: Agent, open: Vec<ExternalRequest>, answer: Answer) {
    let now = Instant::now();
    {
        let mut answers = ANSWERS.lock().unwrap_or_else(PoisonError::into_inner);
        sync_answers(&mut answers, agent, Some(answer), now);
    }
    let Some(service) = super::SERVICE.get() else {
        let mut tracked = TRACKED.lock().unwrap_or_else(PoisonError::into_inner);
        let _ = retain_tracked(&mut tracked, agent, &open, now);
        return;
    };
    let shared = Arc::clone(&service.shared);
    let mut tracked = TRACKED.lock().unwrap_or_else(PoisonError::into_inner);
    for id in retain_tracked(&mut tracked, agent, &open, now) {
        shared.close_elsewhere(id);
    }
    for request in open.into_iter().take(MAX_TRACKED_REQUESTS) {
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
        if let Some(evicted_id) = evict_one_for_capacity(&mut tracked) {
            shared.close_elsewhere(evicted_id);
        }
        tracked.push(Tracked {
            agent,
            key: request.key.clone(),
            state: State::Open(offered.id),
            last_seen: now,
        });
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
    let mut answers = ANSWERS.lock().unwrap_or_else(PoisonError::into_inner);
    let now = Instant::now();
    answers.retain(|(_, _, at)| now.saturating_duration_since(*at) <= STALE_TRACKED_TTL);
    answers.iter().find(|(known, _, _)| *known == agent).map(|(_, answer, _)| Arc::clone(answer))
}

fn settle(agent: Agent, key: &str) {
    let mut tracked = TRACKED.lock().unwrap_or_else(PoisonError::into_inner);
    if let Some(entry) = tracked.iter_mut().find(|entry| entry.agent == agent && entry.key == key) {
        entry.state = State::Settled;
        entry.last_seen = Instant::now();
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn req(key: &str) -> ExternalRequest {
        ExternalRequest {
            key: key.to_string(),
            session_id: "s1".to_string(),
            cwd: None,
            tool_name: "Bash".to_string(),
            tool_input: json!({}),
        }
    }

    #[test]
    fn external_tracking_prunes_stale_entries_and_caps_capacity() {
        let mut tracked = Vec::new();
        let t0 = Instant::now();
        tracked.push(Tracked {
            agent: Agent::ClaudeCode,
            key: "stale-open".into(),
            state: State::Open(42),
            last_seen: t0,
        });
        tracked.push(Tracked {
            agent: Agent::Opencode,
            key: "keep".into(),
            state: State::Settled,
            last_seen: t0,
        });

        let expired = t0 + STALE_TRACKED_TTL + Duration::from_secs(1);
        let closed = retain_tracked(&mut tracked, Agent::Opencode, &[req("keep")], expired);
        assert_eq!(closed, vec![42]);
        assert_eq!(tracked.len(), 1);
        assert_eq!(tracked[0].key, "keep");

        tracked.clear();
        for index in 0..MAX_TRACKED_REQUESTS {
            tracked.push(Tracked {
                agent: Agent::Opencode,
                key: format!("r-{index}"),
                state: if index == 3 { State::Settled } else { State::Open(index as u64 + 100) },
                last_seen: expired + Duration::from_millis(index as u64),
            });
        }
        assert_eq!(evict_one_for_capacity(&mut tracked), None);
        assert_eq!(tracked.len(), MAX_TRACKED_REQUESTS - 1);
        assert!(!tracked.iter().any(|entry| entry.key == "r-3"));

        let mut answers = Vec::new();
        let dummy: Answer = Arc::new(|_, _, _| {});
        sync_answers(&mut answers, Agent::Opencode, Some(Arc::clone(&dummy)), t0);
        assert_eq!(answers.len(), 1);
        sync_answers(&mut answers, Agent::Opencode, None, t0 + Duration::from_secs(1));
        assert!(answers.is_empty());
    }
}
