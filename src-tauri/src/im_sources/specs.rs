use crate::messages_plugin::{DINGTALK, DISCORD, FEISHU, TELEGRAM, TIM, WECOM, WHATSAPP};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[allow(dead_code)]
pub enum MatchRule {
    AumidExact(&'static str),
    AumidPrefix(&'static str),
    AumidContains(&'static str),
    DisplayNameExact(&'static str),
}

#[allow(dead_code)]
impl MatchRule {
    pub fn matches(&self, aumid: &str, display_name: &str) -> bool {
        match self {
            Self::AumidExact(expected) => aumid.eq_ignore_ascii_case(expected),
            Self::AumidPrefix(prefix) => {
                !prefix.is_empty() && starts_with_ignore_ascii_case(aumid, prefix)
            }
            Self::AumidContains(needle) => contains_ignore_case(aumid, needle),
            Self::DisplayNameExact(expected) => {
                !expected.is_empty() && equals_ignore_case(display_name, expected)
            }
        }
    }
}

fn starts_with_ignore_ascii_case(text: &str, prefix: &str) -> bool {
    text.get(..prefix.len())
        .is_some_and(|head| head.eq_ignore_ascii_case(prefix))
}

fn equals_ignore_case(a: &str, b: &str) -> bool {
    if a.is_ascii() && b.is_ascii() {
        a.eq_ignore_ascii_case(b)
    } else {
        a.to_lowercase() == b.to_lowercase()
    }
}

fn contains_ignore_case(text: &str, needle: &str) -> bool {
    if needle.is_empty() {
        return false;
    }
    if !needle.is_ascii() || !text.is_ascii() {
        return text.to_lowercase().contains(&needle.to_lowercase());
    }
    text.as_bytes()
        .windows(needle.len())
        .any(|window| window.eq_ignore_ascii_case(needle.as_bytes()))
}

#[derive(Clone, Copy, Debug)]
#[allow(dead_code)]
pub struct ImSourceSpec {
    pub id: &'static str,
    pub display_name: &'static str,
    pub toast_rules: &'static [MatchRule],
    pub executables: &'static [&'static str],
    pub protocols: &'static [&'static str],
    pub package_prefixes: &'static [&'static str],
    pub fallback_aumids: &'static [&'static str],
    pub uninstall_keys: &'static [&'static str],
    pub tencent_keys: &'static [&'static str],
    pub macos_bundle_ids: &'static [&'static str],
}

#[allow(dead_code)]
impl ImSourceSpec {
    pub fn matches_toast(&self, aumid: &str, display_name: &str) -> bool {
        self.toast_rules
            .iter()
            .any(|rule| rule.matches(aumid, display_name))
    }

    pub fn matches_executable(&self, file_name: &str) -> bool {
        self.executables
            .iter()
            .any(|candidate| candidate.eq_ignore_ascii_case(file_name))
    }
}

pub const SOURCES: [ImSourceSpec; 7] = [
    ImSourceSpec {
        id: TELEGRAM,
        display_name: "Telegram",
        toast_rules: &[
            MatchRule::AumidPrefix("Telegram.TelegramDesktop"),
            MatchRule::AumidPrefix("TelegramMessengerLLP.TelegramDesktop"),
            MatchRule::DisplayNameExact("Telegram"),
            MatchRule::DisplayNameExact("Telegram Desktop"),
            MatchRule::DisplayNameExact("Telegram Messenger"),
        ],
        executables: &["Telegram.exe"],
        protocols: &["tg"],
        package_prefixes: &["TelegramMessengerLLP.TelegramDesktop"],
        fallback_aumids: &[
            "TelegramMessengerLLP.TelegramDesktop_t4vj0pshhgkwm!Telegram.TelegramDesktop.Store",
        ],
        uninstall_keys: &[
            "Telegram Desktop",
            "{53F49750-6209-4FBF-9CA8-7A333C87D1ED}_is1",
        ],
        tencent_keys: &[],
        macos_bundle_ids: &["ru.keepcoder.Telegram", "com.tdesktop.Telegram"],
    },
    ImSourceSpec {
        id: DISCORD,
        display_name: "Discord",
        toast_rules: &[
            MatchRule::AumidPrefix("com.squirrel.Discord"),
            MatchRule::AumidPrefix("DiscordInc.Discord"),
            MatchRule::AumidExact("Discord"),
            MatchRule::DisplayNameExact("Discord"),
            MatchRule::DisplayNameExact("Discord PTB"),
            MatchRule::DisplayNameExact("Discord Canary"),
        ],
        executables: &["Discord.exe", "DiscordPTB.exe", "DiscordCanary.exe"],
        protocols: &["discord"],
        package_prefixes: &["DiscordInc.Discord"],
        fallback_aumids: &[],
        uninstall_keys: &["Discord", "DiscordPTB", "DiscordCanary"],
        tencent_keys: &[],
        macos_bundle_ids: &[
            "com.hnc.Discord",
            "com.hnc.DiscordPTB",
            "com.hnc.DiscordCanary",
        ],
    },
    ImSourceSpec {
        id: WHATSAPP,
        display_name: "WhatsApp",
        toast_rules: &[
            MatchRule::AumidPrefix("5319275A.WhatsAppDesktop"),
            MatchRule::AumidPrefix("WhatsApp."),
            MatchRule::AumidExact("WhatsApp"),
            MatchRule::DisplayNameExact("WhatsApp"),
            MatchRule::DisplayNameExact("WhatsApp Desktop"),
        ],
        executables: &["WhatsApp.exe", "WhatsApp.Root.exe"],
        protocols: &["whatsapp"],
        package_prefixes: &["5319275A.WhatsAppDesktop"],
        fallback_aumids: &["5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App"],
        uninstall_keys: &["WhatsApp"],
        tencent_keys: &[],
        macos_bundle_ids: &["net.whatsapp.WhatsApp"],
    },
    ImSourceSpec {
        id: TIM,
        display_name: "TIM",
        toast_rules: &[
            MatchRule::AumidExact("Tencent.TIM"),
            MatchRule::AumidPrefix("Tencent.TIM."),
            MatchRule::AumidPrefix("com.tencent.tim"),
            MatchRule::AumidExact("TIM"),
            MatchRule::DisplayNameExact("TIM"),
        ],
        executables: &["TIM.exe"],
        protocols: &[],
        package_prefixes: &[],
        fallback_aumids: &[],
        uninstall_keys: &["TIM"],
        tencent_keys: &["TIM"],
        macos_bundle_ids: &["com.tencent.tim"],
    },
    ImSourceSpec {
        id: FEISHU,
        display_name: "Feishu",
        toast_rules: &[
            MatchRule::AumidContains("Feishu"),
            MatchRule::AumidExact("Lark"),
            MatchRule::AumidPrefix("Lark."),
            MatchRule::AumidContains(".Lark"),
            MatchRule::AumidContains("\\Lark"),
            MatchRule::AumidContains("/Lark"),
            MatchRule::AumidContains("LarkSuite"),
            MatchRule::DisplayNameExact("飞书"),
            MatchRule::DisplayNameExact("Feishu"),
            MatchRule::DisplayNameExact("Lark"),
        ],
        executables: &["Feishu.exe", "Lark.exe"],
        protocols: &["feishu", "lark"],
        package_prefixes: &[],
        fallback_aumids: &[],
        uninstall_keys: &["Feishu", "Lark", "飞书"],
        tencent_keys: &[],
        macos_bundle_ids: &["com.electron.lark", "com.larksuite.larkApp"],
    },
    ImSourceSpec {
        id: DINGTALK,
        display_name: "DingTalk",
        toast_rules: &[
            MatchRule::AumidContains("DingTalk"),
            MatchRule::AumidContains("钉钉"),
            MatchRule::DisplayNameExact("钉钉"),
            MatchRule::DisplayNameExact("DingTalk"),
        ],
        executables: &["DingTalk.exe"],
        protocols: &["dingtalk"],
        package_prefixes: &[],
        fallback_aumids: &[],
        uninstall_keys: &["DingTalk", "钉钉"],
        tencent_keys: &[],
        macos_bundle_ids: &["com.alibaba.DingTalkMac", "com.dingtalk.mac"],
    },
    ImSourceSpec {
        id: WECOM,
        display_name: "WeCom",
        toast_rules: &[
            MatchRule::AumidContains("WXWork"),
            MatchRule::AumidContains("WeChatWork"),
            MatchRule::AumidContains("WeCom"),
            MatchRule::AumidContains("企业微信"),
            MatchRule::DisplayNameExact("企业微信"),
            MatchRule::DisplayNameExact("WeCom"),
            MatchRule::DisplayNameExact("WXWork"),
            MatchRule::DisplayNameExact("WeChat Work"),
        ],
        executables: &["WXWork.exe"],
        protocols: &["wxwork"],
        package_prefixes: &[],
        fallback_aumids: &[],
        uninstall_keys: &["WXWork", "企业微信", "WeCom"],
        tencent_keys: &["WXWork"],
        macos_bundle_ids: &["com.tencent.WeWorkMac"],
    },
];

#[allow(dead_code)]
pub fn find_spec(source: &str) -> Option<&'static ImSourceSpec> {
    let trimmed = source.trim();
    SOURCES.iter().find(|spec| spec.id == trimmed)
}

#[allow(dead_code)]
pub fn find_index(source: &str) -> Option<usize> {
    let trimmed = source.trim();
    SOURCES.iter().position(|spec| spec.id == trimmed)
}

#[allow(dead_code)]
pub fn match_source(aumid: &str, display_name: &str) -> Option<&'static str> {
    SOURCES
        .iter()
        .find(|spec| spec.matches_toast(aumid, display_name))
        .map(|spec| spec.id)
}
