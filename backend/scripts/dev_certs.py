"""
Create local HTTPS certificates for development.

    python scripts/dev_certs.py

Writes to <repo>/certs/ (gitignored):
  tickorbit-dev-ca.pem      - private dev CA (trust this once, see below)
  tickorbit-dev-ca-key.pem  - its key (stays on this machine)
  localhost.pem / localhost-key.pem - server cert for localhost, 127.0.0.1, ::1

The CA carries X.509 name constraints: it can only ever vouch for localhost
and loopback IPs, so even if its key leaked it could not impersonate any real
website. To make browsers trust it on Windows (current user only):

    certutil -user -addstore Root certs\\tickorbit-dev-ca.pem
"""
import datetime
import ipaddress
import pathlib
import sys

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID

OUT = pathlib.Path(__file__).resolve().parents[2] / "certs"
LOOPBACK_V4 = ipaddress.ip_network("127.0.0.0/8")
LOOPBACK_V6 = ipaddress.ip_network("::1/128")


def _write_key(path: pathlib.Path, key) -> None:
    path.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                       serialization.NoEncryption()))


def main() -> None:
    OUT.mkdir(exist_ok=True)
    ca_cert_path, ca_key_path = OUT / "tickorbit-dev-ca.pem", OUT / "tickorbit-dev-ca-key.pem"
    now = datetime.datetime.now(datetime.timezone.utc)

    if ca_cert_path.exists() and ca_key_path.exists() and "--new-ca" not in sys.argv:
        ca_key = serialization.load_pem_private_key(ca_key_path.read_bytes(), password=None)
        ca_cert = x509.load_pem_x509_certificate(ca_cert_path.read_bytes())
    else:
        ca_key = ec.generate_private_key(ec.SECP256R1())
        ca_name = x509.Name([
            x509.NameAttribute(NameOID.ORGANIZATION_NAME, "TickOrbit local development"),
            x509.NameAttribute(NameOID.COMMON_NAME, "TickOrbit Dev CA (localhost only)"),
        ])
        ca_cert = (
            x509.CertificateBuilder()
            .subject_name(ca_name).issuer_name(ca_name)
            .public_key(ca_key.public_key())
            .serial_number(x509.random_serial_number())
            .not_valid_before(now - datetime.timedelta(minutes=5))
            .not_valid_after(now + datetime.timedelta(days=825))
            .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
            .add_extension(x509.KeyUsage(digital_signature=False, content_commitment=False, key_encipherment=False,
                                         data_encipherment=False, key_agreement=False, key_cert_sign=True,
                                         crl_sign=True, encipher_only=False, decipher_only=False), critical=True)
            .add_extension(x509.NameConstraints(
                permitted_subtrees=[x509.DNSName("localhost"), x509.IPAddress(LOOPBACK_V4), x509.IPAddress(LOOPBACK_V6)],
                excluded_subtrees=None), critical=True)
            .add_extension(x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key()), critical=False)
            .sign(ca_key, hashes.SHA256())
        )
        _write_key(ca_key_path, ca_key)
        ca_cert_path.write_bytes(ca_cert.public_bytes(serialization.Encoding.PEM))
        print(f"Created dev CA: {ca_cert_path}")

    key = ec.generate_private_key(ec.SECP256R1())
    cert = (
        x509.CertificateBuilder()
        .subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")]))
        .issuer_name(ca_cert.subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - datetime.timedelta(minutes=5))
        .not_valid_after(now + datetime.timedelta(days=397))
        .add_extension(x509.SubjectAlternativeName([
            x509.DNSName("localhost"),
            x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
            x509.IPAddress(ipaddress.ip_address("::1")),
        ]), critical=False)
        .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
        .add_extension(x509.KeyUsage(digital_signature=True, content_commitment=False, key_encipherment=False,
                                     data_encipherment=False, key_agreement=False, key_cert_sign=False,
                                     crl_sign=False, encipher_only=False, decipher_only=False), critical=True)
        .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
        .add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()), critical=False)
        .sign(ca_key, hashes.SHA256())
    )
    _write_key(OUT / "localhost-key.pem", key)
    (OUT / "localhost.pem").write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    print(f"Created server certificate: {OUT / 'localhost.pem'} (valid until {cert.not_valid_after_utc:%Y-%m-%d})")


if __name__ == "__main__":
    main()
