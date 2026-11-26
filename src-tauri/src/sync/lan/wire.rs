use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::io::{self, Read, Write};

pub(crate) const MAX_FRAME: usize = 16 * 1024 * 1024;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "op", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub(crate) enum Request {
    PairStart { device_id: String, name: String, spake: String },
    PairConfirm { tag: String },
    List { dir: String },
    Read { path: String },
    PushClip { item: serde_json::Value },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct Entry {
    pub(crate) name: String,
    #[serde(default)]
    pub(crate) is_dir: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub(crate) enum Reply {
    PairAnswer { device_id: String, name: String, spake: String, tag: String },
    PairDone,
    Entries { entries: Vec<Entry> },
    Data { bytes: Option<String> },
    Done,
    Refused { reason: String },
}

pub(crate) mod reason {
    pub(crate) const NOT_PAIRING: &str = "notPairing";
    pub(crate) const EXPIRED: &str = "expired";
    pub(crate) const TOO_MANY_TRIES: &str = "tooManyTries";
    pub(crate) const WRONG_CODE: &str = "wrongCode";
    pub(crate) const NOT_PAIRED: &str = "notPaired";
    pub(crate) const BAD_REQUEST: &str = "badRequest";
    pub(crate) const FAILED: &str = "failed";
}

pub(crate) fn encode_bytes(bytes: &[u8]) -> String {
    STANDARD.encode(bytes)
}

pub(crate) fn decode_bytes(text: &str) -> Option<Vec<u8>> {
    STANDARD.decode(text).ok()
}

pub(crate) fn write_frame<W: Write, T: Serialize>(writer: &mut W, value: &T) -> io::Result<()> {
    let body = serde_json::to_vec(value).map_err(io::Error::other)?;
    if body.len() > MAX_FRAME {
        return Err(io::Error::new(io::ErrorKind::InvalidInput, "frame too large"));
    }
    let len = u32::try_from(body.len()).map_err(io::Error::other)?;
    writer.write_all(&len.to_be_bytes())?;
    writer.write_all(&body)?;
    writer.flush()
}

pub(crate) fn read_frame<R: Read, T: DeserializeOwned>(reader: &mut R) -> io::Result<T> {
    let mut head = [0u8; 4];
    reader.read_exact(&mut head)?;
    let len = u32::from_be_bytes(head) as usize;
    if len > MAX_FRAME {
        return Err(io::Error::new(io::ErrorKind::InvalidData, "frame too large"));
    }
    let mut body = vec![0u8; len];
    reader.read_exact(&mut body)?;
    serde_json::from_slice(&body).map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frames_round_trip_and_oversized_or_broken_frames_are_refused() {
        let mut buf = Vec::new();
        let request = Request::PairStart { device_id: "d1".into(), name: "Mac".into(), spake: encode_bytes(b"xyz") };
        write_frame(&mut buf, &request).unwrap();
        write_frame(&mut buf, &Reply::Data { bytes: None }).unwrap();
        let text = String::from_utf8_lossy(&buf[4..]).to_string();
        assert!(text.contains("\"op\":\"pairStart\"") && text.contains("\"deviceId\":\"d1\""), "{text}");
        let mut reader = buf.as_slice();
        assert_eq!(read_frame::<_, Request>(&mut reader).unwrap(), request);
        assert_eq!(read_frame::<_, Reply>(&mut reader).unwrap(), Reply::Data { bytes: None });
        assert!(read_frame::<_, Reply>(&mut reader).is_err());
        let huge = ((MAX_FRAME + 1) as u32).to_be_bytes();
        assert_eq!(read_frame::<_, Reply>(&mut huge.as_slice()).unwrap_err().kind(), io::ErrorKind::InvalidData);
        let junk = [&3u32.to_be_bytes()[..], b"{x}"].concat();
        assert!(read_frame::<_, Reply>(&mut junk.as_slice()).is_err());
        assert_eq!(decode_bytes(&encode_bytes(b"abc")).as_deref(), Some(&b"abc"[..]));
    }
}
