const SERVICES: &[(&str, &str)] = &[
    ("meeting.tencent.com", "/dm/"),
    ("meeting.tencent.com", "/p/"),
    ("meeting.tencent.com", "/s/"),
    ("wemeet.tencent.com", "/"),
    ("voovmeeting.com", "/"),
    ("meeting.wecom.work", "/"),
    ("work.weixin.qq.com", "/webapp/tm/"),
    ("vc.feishu.cn", "/j/"),
    ("vc.larksuite.com", "/j/"),
    ("meetings.feishu.cn", "/"),
    ("meetings.larksuite.com", "/"),
    ("applink.feishu.cn", "/client/vc/"),
    ("applink.larksuite.com", "/client/vc/"),
    ("meeting.dingtalk.com", "/"),
    ("meeting.huaweicloud.com", "/"),
    ("zoom.us", "/j/"),
    ("zoom.us", "/my/"),
    ("zoom.us", "/s/"),
    ("zoom.com.cn", "/j/"),
    ("zoom.com.cn", "/my/"),
    ("zoom.com.cn", "/s/"),
    ("teams.microsoft.com", "/l/meetup-join/"),
    ("teams.live.com", "/meet/"),
    ("meet.google.com", "/"),
    ("webex.com", "/"),
    ("meet.jit.si", "/"),
];

fn is_meeting_link(link: &str) -> bool {
    let Some(rest) = link.strip_prefix("https://") else {
        return false;
    };
    let (host, path) = rest.split_once('/').map_or((rest, "/".to_string()), |(host, path)| (host, format!("/{path}")));
    let host = host.to_ascii_lowercase();
    let clean_path = path.split(['?', '#']).next().unwrap_or(path.as_str());
    SERVICES.iter().any(|(service, prefix)| {
        (host == *service || host.ends_with(&format!(".{service}")))
            && clean_path.starts_with(prefix)
            && !clean_path[prefix.len()..].trim_matches('/').is_empty()
    })
}

fn is_delimiter(c: char) -> bool {
    c.is_whitespace()
        || matches!(
            c,
            '"' | '\'' | '<' | '>' | '(' | ')' | '[' | ']' | '{' | '}'
                | '，' | '。' | '、' | '；' | '：' | '！' | '？'
                | '（' | '）' | '【' | '】' | '《' | '》' | '「' | '」' | '『' | '』'
                | '“' | '”' | '‘' | '’'
        )
}

fn links(text: &str) -> impl Iterator<Item = &str> {
    text.match_indices("https://").map(move |(start, _)| {
        let rest = &text[start..];
        let end = rest.find(is_delimiter).unwrap_or(rest.len());
        rest[..end].trim_end_matches(['.', ',', ';', ':', '!', '?'])
    })
}

pub(super) fn meeting_link(fields: &[Option<&str>]) -> Option<String> {
    fields.iter().flatten().find_map(|field| links(field).filter(|link| is_meeting_link(link)).max_by_key(|link| link.len()).map(str::to_string))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn join_links_of_known_services_are_found_in_priority_order() {
        let description = "腾讯会议：https://meeting.tencent.com/dm/jvAnxAmrDfHt\n#腾讯会议：123-456\n资料 https://example.com/doc";
        assert_eq!(meeting_link(&[None, Some("3 楼会议室"), Some(description)]).as_deref(), Some("https://meeting.tencent.com/dm/jvAnxAmrDfHt"));
        assert_eq!(
            meeting_link(&[Some("https://vc.feishu.cn/j/123456789"), None, Some("https://zoom.us/j/1")]).as_deref(),
            Some("https://vc.feishu.cn/j/123456789")
        );
        assert_eq!(meeting_link(&[None, Some("<https://us02web.zoom.us/j/8812345?pwd=abc>")]).as_deref(), Some("https://us02web.zoom.us/j/8812345?pwd=abc"));
        assert_eq!(meeting_link(&[Some("https://meet.google.com/abc-defg-hij.")]).as_deref(), Some("https://meet.google.com/abc-defg-hij"));
        assert_eq!(meeting_link(&[Some("https://zoom.us/pricing"), Some("https://example.com/j/1"), Some("http://zoom.us/j/1")]), None);
        assert_eq!(meeting_link(&[Some("https://meet.google.com/"), Some("https://wemeet.tencent.com/?from=home")]), None);
    }

    #[test]
    fn domestic_and_global_variants_and_punctuation_delimiters_are_handled() {
        let cases = [
            ("【腾讯短链 https://meeting.tencent.com/s/K8xYz123】", "https://meeting.tencent.com/s/K8xYz123"),
            ("入会：https://wemeet.tencent.com/p/987654321（密码 6666）", "https://wemeet.tencent.com/p/987654321"),
            ("企微会议 https://meeting.wecom.work/s/ab12cd、备用链接", "https://meeting.wecom.work/s/ab12cd"),
            ("企微网页 https://work.weixin.qq.com/webapp/tm/ef34gh；请准时", "https://work.weixin.qq.com/webapp/tm/ef34gh"),
            ("飞书 https://meetings.feishu.cn/s/1a2b3c4d", "https://meetings.feishu.cn/s/1a2b3c4d"),
            ("Lark https://meetings.larksuite.com/s/5e6f7g8h", "https://meetings.larksuite.com/s/5e6f7g8h"),
            ("AppLink \"https://applink.feishu.cn/client/vc/open?id=123\"", "https://applink.feishu.cn/client/vc/open?id=123"),
            ("Lark AppLink 'https://applink.larksuite.com/client/vc/open?id=456'", "https://applink.larksuite.com/client/vc/open?id=456"),
            ("华为云（https://meeting.huaweicloud.com/welink/998877）", "https://meeting.huaweicloud.com/welink/998877"),
            ("Zoom PMI [入会](https://zoom.us/my/alice.room)", "https://zoom.us/my/alice.room"),
            ("Zoom 分享 https://zoom.us/s/88112233;", "https://zoom.us/s/88112233"),
            ("Zoom 中国 https://zoom.com.cn/my/bob_room，密码无", "https://zoom.com.cn/my/bob_room"),
            ("Zoom 中国分享 https://cn01.zoom.com.cn/s/77665544", "https://cn01.zoom.com.cn/s/77665544"),
            ("Jitsi 「https://meet.jit.si/FuyuDailySync」", "https://meet.jit.si/FuyuDailySync"),
        ];
        for (input, expected) in cases {
            assert_eq!(meeting_link(&[None, None, Some(input)]).as_deref(), Some(expected), "{input}");
        }
        assert_eq!(
            meeting_link(&[
                Some("https://meeting.tencent.com/s/"),
                Some("https://applink.feishu.cn/client/vc/"),
                Some("https://work.weixin.qq.com/webapp/tm/"),
                Some("https://zoom.us/my/"),
                Some("https://meet.jit.si/"),
            ]),
            None
        );
    }
}
