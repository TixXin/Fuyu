use std::{
    io::{BufRead, BufReader, Read, Write},
    time::Duration,
};

use base64::Engine;
use lettre::Message;

use super::net_error::{handshake_error, or_classified, Endpoint, Stage};
use crate::user_error::UserError;

const SMTPS_PORT: u16 = 465;
const SMTP_TIMEOUT: Duration = Duration::from_secs(30);

pub(super) fn deliver(host: &str, port: u16, email: &str, secret: &str, message: &Message) -> Result<(), UserError> {
    let connected = crate::system::proxy::connect_tcp_traced(host, port, SMTP_TIMEOUT).map_err(|error| {
        let fallback = UserError::new("mail.sendFailed", "Sending failed; check the network and try again.");
        or_classified(Stage::Connect, &error, &Endpoint { host, port, proxy: None }, fallback)
    })?;
    let endpoint = Endpoint { host, port, proxy: connected.proxy.as_deref() };
    let stream = connected.stream;
    let _ = stream.set_read_timeout(Some(SMTP_TIMEOUT));
    let _ = stream.set_write_timeout(Some(SMTP_TIMEOUT));
    let connector = native_tls::TlsConnector::new()
        .map_err(|error| UserError::new("mail.tls", "Could not set up an encrypted connection.").detail(error))?;
    if port == SMTPS_PORT {
        let mut tls_stream = connector.connect(host, stream).map_err(|error| handshake_error(error, &endpoint))?;
        send_over_stream(&mut tls_stream, email, secret, message)
    } else {
        let mut plain = stream;
        let greeting = read_reply(&mut plain)?;
        expect_code(&greeting, 220)?;
        let ehlo = send_command(&mut plain, "EHLO localhost")?;
        expect_code(&ehlo, 250)?;
        let starttls = send_command(&mut plain, "STARTTLS")?;
        expect_code(&starttls, 220)?;
        let mut tls_stream = connector.connect(host, plain).map_err(|error| handshake_error(error, &endpoint))?;
        send_after_tls(&mut tls_stream, email, secret, message)
    }
}

fn send_over_stream<S: Read + Write>(stream: &mut S, email: &str, secret: &str, message: &Message) -> Result<(), UserError> {
    let greeting = read_reply(stream)?;
    expect_code(&greeting, 220)?;
    send_after_tls(stream, email, secret, message)
}

fn send_after_tls<S: Read + Write>(stream: &mut S, email: &str, secret: &str, message: &Message) -> Result<(), UserError> {
    let ehlo = send_command(stream, "EHLO localhost")?;
    expect_code(&ehlo, 250)?;
    authenticate(stream, &ehlo.lines, email, secret)?;

    let envelope = message.envelope();
    let from = envelope
        .from()
        .map(AsRef::<str>::as_ref)
        .unwrap_or(email);
    let mail_from = send_command(stream, &format!("MAIL FROM:<{from}>"))?;
    expect_code(&mail_from, 250)?;

    for recipient in envelope.to() {
        let rcpt = send_command(stream, &format!("RCPT TO:<{}>", AsRef::<str>::as_ref(recipient)))?;
        if rcpt.code != 250 && rcpt.code != 251 {
            return Err(smtp_error(rcpt.code, &rcpt.text));
        }
    }

    let data = send_command(stream, "DATA")?;
    expect_code(&data, 354)?;
    write_dot_stuffed(stream, &message.formatted())?;
    let finished = read_reply(stream)?;
    expect_code(&finished, 250)?;
    let _ = send_command(stream, "QUIT");
    Ok(())
}

fn authenticate<S: Read + Write>(stream: &mut S, capabilities: &[String], email: &str, secret: &str) -> Result<(), UserError> {
    let prefers_plain = capabilities.iter().any(|line| {
        let upper = line.to_ascii_uppercase();
        upper.contains("AUTH") && upper.contains("PLAIN")
    });
    if prefers_plain {
        let token = base64::engine::general_purpose::STANDARD.encode(format!("\0{email}\0{secret}"));
        let reply = send_command(stream, &format!("AUTH PLAIN {token}"))?;
        if reply.code == 235 {
            return Ok(());
        }
        return Err(smtp_error(reply.code, &reply.text));
    }
    let start = send_command(stream, "AUTH LOGIN")?;
    expect_code(&start, 334)?;
    let user_reply = send_command(stream, &base64::engine::general_purpose::STANDARD.encode(email))?;
    expect_code(&user_reply, 334)?;
    let pass_reply = send_command(stream, &base64::engine::general_purpose::STANDARD.encode(secret))?;
    if pass_reply.code == 235 {
        Ok(())
    } else {
        Err(smtp_error(pass_reply.code, &pass_reply.text))
    }
}

fn write_dot_stuffed<S: Write>(stream: &mut S, raw: &[u8]) -> Result<(), UserError> {
    let mut out = Vec::with_capacity(raw.len() + 16);
    let mut at_line_start = true;
    for &byte in raw {
        if at_line_start && byte == b'.' {
            out.push(b'.');
        }
        out.push(byte);
        at_line_start = byte == b'\n';
    }
    if !out.ends_with(b"\r\n") {
        out.extend_from_slice(b"\r\n");
    }
    out.extend_from_slice(b".\r\n");
    stream
        .write_all(&out)
        .and_then(|()| stream.flush())
        .map_err(|error| UserError::new("mail.sendFailed", "Sending failed; check the network and try again.").detail(error))
}

struct SmtpReply {
    code: u16,
    text: String,
    lines: Vec<String>,
}

fn send_command<S: Read + Write>(stream: &mut S, command: &str) -> Result<SmtpReply, UserError> {
    stream
        .write_all(format!("{command}\r\n").as_bytes())
        .and_then(|()| stream.flush())
        .map_err(|error| UserError::new("mail.sendFailed", "Sending failed; check the network and try again.").detail(error))?;
    read_reply(stream)
}

fn read_reply<S: Read>(stream: &mut S) -> Result<SmtpReply, UserError> {
    let mut reader = BufReader::new(stream);
    let mut lines = Vec::new();
    let mut code = 0u16;
    loop {
        let mut line = String::new();
        let read = reader
            .read_line(&mut line)
            .map_err(|error| UserError::new("mail.sendFailed", "Sending failed; check the network and try again.").detail(error))?;
        if read == 0 {
            return Err(UserError::new("mail.sendFailed", "Sending failed; check the network and try again.")
                .detail("SMTP server closed connection"));
        }
        let trimmed = line.trim_end_matches(['\r', '\n']).to_string();
        if trimmed.len() >= 3 {
            if let Ok(parsed) = trimmed[..3].parse::<u16>() {
                code = parsed;
            }
        }
        let continues = trimmed.as_bytes().get(3) == Some(&b'-');
        lines.push(trimmed);
        if !continues {
            break;
        }
    }
    let text = lines.join("\n");
    Ok(SmtpReply { code, text, lines })
}

fn expect_code(reply: &SmtpReply, expected: u16) -> Result<(), UserError> {
    if reply.code == expected {
        Ok(())
    } else {
        Err(smtp_error(reply.code, &reply.text))
    }
}

fn smtp_error(code: u16, detail: &str) -> UserError {
    if code >= 500 || code == 535 {
        UserError::new(
            "mail.smtpRefused",
            "The mail server refused the sign-in or the mail; check that SMTP is on, the authorization code and the recipients.",
        )
    } else {
        UserError::new("mail.sendFailed", "Sending failed; check the network and try again.").detail(detail)
    }
}

#[cfg(test)]
mod tests {
    use std::{
        io::{BufRead, BufReader, Write},
        net::{TcpListener, TcpStream},
        thread,
    };

    use lettre::{message::header::ContentType, Message};

    use super::send_over_stream;

    #[test]
    fn sends_message_with_auth_plain_and_dot_stuffing() {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let server = thread::spawn(move || {
            let (socket, _) = listener.accept().unwrap();
            let mut writer = socket.try_clone().unwrap();
            let mut reader = BufReader::new(socket);
            let mut line = String::new();
            writer.write_all(b"220 smtp.example.com ESMTP\r\n").unwrap();

            line.clear();
            reader.read_line(&mut line).unwrap();
            assert_eq!(line, "EHLO localhost\r\n");
            writer.write_all(b"250-smtp.example.com\r\n250 AUTH PLAIN LOGIN\r\n").unwrap();

            line.clear();
            reader.read_line(&mut line).unwrap();
            assert!(line.starts_with("AUTH PLAIN "));
            writer.write_all(b"235 Authentication succeeded\r\n").unwrap();

            line.clear();
            reader.read_line(&mut line).unwrap();
            assert_eq!(line, "MAIL FROM:<me@example.com>\r\n");
            writer.write_all(b"250 OK\r\n").unwrap();

            line.clear();
            reader.read_line(&mut line).unwrap();
            assert_eq!(line, "RCPT TO:<you@example.com>\r\n");
            writer.write_all(b"250 OK\r\n").unwrap();

            line.clear();
            reader.read_line(&mut line).unwrap();
            assert_eq!(line, "DATA\r\n");
            writer.write_all(b"354 End data with <CR><LF>.<CR><LF>\r\n").unwrap();

            let mut body = String::new();
            loop {
                line.clear();
                reader.read_line(&mut line).unwrap();
                if line == ".\r\n" {
                    break;
                }
                body.push_str(&line);
            }
            assert!(body.contains("..leading dot"));
            writer.write_all(b"250 Queued\r\n").unwrap();

            line.clear();
            let _ = reader.read_line(&mut line);
            let _ = writer.write_all(b"221 Bye\r\n");
        });

        let message = Message::builder()
            .from("me@example.com".parse().unwrap())
            .to("you@example.com".parse().unwrap())
            .subject("Proxy test")
            .header(ContentType::TEXT_PLAIN)
            .body(".leading dot\nhello".to_string())
            .unwrap();
        let mut client = TcpStream::connect(addr).unwrap();
        send_over_stream(&mut client, "me@example.com", "secret", &message).unwrap();
        server.join().unwrap();
    }
}
