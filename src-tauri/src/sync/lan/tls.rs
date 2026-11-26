use rustls::{
    client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier},
    crypto::{verify_tls12_signature, verify_tls13_signature, CryptoProvider},
    pki_types::{CertificateDer, PrivateKeyDer, PrivatePkcs8KeyDer, ServerName, UnixTime},
    server::danger::{ClientCertVerified, ClientCertVerifier},
    ClientConfig, CommonState, DigitallySignedStruct, DistinguishedName, Error, ServerConfig, SignatureScheme,
};
use std::sync::Arc;

use super::identity::{fingerprint, Identity};

pub(crate) type Pins = Arc<dyn Fn(&str) -> bool + Send + Sync>;

pub(crate) const SERVER_NAME: &str = "fuyu.local";

pub(crate) struct Pinned {
    pins: Pins,
    provider: Arc<CryptoProvider>,
}

impl std::fmt::Debug for Pinned {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("Pinned")
    }
}

fn provider() -> Arc<CryptoProvider> {
    Arc::new(rustls::crypto::ring::default_provider())
}

impl Pinned {
    fn check(&self, end_entity: &CertificateDer<'_>) -> Result<(), Error> {
        if (self.pins)(&fingerprint(end_entity.as_ref())) {
            Ok(())
        } else {
            Err(Error::General("This device is not paired.".into()))
        }
    }

    fn tls12(&self, message: &[u8], cert: &CertificateDer<'_>, dss: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, Error> {
        verify_tls12_signature(message, cert, dss, &self.provider.signature_verification_algorithms)
    }

    fn tls13(&self, message: &[u8], cert: &CertificateDer<'_>, dss: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, Error> {
        verify_tls13_signature(message, cert, dss, &self.provider.signature_verification_algorithms)
    }

    fn schemes(&self) -> Vec<SignatureScheme> {
        self.provider.signature_verification_algorithms.supported_schemes()
    }
}

impl ServerCertVerifier for Pinned {
    fn verify_server_cert(&self, end_entity: &CertificateDer<'_>, _: &[CertificateDer<'_>], _: &ServerName<'_>, _: &[u8], _: UnixTime) -> Result<ServerCertVerified, Error> {
        self.check(end_entity).map(|()| ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(&self, message: &[u8], cert: &CertificateDer<'_>, dss: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, Error> {
        self.tls12(message, cert, dss)
    }

    fn verify_tls13_signature(&self, message: &[u8], cert: &CertificateDer<'_>, dss: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, Error> {
        self.tls13(message, cert, dss)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.schemes()
    }
}

impl ClientCertVerifier for Pinned {
    fn root_hint_subjects(&self) -> &[DistinguishedName] {
        &[]
    }

    fn verify_client_cert(&self, end_entity: &CertificateDer<'_>, _: &[CertificateDer<'_>], _: UnixTime) -> Result<ClientCertVerified, Error> {
        self.check(end_entity).map(|()| ClientCertVerified::assertion())
    }

    fn verify_tls12_signature(&self, message: &[u8], cert: &CertificateDer<'_>, dss: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, Error> {
        self.tls12(message, cert, dss)
    }

    fn verify_tls13_signature(&self, message: &[u8], cert: &CertificateDer<'_>, dss: &DigitallySignedStruct) -> Result<HandshakeSignatureValid, Error> {
        self.tls13(message, cert, dss)
    }

    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.schemes()
    }
}

fn chain(identity: &Identity) -> (Vec<CertificateDer<'static>>, PrivateKeyDer<'static>) {
    (vec![CertificateDer::from(identity.cert_der.clone())], PrivateKeyDer::Pkcs8(PrivatePkcs8KeyDer::from(identity.key_der.clone())))
}

fn failed(error: Error) -> String {
    format!("Could not set up the encrypted link: {error}")
}

pub(crate) fn server_config(identity: &Identity, pins: Pins) -> Result<Arc<ServerConfig>, String> {
    let provider = provider();
    let verifier = Arc::new(Pinned { pins, provider: provider.clone() });
    let (certs, key) = chain(identity);
    let config = ServerConfig::builder_with_provider(provider)
        .with_protocol_versions(&[&rustls::version::TLS13])
        .map_err(failed)?
        .with_client_cert_verifier(verifier)
        .with_single_cert(certs, key)
        .map_err(failed)?;
    Ok(Arc::new(config))
}

pub(crate) fn client_config(identity: &Identity, pins: Pins) -> Result<Arc<ClientConfig>, String> {
    let provider = provider();
    let verifier = Arc::new(Pinned { pins, provider: provider.clone() });
    let (certs, key) = chain(identity);
    let config = ClientConfig::builder_with_provider(provider)
        .with_protocol_versions(&[&rustls::version::TLS13])
        .map_err(failed)?
        .dangerous()
        .with_custom_certificate_verifier(verifier)
        .with_client_auth_cert(certs, key)
        .map_err(failed)?;
    Ok(Arc::new(config))
}

pub(crate) fn peer_fingerprint(state: &CommonState) -> Option<String> {
    state.peer_certificates()?.first().map(|cert| fingerprint(cert.as_ref()))
}
