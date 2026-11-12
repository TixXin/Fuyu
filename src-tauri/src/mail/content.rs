use crate::user_error::UserError;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use imap::{
    types::{Fetch, Fetches},
    Session,
};
use imap_proto::types::{
    BodyContentCommon, BodyStructure, ContentEncoding, MessageSection, SectionPath,
};
use std::io::{Read, Write};

use super::MailContent;

pub(super) const MAX_BODY_BYTES: u32 = 512 * 1024;

const MAX_MIME_BYTES: usize = 65_536;

const MAX_INLINE_IMAGES: usize = 8;

const MAX_INLINE_IMAGE_BYTES: u32 = 512 * 1024;

const MAX_INLINE_TOTAL_BYTES: u32 = 1_536 * 1024;

pub(super) fn parse_message_id(message_id: &str) -> Result<(u32, u32), UserError> {
    let parsed = message_id.split_once(':').and_then(|(validity, uid)| {
        if !validity.bytes().all(|byte| byte.is_ascii_digit())
            || !uid.bytes().all(|byte| byte.is_ascii_digit())
        {
            return None;
        }
        Some((validity.parse::<u32>().ok()?, uid.parse::<u32>().ok()?))
    });
    parsed
        .filter(|(validity, uid)| *validity > 0 && *uid > 0)
        .ok_or_else(|| UserError::new("mail.badId", "The mail id is not valid; refresh the inbox."))
}

struct TextPart {
    path: Vec<u32>,
    mime: &'static str,
    octets: u32,
}

pub(super) fn is_attachment(common: &BodyContentCommon<'_>) -> bool {
    common.disposition.as_ref().is_some_and(|disposition| {
        !disposition.ty.eq_ignore_ascii_case("inline")
            || disposition.params.as_ref().is_some_and(|params| {
                params
                    .iter()
                    .any(|(key, _)| key.eq_ignore_ascii_case("filename"))
            })
    }) || common.ty.params.as_ref().is_some_and(|params| {
        params
            .iter()
            .any(|(key, _)| key.eq_ignore_ascii_case("name"))
    })
}

fn text_part(body: &BodyStructure<'_>, path: Vec<u32>) -> Option<TextPart> {
    if path.len() > 16 {
        return None;
    }
    match body {
        BodyStructure::Text { common, other, .. } if !is_attachment(common) => {
            let mime = if common.ty.subtype.eq_ignore_ascii_case("plain") {
                "text/plain"
            } else if common.ty.subtype.eq_ignore_ascii_case("html") {
                "text/html"
            } else {
                return None;
            };
            Some(TextPart {
                path: if path.is_empty() { vec![1] } else { path },
                mime,
                octets: other.octets,
            })
        }
        BodyStructure::Multipart { common, bodies, .. } if !is_attachment(common) => {
            let mut fallback = None;
            for (index, body) in bodies.iter().take(128).enumerate() {
                let mut nested = path.clone();
                nested.push(index as u32 + 1);
                if let Some(part) = text_part(body, nested) {
                    if part.mime == "text/html" {
                        return Some(part);
                    }
                    if fallback.is_none() {
                        fallback = Some(part);
                    }
                }
            }
            fallback
        }
        _ => None,
    }
}

struct InlineImage {
    path: Vec<u32>,
    content_id: String,
    mime: String,
    octets: u32,
    base64: bool,
    quoted_printable: bool,
}

fn cid_token_end(html: &str, start: usize) -> usize {
    html[start..]
        .find(|character: char| {
            character.is_whitespace()
                || matches!(character, '"' | '\'' | ')' | '(' | '<' | '>' | '?')
        })
        .map_or(html.len(), |offset| start + offset)
}

pub(super) fn cid_references(html: &str) -> Vec<String> {
    let lower = html.to_ascii_lowercase();
    let mut ids: Vec<String> = Vec::new();
    let mut cursor = 0;
    while let Some(found) = lower[cursor..].find("cid:") {
        let start = cursor + found + 4;
        let end = cid_token_end(&lower, start);
        let id = html[start..end]
            .trim()
            .trim_matches(|character| character == '<' || character == '>');
        if !id.is_empty() && !ids.iter().any(|known| known.eq_ignore_ascii_case(id)) {
            ids.push(id.to_string());
        }
        cursor = end.max(start);
    }
    ids
}

fn collect_inline_images(
    body: &BodyStructure<'_>,
    path: Vec<u32>,
    ids: &[String],
    out: &mut Vec<InlineImage>,
) {
    if out.len() >= MAX_INLINE_IMAGES || path.len() > 16 {
        return;
    }
    match body {
        BodyStructure::Basic { common, other, .. }
            if common.ty.ty.eq_ignore_ascii_case("image") =>
        {
            let Some(id) = other
                .id
                .as_deref()
                .map(|id| id.trim_matches(|character| character == '<' || character == '>'))
            else {
                return;
            };
            if id.is_empty() || other.octets == 0 || other.octets > MAX_INLINE_IMAGE_BYTES {
                return;
            }
            let Some(matched) = ids.iter().find(|wanted| wanted.eq_ignore_ascii_case(id)) else {
                return;
            };
            out.push(InlineImage {
                path: if path.is_empty() { vec![1] } else { path },
                content_id: matched.clone(),
                mime: format!("image/{}", common.ty.subtype.to_ascii_lowercase()),
                octets: other.octets,
                base64: matches!(other.transfer_encoding, ContentEncoding::Base64),
                quoted_printable: matches!(
                    other.transfer_encoding,
                    ContentEncoding::QuotedPrintable
                ),
            });
        }
        BodyStructure::Multipart { bodies, .. } => {
            for (index, nested) in bodies.iter().take(128).enumerate() {
                let mut nested_path = path.clone();
                nested_path.push(index as u32 + 1);
                collect_inline_images(nested, nested_path, ids, out);
            }
        }
        _ => {}
    }
}

pub(super) fn replace_cid_references(html: &str, replacements: &[(String, String)]) -> String {
    let lower = html.to_ascii_lowercase();
    let mut out = String::with_capacity(html.len());
    let mut cursor = 0;
    while let Some(found) = lower[cursor..].find("cid:") {
        let reference_start = cursor + found;
        let token_start = reference_start + 4;
        let token_end = cid_token_end(&lower, token_start);
        out.push_str(&html[cursor..reference_start]);
        match replacements
            .iter()
            .find(|(content_id, _)| content_id.eq_ignore_ascii_case(&html[token_start..token_end]))
        {
            Some((_, data_uri)) => out.push_str(data_uri),
            None => out.push_str(&html[reference_start..token_end]),
        }
        cursor = token_end;
    }
    out.push_str(&html[cursor..]);
    out
}

fn responses_for_message(messages: &Fetches, uid: u32) -> Vec<&Fetch<'_>> {
    let (mut mine, others): (Vec<&Fetch<'_>>, Vec<&Fetch<'_>>) =
        messages.iter().partition(|item| item.uid == Some(uid));
    mine.extend(others);
    mine
}

fn inline_cid_images<T: Read + Write>(
    session: &mut Session<T>,
    uid: u32,
    structure: &BodyStructure<'_>,
    html: String,
) -> String {
    let ids = cid_references(&html);
    if ids.is_empty() {
        return html;
    }
    let mut images = Vec::new();
    collect_inline_images(structure, Vec::new(), &ids, &mut images);
    if images.is_empty() {
        return html;
    }
    let query = format!(
        "(UID {})",
        images
            .iter()
            .map(|image| {
                let section = image
                    .path
                    .iter()
                    .map(u32::to_string)
                    .collect::<Vec<_>>()
                    .join(".");
                format!("BODY.PEEK[{section}]")
            })
            .collect::<Vec<_>>()
            .join(" ")
    );
    let Ok(messages) = session.uid_fetch(uid.to_string(), &query) else {
        return html;
    };
    let responses = responses_for_message(&messages, uid);
    if responses.is_empty() {
        return html;
    }
    let mut replacements: Vec<(String, String)> = Vec::new();
    let mut budget = MAX_INLINE_TOTAL_BYTES;
    for image in &images {
        if image.quoted_printable {
            continue;
        }
        let path = SectionPath::Part(image.path.clone(), None);
        let retry;
        let bytes = match responses.iter().find_map(|item| item.section(&path)) {
            Some(bytes) => Some(bytes),
            None => {
                let section = image
                    .path
                    .iter()
                    .map(u32::to_string)
                    .collect::<Vec<_>>()
                    .join(".");
                retry = session
                    .uid_fetch(uid.to_string(), format!("(UID BODY.PEEK[{section}])"))
                    .ok();
                retry
                    .as_ref()
                    .and_then(|items| items.iter().find_map(|item| item.section(&path)))
            }
        };
        let Some(bytes) = bytes else {
            continue;
        };
        if bytes.len() < image.octets as usize {
            continue;
        }
        let payload = if image.base64 {
            let encoded = bytes
                .iter()
                .copied()
                .filter(|byte| !byte.is_ascii_whitespace())
                .collect::<Vec<u8>>();
            String::from_utf8(encoded).ok()
        } else {
            Some(BASE64.encode(bytes))
        };
        let Some(payload) = payload else {
            continue;
        };
        if payload.len() as u32 > budget {
            continue;
        }
        budget -= payload.len() as u32;
        replacements.push((
            image.content_id.clone(),
            format!("data:{};base64,{payload}", image.mime),
        ));
    }
    replace_cid_references(&html, &replacements)
}

pub(super) fn fetch_content<T: Read + Write>(
    session: &mut Session<T>,
    message_id: &str,
) -> Result<MailContent, UserError> {
    let (validity, uid) = parse_message_id(message_id)?;
    let mailbox = session
        .examine("INBOX")
        .map_err(|_| UserError::new("mail.inbox", "Could not open the inbox; try again later."))?;
    if mailbox.uid_validity != Some(validity) {
        return Err(UserError::new("mail.inboxChangedOpen", "The inbox changed; refresh the list and open the mail again."));
    }
    let structures = session
        .uid_fetch(uid.to_string(), "(UID BODYSTRUCTURE)")
        .map_err(|_| UserError::new("mail.structure", "Could not read the mail's structure; try again later."))?;
    let structure = structures
        .iter()
        .filter(|item| item.uid == Some(uid))
        .find_map(|item| item.bodystructure())
        .ok_or_else(|| UserError::new("mail.unavailable", "The mail was removed or is not available; refresh the inbox."))?;
    let mut attachments = Vec::new();
    super::attachments::collect(structure, Vec::new(), &mut attachments);
    let Some(part) = text_part(structure, Vec::new()) else {
        if attachments.is_empty() {
            return Err(UserError::new("mail.noText", "This mail has no text to read; open it in the web mail."));
        }
        return Ok(MailContent { id: message_id.into(), content: String::new(), content_type: "text/plain".into(), attachments });
    };
    if part.octets > MAX_BODY_BYTES {
        return Err(UserError::new("mail.bodyOver", "The mail body is over 512 KB; open it in the web mail."));
    }
    let section = part
        .path
        .iter()
        .map(u32::to_string)
        .collect::<Vec<_>>()
        .join(".");
    let multipart = matches!(structure, BodyStructure::Multipart { .. });
    let mime_path = SectionPath::Part(part.path.clone(), Some(MessageSection::Mime));
    let body_path = SectionPath::Part(part.path, None);
    let header_query = if multipart {
        format!("BODY.PEEK[{section}.MIME]")
    } else {
        "BODY.PEEK[HEADER]".to_string()
    };
    let query = format!("(UID {header_query} BODY.PEEK[{section}])");
    let messages = session
        .uid_fetch(uid.to_string(), query)
        .map_err(|_| UserError::new("mail.bodyLoad", "Could not load the mail body; check the network and try again."))?;
    let mut header = None;
    let mut body = None;
    for item in responses_for_message(&messages, uid) {
        if header.is_none() {
            header = if multipart {
                item.section(&mime_path)
            } else {
                item.header()
            };
        }
        if body.is_none() {
            body = item.section(&body_path);
        }
    }
    let header = header.ok_or_else(|| UserError::new("mail.removed", "The mail was removed; refresh the inbox."))?;
    let body = body.ok_or_else(|| UserError::new("mail.removed", "The mail was removed; refresh the inbox."))?;
    if header.len() > MAX_MIME_BYTES || body.len() > MAX_BODY_BYTES as usize {
        return Err(UserError::new("mail.bodyLarge", "The mail body is too large; open it in the web mail."));
    }
    if body.len() < part.octets as usize {
        return Err(UserError::new("mail.bodyPartial", "The mail body did not load completely; try again."));
    }
    let mut raw = header.to_vec();
    if !raw.ends_with(b"\r\n\r\n") && !raw.ends_with(b"\n\n") {
        raw.extend_from_slice(b"\r\n\r\n");
    }
    raw.extend_from_slice(body);
    let parsed = mailparse::parse_mail(&raw).map_err(|_| UserError::new("mail.bodyParse", "Could not read the mail body; open it in the web mail."))?;
    if !parsed.ctype.mimetype.eq_ignore_ascii_case(part.mime)
        || parsed.get_content_disposition().disposition == mailparse::DispositionType::Attachment
    {
        return Err(UserError::new("mail.bodyFormat", "The mail body is not in the expected format; open it in the web mail."));
    }
    let content = parsed
        .get_body()
        .map_err(|_| UserError::new("mail.bodyDecode", "Could not decode the mail body; open it in the web mail."))?;
    let content = if part.mime == "text/html" {
        inline_cid_images(session, uid, structure, content)
    } else {
        content
    };
    Ok(MailContent {
        id: message_id.into(),
        content,
        content_type: part.mime.into(),
        attachments,
    })
}
