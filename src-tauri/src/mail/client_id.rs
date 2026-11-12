use imap::extensions::idle::SetReadTimeout;
use std::{
    io::{Read, Write},
    sync::{Arc, Mutex, MutexGuard},
    time::Duration,
};

#[derive(Debug)]
pub(super) struct SharedStream<T>(pub(super) Arc<Mutex<T>>);

impl<T> SharedStream<T> {
    fn lock(&self) -> std::io::Result<MutexGuard<'_, T>> {
        self.0
            .lock()
            .map_err(|_| std::io::Error::other("mail stream lock poisoned"))
    }
}

impl<T: Read> Read for SharedStream<T> {
    fn read(&mut self, buffer: &mut [u8]) -> std::io::Result<usize> {
        self.lock()?.read(buffer)
    }
}

impl<T: Write> Write for SharedStream<T> {
    fn write(&mut self, buffer: &[u8]) -> std::io::Result<usize> {
        self.lock()?.write(buffer)
    }

    fn flush(&mut self) -> std::io::Result<()> {
        self.lock()?.flush()
    }
}

impl<T: SetReadTimeout> SetReadTimeout for SharedStream<T> {
    fn set_read_timeout(&mut self, timeout: Option<Duration>) -> imap::Result<()> {
        self.0
            .lock()
            .map_err(|_| imap::Error::ConnectionLost)?
            .set_read_timeout(timeout)
    }
}

const ID_COMMAND: &[u8] =
    b"fly0 ID (\"name\" \"fly-island\" \"version\" \"1.0\" \"vendor\" \"fly-island\")\r\n";
const MAX_LINE: usize = 8_192;

pub(super) fn send_client_id<T: Read + Write>(stream: &Mutex<T>) -> std::io::Result<()> {
    let mut stream = stream
        .lock()
        .map_err(|_| std::io::Error::other("mail stream lock poisoned"))?;
    stream.write_all(ID_COMMAND)?;
    stream.flush()?;
    let mut line = Vec::new();
    let mut byte = [0u8; 1];
    loop {
        if stream.read(&mut byte)? == 0 {
            return Err(std::io::ErrorKind::UnexpectedEof.into());
        }
        line.push(byte[0]);
        if byte[0] == b'\n' {
            if line.starts_with(b"fly0 ") {
                return Ok(());
            }
            line.clear();
        } else if line.len() > MAX_LINE {
            return Err(std::io::ErrorKind::InvalidData.into());
        }
    }
}
