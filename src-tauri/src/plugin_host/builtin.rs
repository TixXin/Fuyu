use serde_json::{Map, Value};

use super::manifest::{parse_builtin_manifest, PluginManifest};
use super::settings::InfoItem;

const CENTER_PATTERN_MANIFEST: &str = r#"{
  "id": "focusd.center-pattern",
  "name": { "zh-CN": "中心图案", "en": "Center pattern" },
  "description": {
    "zh-CN": "收起的岛上没有文字时，在中间显示一个小动画：跟随光标的眼睛、小鸟、呼吸光点、小猫、随 AI Agent 状态变色的悬岛标志，或一只 Codex 宠物（随 AI Agent 的状态换动作；岛上显示 Agent 标题时，宠物或悬岛标志站在标题前代替 Agent 图标）。",
    "en": "When the collapsed island shows no text, a small animation sits in its middle: eyes that follow the cursor, a bird, a breathing light, a cat, the island mark, its light in your AI agents' state colour, or a Codex pet that acts out what your AI agents are doing (while the island shows an agent's title, the pet or the mark stands before it in place of the agent icon)."
  },
  "version": "1.0.0",
  "apiVersion": 1,
  "author": "ShengLin1001",
  "runtime": { "type": "builtin" },
  "contributes": {
    "settings": [
      {
        "key": "pattern",
        "type": "select",
        "title": { "zh-CN": "图案", "en": "Pattern" },
        "default": "eyes",
        "options": [
          { "value": "eyes", "title": { "zh-CN": "眼睛", "en": "Eyes" } },
          { "value": "bird", "title": { "zh-CN": "小鸟", "en": "Bird" } },
          { "value": "orb", "title": { "zh-CN": "光点", "en": "Light" } },
          { "value": "cat", "title": { "zh-CN": "小猫", "en": "Cat" } },
          { "value": "mark", "title": { "zh-CN": "悬岛", "en": "Island mark" } },
          { "value": "pet", "title": { "zh-CN": "宠物", "en": "Pet" } }
        ]
      },
      {
        "key": "pet",
        "type": "string",
        "title": { "zh-CN": "宠物", "en": "Pet" },
        "description": {
          "zh-CN": "图案选「宠物」时显示哪一只，默认小八（xiaoba）。宠物包（pet.json + spritesheet）放在 ~/.codex/pets 或应用数据目录的 pets 文件夹里；找不到时显示眼睛。",
          "en": "Which pet the Pet pattern shows; xiaoba by default. Pet packs (pet.json + spritesheet) go in ~/.codex/pets or the pets folder of the app data directory; without one the eyes show."
        },
        "default": "xiaoba"
      },
      {
        "key": "size",
        "type": "number",
        "title": { "zh-CN": "大小（像素）", "en": "Size (px)" },
        "description": {
          "zh-CN": "图案的高度，默认 24，和收起条上的环一样高；悬岛量的是胶囊，宠物比它高 4。",
          "en": "How tall the pattern is; 24 by default, as tall as the rings on the collapsed bar. For the island mark it is the pill; a pet is 4 taller."
        },
        "min": 16,
        "max": 30,
        "default": 24
      }
    ]
  }
}"#;

pub(super) const BUILTINS: &[(&str, &str, bool)] = &[
    ("focusd.center-pattern", CENTER_PATTERN_MANIFEST, false),
];

pub(super) fn manifests(app_version: &str) -> Vec<(&'static str, Result<PluginManifest, String>)> {
    BUILTINS.iter().map(|&(id, text, _)| (id, parse_builtin_manifest(text, id, app_version))).collect()
}

pub(super) fn is_builtin(id: &str) -> bool {
    BUILTINS.iter().any(|&(builtin, _, _)| builtin == id)
}

pub(super) fn has_native_work(builtins: &[(&str, &str, bool)], id: &str) -> Result<bool, String> {
    builtins
        .iter()
        .find(|&&(builtin, _, _)| builtin == id)
        .map(|&(_, _, native)| native)
        .ok_or_else(|| format!("Unknown built-in plugin {id}."))
}

pub(super) fn start(id: &str, _settings: &Map<String, Value>) -> Result<Vec<InfoItem>, String> {
    if !has_native_work(BUILTINS, id)? {
        return Ok(Vec::new());
    }
    Err(format!("Built-in plugin {id} is marked native but has no start."))
}

pub(super) fn stop(id: &str) -> Result<(), String> {
    let _ = has_native_work(BUILTINS, id)?;
    Ok(())
}

pub(super) fn settings_changed(_id: &str, _settings: &Map<String, Value>) -> Result<(), String> {
    Ok(())
}

pub(super) fn run_command(_id: &str, _command: &str) -> Result<Vec<InfoItem>, String> {
    Err("Unknown plugin command.".into())
}
