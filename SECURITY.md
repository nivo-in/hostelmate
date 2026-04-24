# Security Policy

## Supported Versions

The following versions of HostelMate receive active security updates:

| Version | Supported |
|---------|-----------|
| 2.x     | ✅ Active support |
| 1.5.x   | ⚠️ Critical fixes only |
| < 1.5   | ❌ End of life |

---

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities via public GitHub Issues.**

If you discover a security vulnerability in HostelMate, please report it responsibly:

1. **Email**: Send a detailed report to **security@nivo.in**
2. **Subject Line**: `[SECURITY] HostelMate — <brief description>`
3. **Response Time**: You will receive an acknowledgment within **48 hours**
4. **Disclosure**: We follow a **90-day coordinated disclosure** policy

### What to Include

- A clear description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any proof-of-concept code (if applicable)

### What to Expect

1. **Acknowledgment** within 48 hours
2. **Severity assessment** and initial triage within 5 business days
3. **Status updates** every 7 days until resolved
4. **Credit** in the release notes if you wish to be acknowledged (optional)

---

## Security Architecture

HostelMate implements defense-in-depth with multiple security layers:

| Layer | Implementation |
|-------|---------------|
| **Authentication** | Supabase Auth + JWT verification on every API request |
| **Authorization** | RBAC middleware (`requireStudent`, `requireWarden`, `requireStaff`) |
| **Database Security** | Supabase Row Level Security (RLS) policies on all tables |
| **Rate Limiting** | General: 100 req/15min · Auth: 10 req/15min · Notifications: 30 req/2min |
| **HTTP Hardening** | Helmet (CSP, HSTS, X-Frame-Options, X-Content-Type-Options) |
| **Input Validation** | Zod v4 schemas on every POST / PUT / PATCH request |
| **Anti-Fraud Attendance** | Rotating QR tokens (30-second rotation) + Haversine geofencing (100m) |
| **Payment Security** | HMAC-SHA256 Razorpay signature verification server-side |
| **Biometric Anti-Spoofing** | Open-Close-Open EAR blink sequence + frame-diff liveness detection |
| **Pre-commit Gate** | Husky: ESLint + Jest must pass before any commit is created |
| **Error Handling** | Stack traces never exposed in production API responses |
| **Audit Trail** | All warden actions logged with timestamp, resource, and actor |
| **CI/CD Gates** | Every push linted, built, tested, and security-audited via GitHub Actions |

---

## Known Security Considerations

- **Face Recognition models** are bundled client-side and do NOT transmit raw images to any external server. Only 128-dimensional descriptor vectors are stored in Supabase.
- **Razorpay keys** must never be committed to the repository. Use environment variables only.
- **Supabase Service Role Key** grants admin database access and must be kept server-side only.
- **QR codes** rotate every 30 seconds. Do not cache or store QR images.

---

## Dependency Vulnerabilities

We run `pnpm audit --audit-level moderate` in CI on every push. If you notice a dependency vulnerability not yet addressed, please report it via the process above rather than opening a public issue.

---

*This security policy was last updated: July 2026*
