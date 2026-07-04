# TLS Certificates

This directory is mounted into the nginx container at `/etc/nginx/ssl/`.

Production TLS certificates are **not committed to source control**.

## Required files

| File | Description |
|------|-------------|
| `cert.pem` | Full-chain TLS certificate |
| `key.pem` | Private key (chmod 600) |

## Provisioning options

### Let's Encrypt (recommended)

```bash
certbot certonly --standalone -d yourdomain.com
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/cert.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/key.pem
chmod 600 ssl/key.pem
```

### Self-signed (local testing only)

```bash
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/key.pem -out ssl/cert.pem \
  -subj "/CN=localhost"
```

Do not use self-signed certificates in production.
