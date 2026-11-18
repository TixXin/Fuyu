use super::*;
use std::cell::RefCell;
use std::collections::HashMap;

#[derive(Default)]
struct Mock {
    replies: HashMap<(String, String), Reply>,
    sent: RefCell<Vec<String>>,
}

impl Mock {
    fn on(mut self, method: &str, url: &str, status: u16, body: &str) -> Self {
        self.replies.insert((method.into(), url.into()), Reply { status, location: None, body: body.into() });
        self
    }

    fn redirect(mut self, method: &str, url: &str, status: u16, location: &str) -> Self {
        self.replies.insert((method.into(), url.into()), Reply { status, location: Some(location.into()), body: String::new() });
        self
    }

    fn sent(&self) -> Vec<String> {
        self.sent.borrow().clone()
    }
}

impl Transport for Mock {
    async fn send(&self, method: &str, url: &Url, depth: &str, _body: &str) -> Result<Reply, UserError> {
        self.sent.borrow_mut().push(format!("{method} {url} {depth}"));
        Ok(self.replies.get(&(method.to_string(), url.to_string())).cloned().unwrap_or(Reply { status: 404, ..Reply::default() }))
    }
}

fn principal(href: &str) -> String {
    format!(r#"<d:multistatus xmlns:d="DAV:"><d:response><d:href>/</d:href><d:propstat><d:prop><d:current-user-principal><d:href>{href}</d:href></d:current-user-principal></d:prop></d:propstat></d:response></d:multistatus>"#)
}

fn home(href: &str) -> String {
    format!(r#"<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/p</d:href><d:propstat><d:prop><c:calendar-home-set><d:href>{href}</d:href></c:calendar-home-set></d:prop></d:propstat></d:response></d:multistatus>"#)
}

fn listing(home: &str, calendar: &str) -> String {
    format!(
        r#"<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
<d:response><d:href>{home}</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
<d:response><d:href>{calendar}</d:href><d:propstat><d:prop><d:resourcetype><d:collection/><c:calendar/></d:resourcetype></d:prop></d:propstat></d:response>
</d:multistatus>"#
    )
}

const EVENTS: &str = r#"<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/e.ics</d:href><d:propstat><d:prop><c:calendar-data>BEGIN:VCALENDAR</c:calendar-data></d:prop></d:propstat></d:response></d:multistatus>"#;

fn url(text: &str) -> Url {
    Url::parse(text).unwrap()
}

fn run<F: std::future::Future>(future: F) -> F::Output {
    tauri::async_runtime::block_on(future)
}

fn window() -> (DateTime<Utc>, DateTime<Utc>) {
    use chrono::TimeZone;
    (Utc.with_ymd_and_hms(2026, 11, 1, 0, 0, 0).unwrap(), Utc.with_ymd_and_hms(2026, 12, 1, 0, 0, 0).unwrap())
}

#[test]
fn dingtalk_root_refuses_propfind_so_the_well_known_redirect_is_followed() {
    let host = "https://calendar.dingtalk.com";
    let mock = Mock::default()
        .on("PROPFIND", &format!("{host}/"), 405, "")
        .redirect("PROPFIND", &format!("{host}/.well-known/caldav"), 302, "https://calendar.dingtalk.com/dav/principals/")
        .on("PROPFIND", &format!("{host}/dav/principals/"), 207, &principal("/dav/users/u_abc"))
        .on("PROPFIND", &format!("{host}/dav/users/u_abc"), 207, &home("/dav/u_abc/"))
        .on("PROPFIND", &format!("{host}/dav/u_abc/"), 207, &listing("/dav/u_abc/", "/dav/u_abc/work/"))
        .on("REPORT", &format!("{host}/dav/u_abc/work/"), 207, EVENTS);
    let (from, to) = window();
    let feeds = run(events(&mock, &url(host), from, to)).unwrap();
    assert_eq!(feeds, [CalendarFeed { displayname: None, color: None, texts: vec!["BEGIN:VCALENDAR".into()] }]);
    assert_eq!(
        mock.sent(),
        [
            "PROPFIND https://calendar.dingtalk.com/ 0",
            "PROPFIND https://calendar.dingtalk.com/.well-known/caldav 0",
            "PROPFIND https://calendar.dingtalk.com/dav/principals/ 0",
            "PROPFIND https://calendar.dingtalk.com/dav/users/u_abc 0",
            "PROPFIND https://calendar.dingtalk.com/dav/u_abc/ 1",
            "REPORT https://calendar.dingtalk.com/dav/u_abc/work/ 1",
        ]
    );
}

#[test]
fn a_root_that_answers_is_used_without_trying_the_well_known_address() {
    let mock = Mock::default()
        .on("PROPFIND", "https://caldav.feishu.cn/", 207, &principal("/principals/u1/"))
        .on("PROPFIND", "https://caldav.feishu.cn/principals/u1/", 207, &home("/calendars/u1/"))
        .on("PROPFIND", "https://caldav.feishu.cn/calendars/u1/", 207, &listing("/calendars/u1/", "/calendars/u1/a/"));
    let found = run(calendars(&mock, &url("https://caldav.feishu.cn"))).unwrap();
    assert_eq!(found, [RemoteCalendar { url: url("https://caldav.feishu.cn/calendars/u1/a/"), displayname: None, color: None }]);
    assert!(mock.sent().iter().all(|line| !line.contains(".well-known")));
}

#[test]
fn a_calendar_address_is_used_as_it_is() {
    let address = "https://dav.example.com/cal/me/work/";
    let mock = Mock::default().on("PROPFIND", address, 207, &listing("/x/", address));
    let found = run(calendars(&mock, &url(address))).unwrap();
    assert_eq!(found, [RemoteCalendar { url: url(address), displayname: None, color: None }]);
    assert_eq!(mock.sent().len(), 1);
}

#[test]
fn an_empty_root_answer_falls_back_to_the_well_known_address() {
    let empty = r#"<d:multistatus xmlns:d="DAV:"><d:response><d:href>/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response></d:multistatus>"#;
    let mock = Mock::default()
        .on("PROPFIND", "https://cloud.example.com/", 207, empty)
        .redirect("PROPFIND", "https://cloud.example.com/.well-known/caldav", 301, "/remote.php/dav/")
        .on("PROPFIND", "https://cloud.example.com/remote.php/dav/", 207, &home("/remote.php/dav/calendars/me/"))
        .on("PROPFIND", "https://cloud.example.com/remote.php/dav/calendars/me/", 207, &listing("/remote.php/dav/calendars/me/", "/remote.php/dav/calendars/me/personal/"));
    let found = run(calendars(&mock, &url("https://cloud.example.com"))).unwrap();
    assert_eq!(found, [RemoteCalendar { url: url("https://cloud.example.com/remote.php/dav/calendars/me/personal/"), displayname: None, color: None }]);
}

#[test]
fn a_wrong_password_stops_before_the_well_known_address() {
    let mock = Mock::default().on("PROPFIND", "https://dav.example.com/", 401, "");
    let error = run(calendars(&mock, &url("https://dav.example.com/"))).unwrap_err();
    assert_eq!(error.code(), "calendar.login");
    assert_eq!(mock.sent().len(), 1);

    let mock = Mock::default().on("PROPFIND", "https://calendar.dingtalk.com/", 405, "").redirect("PROPFIND", "https://calendar.dingtalk.com/.well-known/caldav", 302, "/dav/principals/").on("PROPFIND", "https://calendar.dingtalk.com/dav/principals/", 401, "");
    assert_eq!(run(calendars(&mock, &url("https://calendar.dingtalk.com"))).unwrap_err().code(), "calendar.login");
}

#[test]
fn when_nothing_works_the_typed_address_error_is_reported() {
    let mock = Mock::default().on("PROPFIND", "https://dav.example.com/", 405, "");
    let error = run(calendars(&mock, &url("https://dav.example.com/"))).unwrap_err();
    assert_eq!(error.code(), "calendar.status");
    assert!(error.to_string().contains("405"));
    assert_eq!(mock.sent().len(), 2);
}

#[test]
fn redirects_keep_the_method_and_never_leave_the_host() {
    let mock = Mock::default().redirect("REPORT", "https://a.example.com/cal/", 308, "/cal2/").on("REPORT", "https://a.example.com/cal2/", 207, EVENTS);
    let answer = run(dav(&mock, "REPORT", &url("https://a.example.com/cal/"), "1", "")).unwrap();
    assert_eq!((answer.url.as_str(), answer.status), ("https://a.example.com/cal2/", 207));

    let away = |location: &str| Reply { status: 302, location: Some(location.into()), body: String::new() };
    let from = url("https://a.example.com/x");
    assert_eq!(redirect_target(&from, &away("https://evil.example.net/x")), None);
    assert_eq!(redirect_target(&from, &away("http://a.example.com/x")), None);
    assert_eq!(redirect_target(&from, &away("https://a.example.com:8443/x")), None);
    assert_eq!(redirect_target(&from, &Reply { status: 302, ..Reply::default() }), None);
    assert_eq!(redirect_target(&from, &away("y/")), Some(url("https://a.example.com/y/")));

    let looping = Mock::default().redirect("PROPFIND", "https://a.example.com/l", 302, "/l");
    let answer = run(follow(&looping, "PROPFIND", &url("https://a.example.com/l"), "0", "")).unwrap();
    assert_eq!((answer.status, looping.sent().len()), (302, MAX_REDIRECTS + 1));
}

const ITEMS: &str = r#"<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
<d:response><d:href>/dav/u_abc/work/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/><c:calendar/></d:resourcetype></d:prop></d:propstat></d:response>
<d:response><d:href>/dav/u_abc/work/a&amp;1.ics</d:href><d:propstat><d:prop><d:getetag>"1"</d:getetag><d:resourcetype/></d:prop></d:propstat></d:response>
<d:response><d:href>/dav/u_abc/work/b.ics</d:href><d:propstat><d:prop><d:getetag>"2"</d:getetag><d:resourcetype/></d:prop></d:propstat></d:response>
</d:multistatus>"#;

#[test]
fn a_refused_calendar_query_falls_back_to_listing_and_multiget() {
    let calendar = "https://calendar.dingtalk.com/dav/u_abc/work/";
    let mock = Mock::default().on("PROPFIND", calendar, 207, ITEMS).on("REPORT", calendar, 400, "");
    let (from, to) = window();
    let error = run(calendar_events(&mock, &url(calendar), from, to)).unwrap_err();
    assert!(error.to_string().contains("400"));
    assert_eq!(mock.sent(), [format!("REPORT {calendar} 1"), format!("PROPFIND {calendar} 1"), format!("REPORT {calendar} 1")]);

    struct Picky(Mock);
    impl Transport for Picky {
        async fn send(&self, method: &str, url: &Url, depth: &str, body: &str) -> Result<Reply, UserError> {
            if method == "REPORT" && body.contains("calendar-multiget") {
                assert!(body.contains("<d:href>/dav/u_abc/work/a&amp;1.ics</d:href><d:href>/dav/u_abc/work/b.ics</d:href>"));
                self.0.sent.borrow_mut().push("MULTIGET".into());
                return Ok(Reply { status: 207, location: None, body: EVENTS.into() });
            }
            self.0.send(method, url, depth, body).await
        }
    }
    let picky = Picky(Mock::default().on("PROPFIND", calendar, 207, ITEMS).on("REPORT", calendar, 400, ""));
    assert_eq!(run(calendar_events(&picky, &url(calendar), from, to)).unwrap(), ["BEGIN:VCALENDAR"]);
    assert_eq!(picky.0.sent().last().map(String::as_str), Some("MULTIGET"));
}

#[test]
fn a_wrong_password_on_the_query_is_not_retried() {
    let calendar = "https://dav.example.com/cal/";
    let mock = Mock::default().on("REPORT", calendar, 401, "");
    let (from, to) = window();
    assert_eq!(run(calendar_events(&mock, &url(calendar), from, to)).unwrap_err().code(), "calendar.login");
    assert_eq!(mock.sent().len(), 1);
}

#[test]
fn a_failed_request_never_shows_the_address() {
    let account = Account { url: "https://someone:pa55word@127.0.0.1:1/dav/private-s3cr3t/", username: "someone", password: "pa55word" };
    let (from, to) = window();
    let error = run(fetch(&account, from, to)).unwrap_err();
    assert_eq!(error.code(), "calendar.unreachable");
    let shown = serde_json::to_string(&error).unwrap() + &error.to_string();
    assert!(!shown.contains("s3cr3t") && !shown.contains("pa55word") && !shown.contains("/dav/"), "{shown}");
}

#[test]
fn multiple_sub_calendars_keep_their_unescaped_display_names() {
    let multi = r#"<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav" xmlns:IC="http://apple.com/ns/ical/">
<D:response><D:href>/calendars/u1/</D:href><D:propstat><D:prop><D:displayname>Root</D:displayname><D:resourcetype><D:collection/></D:resourcetype></D:prop></D:propstat></D:response>
<D:response><D:href>/calendars/u1/personal/</D:href><D:propstat><D:prop><D:displayname>个人日程</D:displayname><IC:calendar-color>#3B82F6FF</IC:calendar-color><D:resourcetype><D:collection/><C:calendar/></D:resourcetype></D:prop></D:propstat></D:response>
<D:response><D:href>/calendars/u1/team/</D:href><D:propstat><D:prop><D:displayname>研发 &amp; 测试</D:displayname><IC:calendar-color>#10b981</IC:calendar-color><D:resourcetype><D:collection/><C:calendar/></D:resourcetype></D:prop></D:propstat></D:response>
<D:response><D:href>/calendars/u1/unnamed/</D:href><D:propstat><D:prop><D:displayname>   </D:displayname><IC:calendar-color>invalid</IC:calendar-color><D:resourcetype><D:collection/><C:calendar/></D:resourcetype></D:prop></D:propstat></D:response>
</D:multistatus>"#;
    let body_of = |uid: &str| {
        format!(
            r#"<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>/{uid}.ics</d:href><d:propstat><d:prop><c:calendar-data>UID:{uid}</c:calendar-data></d:prop></d:propstat></d:response></d:multistatus>"#
        )
    };
    let mock = Mock::default()
        .on("PROPFIND", "https://caldav.feishu.cn/", 207, &principal("/principals/u1/"))
        .on("PROPFIND", "https://caldav.feishu.cn/principals/u1/", 207, &home("/calendars/u1/"))
        .on("PROPFIND", "https://caldav.feishu.cn/calendars/u1/", 207, multi)
        .on("REPORT", "https://caldav.feishu.cn/calendars/u1/personal/", 207, &body_of("p1"))
        .on("REPORT", "https://caldav.feishu.cn/calendars/u1/team/", 207, &body_of("t1"))
        .on("REPORT", "https://caldav.feishu.cn/calendars/u1/unnamed/", 207, &body_of("u1"));
    let (from, to) = window();
    let feeds = run(events(&mock, &url("https://caldav.feishu.cn"), from, to)).unwrap();
    assert_eq!(
        feeds,
        [
            CalendarFeed { displayname: Some("个人日程".into()), color: Some("#3b82f6".into()), texts: vec!["UID:p1".into()] },
            CalendarFeed { displayname: Some("研发 & 测试".into()), color: Some("#10b981".into()), texts: vec!["UID:t1".into()] },
            CalendarFeed { displayname: None, color: None, texts: vec!["UID:u1".into()] },
        ]
    );
}
