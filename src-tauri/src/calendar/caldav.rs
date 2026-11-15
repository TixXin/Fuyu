use crate::user_error::UserError;
use std::time::Duration;

use chrono::{DateTime, Utc};
use quick_xml::{events::Event, Reader};
use reqwest::{Method, Url};

use crate::system::updater::reqwest_proxy;

const MAX_RESPONSE_BYTES: usize = 8 * 1024 * 1024;
const MAX_CALENDARS: usize = 20;
const MAX_REDIRECTS: usize = 5;
const MAX_ITEMS: usize = 1000;
const MULTIGET_BATCH: usize = 100;

#[derive(Debug, Default, PartialEq, Eq)]
pub(super) struct DavResponse {
    pub(super) href: String,
    pub(super) calendar_data: Vec<String>,
    pub(super) is_calendar: bool,
    pub(super) principal: Option<String>,
    pub(super) home: Option<String>,
}

pub(super) fn parse_multistatus(xml: &str) -> Vec<DavResponse> {
    let mut reader = Reader::from_str(xml);
    let mut responses = Vec::new();
    let mut stack: Vec<String> = Vec::new();
    let mut current: Option<DavResponse> = None;
    let mut text = String::new();
    loop {
        let event = match reader.read_event() {
            Ok(Event::Eof) | Err(_) => break,
            Ok(event) => event,
        };
        match event {
            Event::Start(start) => {
                let name = String::from_utf8_lossy(start.local_name().as_ref()).to_ascii_lowercase();
                if name == "response" {
                    current = Some(DavResponse::default());
                }
                stack.push(name);
                text.clear();
            }
            Event::Empty(empty) => {
                let name = String::from_utf8_lossy(empty.local_name().as_ref()).to_ascii_lowercase();
                if let Some(response) = current.as_mut().filter(|_| name == "calendar" && stack.iter().any(|open| open == "resourcetype")) {
                    response.is_calendar = true;
                }
            }
            Event::Text(content) => text.push_str(&content.xml_content().unwrap_or_default()),
            Event::CData(content) => text.push_str(&String::from_utf8_lossy(&content)),
            Event::GeneralRef(reference) => {
                let name = String::from_utf8_lossy(&reference).to_string();
                text.push_str(match name.as_str() {
                    "lt" => "<",
                    "gt" => ">",
                    "amp" => "&",
                    "quot" => "\"",
                    "apos" => "'",
                    _ => "",
                });
                if let Some(code) = name.strip_prefix('#') {
                    let value = code.strip_prefix('x').map_or_else(|| code.parse().ok(), |hex| u32::from_str_radix(hex, 16).ok());
                    text.extend(value.and_then(char::from_u32));
                }
            }
            Event::End(_) => {
                let name = stack.pop().unwrap_or_default();
                let parent = stack.last().map(String::as_str);
                if let Some(response) = current.as_mut() {
                    match (name.as_str(), parent) {
                        ("href", Some("response")) => response.href = text.trim().to_string(),
                        ("href", _) if stack.iter().any(|open| open == "current-user-principal") => response.principal = Some(text.trim().to_string()),
                        ("href", _) if stack.iter().any(|open| open == "calendar-home-set") => response.home = Some(text.trim().to_string()),
                        ("calendar-data", _) => response.calendar_data.push(text.clone()),
                        ("calendar", _) if stack.iter().any(|open| open == "resourcetype") => response.is_calendar = true,
                        _ => {}
                    }
                }
                if name == "response" {
                    responses.extend(current.take());
                }
                text.clear();
            }
            _ => {}
        }
    }
    responses
}

fn client() -> Result<reqwest::Client, UserError> {
    let mut builder = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::none())
        .user_agent(concat!("Fuyu/", env!("CARGO_PKG_VERSION")));
    if let Some(proxy) = reqwest_proxy()? {
        builder = builder.proxy(proxy);
    }
    builder.build().map_err(|error| super::http_error("http.client", "Could not set up the connection.", error))
}

pub(super) struct Account<'a> {
    pub(super) url: &'a str,
    pub(super) username: &'a str,
    pub(super) password: &'a str,
}

#[derive(Debug, Default, Clone)]
pub(super) struct Reply {
    pub(super) status: u16,
    pub(super) location: Option<String>,
    pub(super) body: String,
}

pub(super) trait Transport {
    async fn send(&self, method: &str, url: &Url, depth: &str, body: &str) -> Result<Reply, UserError>;
}

struct Http<'a> {
    client: reqwest::Client,
    account: &'a Account<'a>,
}

impl Transport for Http<'_> {
    async fn send(&self, method: &str, url: &Url, depth: &str, body: &str) -> Result<Reply, UserError> {
        let method = Method::from_bytes(method.as_bytes()).map_err(|error| UserError::new("internal", "Something went wrong inside the island.").detail(error))?;
        let response = self
            .client
            .request(method, url.clone())
            .basic_auth(self.account.username, Some(self.account.password))
            .header("Depth", depth)
            .header("Content-Type", "application/xml; charset=utf-8")
            .body(body.to_string())
            .send()
            .await
            .map_err(|error| super::http_error("calendar.unreachable", "Could not reach the calendar.", error))?;
        let status = response.status().as_u16();
        let location = response.headers().get(reqwest::header::LOCATION).and_then(|value| value.to_str().ok()).map(str::to_string);
        if !(200..300).contains(&status) {
            return Ok(Reply { status, location, body: String::new() });
        }
        let bytes = response.bytes().await.map_err(|error| super::http_error("calendar.read", "Could not read the calendar.", error))?;
        if bytes.len() > MAX_RESPONSE_BYTES {
            return Err(UserError::new("calendar.tooLarge", "The calendar is too large."));
        }
        Ok(Reply { status, location, body: String::from_utf8_lossy(&super::ungzip(&bytes)?).to_string() })
    }
}

struct Answer {
    url: Url,
    status: u16,
    body: String,
}

fn redirect_target(from: &Url, reply: &Reply) -> Option<Url> {
    if !matches!(reply.status, 301 | 302 | 303 | 307 | 308) {
        return None;
    }
    let next = from.join(reply.location.as_deref()?.trim()).ok()?;
    let same_origin = next.scheme() == "https" && next.host_str() == from.host_str() && next.port_or_known_default() == from.port_or_known_default();
    same_origin.then_some(next)
}

async fn follow<T: Transport>(transport: &T, method: &str, url: &Url, depth: &str, body: &str) -> Result<Answer, UserError> {
    let mut url = url.clone();
    let mut hops = 0;
    loop {
        let reply = transport.send(method, &url, depth, body).await?;
        match redirect_target(&url, &reply).filter(|_| hops < MAX_REDIRECTS) {
            Some(next) => {
                url = next;
                hops += 1;
            }
            None => return Ok(Answer { url, status: reply.status, body: reply.body }),
        }
    }
}

fn checked(answer: Answer) -> Result<Answer, UserError> {
    match answer.status {
        401 | 403 => Err(UserError::new("calendar.login", "The calendar account or password is wrong.")),
        status if !(200..300).contains(&status) => Err(UserError::new("calendar.status", format!("The calendar answered {status}.")).arg("status", status)),
        _ => Ok(answer),
    }
}

async fn dav<T: Transport>(transport: &T, method: &str, url: &Url, depth: &str, body: &str) -> Result<Answer, UserError> {
    checked(follow(transport, method, url, depth, body).await?)
}

fn utc_stamp(at: DateTime<Utc>) -> String {
    at.format("%Y%m%dT%H%M%SZ").to_string()
}

pub(super) fn calendar_query(from: DateTime<Utc>, to: DateTime<Utc>) -> String {
    format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><c:calendar-data/></d:prop>
  <c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT">
    <c:time-range start="{}" end="{}"/>
  </c:comp-filter></c:comp-filter></c:filter>
</c:calendar-query>"#,
        utc_stamp(from),
        utc_stamp(to)
    )
}

pub(super) const PROPFIND_DISCOVERY: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop><d:current-user-principal/><c:calendar-home-set/><d:resourcetype/></d:prop>
</d:propfind>"#;

fn join(base: &Url, href: &str) -> Result<Url, UserError> {
    base.join(href).map_err(|error| UserError::new("calendar.address", "The calendar address is not valid.").detail(error))
}

fn not_calendar() -> UserError {
    UserError::new("calendar.notCalendar", "This address is not a calendar, and no calendars were found for the account.")
}

fn leads_somewhere(responses: &[DavResponse]) -> bool {
    responses.iter().any(|response| response.is_calendar || response.home.is_some() || response.principal.is_some())
}

enum Probe {
    Found(Url, Vec<DavResponse>),
    Refused(UserError),
    Missed(Option<UserError>),
}

async fn probe<T: Transport>(transport: &T, url: &Url) -> Result<Probe, UserError> {
    let answer = follow(transport, "PROPFIND", url, "0", PROPFIND_DISCOVERY).await?;
    let status = answer.status;
    Ok(match checked(answer) {
        Ok(answer) => {
            let found = parse_multistatus(&answer.body);
            if leads_somewhere(&found) {
                Probe::Found(answer.url, found)
            } else {
                Probe::Missed(None)
            }
        }
        Err(error) if matches!(status, 401 | 403) => Probe::Refused(error),
        Err(error) => Probe::Missed(Some(error)),
    })
}

async fn entry_point<T: Transport>(transport: &T, base: &Url) -> Result<(Url, Vec<DavResponse>), UserError> {
    let typed_error = match probe(transport, base).await? {
        Probe::Found(at, found) => return Ok((at, found)),
        Probe::Refused(error) => return Err(error),
        Probe::Missed(error) => error,
    };
    let well_known = join(base, "/.well-known/caldav")?;
    if well_known != *base {
        match probe(transport, &well_known).await? {
            Probe::Found(at, found) => return Ok((at, found)),
            Probe::Refused(error) => return Err(error),
            Probe::Missed(_) => {}
        }
    }
    Err(typed_error.unwrap_or_else(not_calendar))
}

pub(super) async fn calendars<T: Transport>(transport: &T, base: &Url) -> Result<Vec<Url>, UserError> {
    let (at, answer) = entry_point(transport, base).await?;
    if answer.iter().any(|response| response.is_calendar) {
        return Ok(vec![at]);
    }
    let home = match answer.iter().find_map(|response| response.home.clone()) {
        Some(home) => join(&at, &home)?,
        None => {
            let principal = answer.iter().find_map(|response| response.principal.clone()).ok_or_else(not_calendar)?;
            let principal = dav(transport, "PROPFIND", &join(&at, &principal)?, "0", PROPFIND_DISCOVERY).await?;
            let found = parse_multistatus(&principal.body);
            join(&principal.url, &found.iter().find_map(|response| response.home.clone()).ok_or_else(|| UserError::new("calendar.noCalendars", "No calendars were found for the account."))?)?
        }
    };
    let listed = dav(transport, "PROPFIND", &home, "1", PROPFIND_DISCOVERY).await?;
    let found = parse_multistatus(&listed.body);
    found.iter().filter(|response| response.is_calendar).take(MAX_CALENDARS).map(|response| join(&listed.url, &response.href)).collect()
}

const PROPFIND_ITEMS: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<d:propfind xmlns:d="DAV:"><d:prop><d:getetag/><d:resourcetype/></d:prop></d:propfind>"#;

fn escape_xml(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}

pub(super) fn calendar_multiget(hrefs: &[String]) -> String {
    let hrefs: String = hrefs.iter().map(|href| format!("<d:href>{}</d:href>", escape_xml(href))).collect();
    format!(
        r#"<?xml version="1.0" encoding="utf-8"?>
<c:calendar-multiget xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop>{hrefs}</c:calendar-multiget>"#
    )
}

async fn item_hrefs<T: Transport>(transport: &T, calendar: &Url) -> Result<Vec<String>, UserError> {
    let listed = dav(transport, "PROPFIND", calendar, "1", PROPFIND_ITEMS).await?;
    let mut items = Vec::new();
    for response in parse_multistatus(&listed.body).into_iter().filter(|response| !response.is_calendar) {
        let url = join(&listed.url, &response.href)?;
        if url.path() != calendar.path() && url.path() != listed.url.path() && !url.path().ends_with('/') {
            items.push(response.href);
        }
    }
    items.truncate(MAX_ITEMS);
    Ok(items)
}

async fn read_items<T: Transport>(transport: &T, calendar: &Url) -> Result<Vec<String>, UserError> {
    let items = item_hrefs(transport, calendar).await?;
    let mut texts = Vec::new();
    for batch in items.chunks(MULTIGET_BATCH) {
        let answer = dav(transport, "REPORT", calendar, "1", &calendar_multiget(batch)).await?;
        texts.extend(parse_multistatus(&answer.body).into_iter().flat_map(|response| response.calendar_data));
    }
    Ok(texts)
}

async fn calendar_events<T: Transport>(transport: &T, calendar: &Url, from: DateTime<Utc>, to: DateTime<Utc>) -> Result<Vec<String>, UserError> {
    let answer = follow(transport, "REPORT", calendar, "1", &calendar_query(from, to)).await?;
    if matches!(answer.status, 401 | 403) || (200..300).contains(&answer.status) {
        return Ok(parse_multistatus(&checked(answer)?.body).into_iter().flat_map(|response| response.calendar_data).collect());
    }
    let refused = checked(answer).err();
    read_items(transport, calendar).await.map_err(|error| refused.unwrap_or(error))
}

pub(super) async fn events<T: Transport>(transport: &T, base: &Url, from: DateTime<Utc>, to: DateTime<Utc>) -> Result<Vec<String>, UserError> {
    let mut texts = Vec::new();
    for calendar in calendars(transport, base).await? {
        texts.extend(calendar_events(transport, &calendar, from, to).await?);
    }
    Ok(texts)
}

pub(super) async fn fetch(account: &Account<'_>, from: DateTime<Utc>, to: DateTime<Utc>) -> Result<Vec<String>, UserError> {
    let base = Url::parse(account.url.trim()).map_err(|_| UserError::new("calendar.address", "The calendar address is not valid."))?;
    if base.scheme() != "https" {
        return Err(UserError::new("calendar.https", "The calendar address must start with https://."));
    }
    events(&Http { client: client()?, account }, &base, from, to).await.map_err(|error| error.redact(base.as_str()).redact(account.url.trim()))
}

#[cfg(test)]
#[path = "caldav_tests.rs"]
mod discovery_tests;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn multistatus_answers_are_read_whatever_the_prefixes() {
        let report = r#"<?xml version="1.0"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:response><D:href>/cal/a.ics</D:href><D:propstat><D:prop>
    <C:calendar-data>BEGIN:VCALENDAR&#13;
SUMMARY:A &amp; B
END:VCALENDAR</C:calendar-data></D:prop></D:propstat></D:response>
  <D:response><D:href>/cal/b.ics</D:href><D:propstat><D:prop><C:calendar-data><![CDATA[BEGIN:VCALENDAR]]></C:calendar-data></D:prop></D:propstat></D:response>
</D:multistatus>"#;
        let responses = parse_multistatus(report);
        assert_eq!(responses.len(), 2);
        assert_eq!(responses[0].href, "/cal/a.ics");
        assert_eq!(responses[0].calendar_data, ["BEGIN:VCALENDAR\r\nSUMMARY:A & B\nEND:VCALENDAR"]);
        assert_eq!(responses[1].calendar_data, ["BEGIN:VCALENDAR"]);

        let discovery = r#"<multistatus xmlns="DAV:"><response><href>/</href><propstat><prop>
          <current-user-principal><href>/principals/u1/</href></current-user-principal>
          <calendar-home-set xmlns="urn:ietf:params:xml:ns:caldav"><href>/calendars/u1/</href></calendar-home-set>
          <resourcetype><collection/></resourcetype></prop></propstat></response></multistatus>"#;
        let found = parse_multistatus(discovery);
        assert_eq!((found[0].principal.as_deref(), found[0].home.as_deref(), found[0].is_calendar), (Some("/principals/u1/"), Some("/calendars/u1/"), false));

        let listing = r#"<d:multistatus xmlns:d="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
          <d:response><d:href>/calendars/u1/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat></d:response>
          <d:response><d:href>/calendars/u1/work/</d:href><d:propstat><d:prop><d:resourcetype><d:collection/><cal:calendar/></d:resourcetype></d:prop></d:propstat></d:response>
        </d:multistatus>"#;
        let calendars: Vec<String> = parse_multistatus(listing).into_iter().filter(|response| response.is_calendar).map(|response| response.href).collect();
        assert_eq!(calendars, ["/calendars/u1/work/"]);
        assert!(parse_multistatus("not xml").is_empty());
    }

    #[test]
    fn the_query_asks_for_events_in_the_range() {
        use chrono::TimeZone;
        let query = calendar_query(Utc.with_ymd_and_hms(2026, 11, 6, 16, 0, 0).unwrap(), Utc.with_ymd_and_hms(2026, 11, 8, 16, 0, 0).unwrap());
        assert!(query.contains(r#"<c:time-range start="20261106T160000Z" end="20261108T160000Z"/>"#));
    }
}
