#![allow(dead_code)]

pub(crate) mod client;
pub(crate) mod discovery;
pub(crate) mod host;
pub(crate) mod identity;
pub(crate) mod pairing;
pub(crate) mod peers;
pub(crate) mod server;
pub(crate) mod tls;
pub(crate) mod wire;
#[cfg(test)]
mod tests;
