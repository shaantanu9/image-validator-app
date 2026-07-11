# Security Policy

## Reporting a vulnerability

Please do not open a public issue for a security problem in Image Validator.
Report it privately to the repository owner instead.

## Supported versions

The `main` branch receives security fixes.

## Practices in this repository

- Secrets live in gitignored `.env` files; `.env.example` carries placeholders only.
- Dependabot is preconfigured; a `gitleaks` scan runs in CI.
- Auth uses short-lived access tokens with rotating refresh tokens (argon2-hashed).
- All external input is validated with Zod at the boundary.
