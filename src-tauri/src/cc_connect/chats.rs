use std::{collections::BTreeMap, fs, path::Path};

use serde::Serialize;
use serde_json::Value;

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub name: String,
    pub agent: Option<String>,
    pub chats: Vec<Chat>,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Chat {
    pub key: String,
    pub platform: String,
    pub user_name: Option<String>,
}

pub(super) fn project_name(file_name: &str) -> Option<&str> {
    let base = file_name.strip_suffix(".json")?;
    let base = base.strip_suffix(".sessions").unwrap_or(base);
    let name = match base.rsplit_once('_') {
        Some((head, hash)) if hash.len() == 8 && hash.bytes().all(|byte| byte.is_ascii_hexdigit()) => {
            head.strip_suffix("_ws").unwrap_or(head)
        }
        _ => base,
    };
    (!name.is_empty()).then_some(name)
}

pub(super) fn chats_of(text: &str) -> Vec<Chat> {
    let Ok(store) = serde_json::from_str::<Value>(text) else { return Vec::new() };
    let Some(sessions) = store["user_sessions"].as_object() else { return Vec::new() };
    sessions
        .keys()
        .filter_map(|key| {
            let (platform, _) = key.split_once(':')?;
            let user_name = store["user_meta"][key]["user_name"].as_str().filter(|name| !name.is_empty());
            Some(Chat { key: key.clone(), platform: platform.to_string(), user_name: user_name.map(str::to_string) })
        })
        .collect()
}

pub(super) fn projects_from(files: impl IntoIterator<Item = (String, String)>, config: Option<&str>) -> Vec<Project> {
    let mut projects: BTreeMap<String, BTreeMap<String, Chat>> = BTreeMap::new();
    for (file_name, text) in files {
        let Some(name) = project_name(&file_name) else { continue };
        let chats = projects.entry(name.to_string()).or_default();
        for chat in chats_of(&text) {
            chats.entry(chat.key.clone()).or_insert(chat);
        }
    }
    let mut agents = config.map(super::config_file::project_agents).unwrap_or_default();
    projects
        .into_iter()
        .map(|(name, chats)| Project { agent: agents.remove(&name), name, chats: chats.into_values().collect() })
        .collect()
}

pub(super) fn read_projects(data_dir: &Path, config: Option<&str>) -> Vec<Project> {
    let files = fs::read_dir(data_dir.join("sessions")).into_iter().flatten().flatten().filter_map(|entry| {
        let name = entry.file_name().to_str()?.to_string();
        project_name(&name)?;
        Some((name, fs::read_to_string(entry.path()).unwrap_or_default()))
    });
    projects_from(files, config)
}

#[cfg(test)]
mod tests {
    use super::{chats_of, project_name, projects_from, Chat};

    #[test]
    fn projects_put_their_files_together_and_carry_their_agent() {
        let files = [
            ("pc_60329304.json".to_string(), r#"{"user_sessions": {"telegram:1:1": []}}"#.to_string()),
            ("pc_0a1b2c3d.json".to_string(), r#"{"user_sessions": {"telegram:1:1": [], "discord:2:3": []}}"#.to_string()),
            ("other.txt".to_string(), String::new()),
        ];
        let projects = projects_from(files, Some("[[projects]]\nname = \"pc\"\n[projects.agent]\ntype = \"codex\"\n"));
        assert_eq!(projects.len(), 1);
        assert_eq!((projects[0].name.as_str(), projects[0].agent.as_deref(), projects[0].chats.len()), ("pc", Some("codex"), 2));
    }

    #[test]
    fn a_session_file_names_its_project() {
        assert_eq!(project_name("pc_60329304.json"), Some("pc"));
        assert_eq!(project_name("my_bot_ws_0a1b2c3d.json"), Some("my_bot"));
        assert_eq!(project_name("mybot.sessions.json"), Some("mybot"));
        assert_eq!(project_name("bot_cafe.json"), Some("bot_cafe"));
        assert_eq!(project_name("notes.txt"), None);
        assert_eq!(project_name("_60329304.json"), None);
    }

    #[test]
    fn chats_come_with_their_platform_and_user_name() {
        let text = r#"{"user_sessions": {"telegram:1:1": ["s1"], "discord:2:3": ["s2"], "broken": []},
            "user_meta": {"telegram:1:1": {"user_name": "pj"}}}"#;
        let mut chats = chats_of(text);
        chats.sort_by(|a, b| a.key.cmp(&b.key));
        assert_eq!(
            chats,
            vec![
                Chat { key: "discord:2:3".into(), platform: "discord".into(), user_name: None },
                Chat { key: "telegram:1:1".into(), platform: "telegram".into(), user_name: Some("pj".into()) },
            ]
        );
        assert!(chats_of("not json").is_empty());
    }
}
