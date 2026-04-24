# Changelog

All notable changes to HostelMate are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Parent dashboard notification bell with real-time push support
- Interactive status filter chips (All / Approved / Pending / Rejected) on Parent Leave Status page
- Live search filter on Parent Notices & Announcements page
- Skeleton shimmer animation (`.skeleton` CSS class) for consistent loading states across all pages
- Role-specific `hm-input` focus rings: `hm-input-blue` (Parent) and `hm-input-orange` (Student)
- `aria-label` accessibility attributes on search inputs

### Changed
- Aligned NotificationBell Parent theme accent from `#3b82f6` to `#60a5fa` for design consistency
- Parent dashboard quick-action icon tiles now use Parent Blue (`rgba(96,165,250,0.1)`) accents
- Parent Contact page: dual Call + Email action buttons rendered side-by-side in a grid
- Leave Requests card header: filter chips replace plain "Total: N" count

### Fixed
- Full-width edge-to-edge `PageHeader` on all pages (removed inner `maxWidth` from `PageShell` wrapper)
- TypeScript: `whiteSpace` camelCase property in JSX inline style objects
- TypeScript: `PageShellProps` interface — removed non-existent `subtitle`/`title` from production exports

---

## [2.0.0] — 2026-07-15

### Added
- **Face Recognition**: 5-angle biometric enrolment (SsdMobilenetv1) + Open-Close-Open EAR blink liveness detection
- **Warden Face Auth Login**: Biometric verification gate on the warden sign-in flow
- **Razorpay Fee Payments**: Full lifecycle — bill generation → Razorpay checkout → HMAC-SHA256 verify → receipt
- **Parent Fee Payments**: Parents can pay ward's hostel fees on their behalf via the Parent portal
- **Visitor Management**: Digital pre-registration → warden approval → check-in/check-out lifecycle
- **Audit Logging**: Structured audit trail for all warden CRUD actions with Winston + DB
- **Room Transfers**: Students submit room transfer requests; warden approves/rejects
- **Staff Feedback**: Students rate hostel staff (1–5★); warden sees per-staff aggregate view
- **Curfew Tracker**: Scheduled 1-minute IST-aware job detects curfew violations, notifies warden
- **Predictive Maintenance**: Groq/Llama-3.1 analyzes 30-day complaint history for recurring issues
- **E2E Tests (Playwright)**: 59 tests across 5 projects — setup, login, student, warden, parent
- **Jest Integration Tests**: 23 suites, 261 tests, ≥80% coverage threshold enforced
- **Notification Bell**: Apple notification center–style slide-in panel with unread badge and search
- **Landing Page**: Dark theme, scroll-driven 3D cylinder feature carousel, parallax hero
- **Login Page**: Role detection, animated spotlight, 3D card tilt, googly-eyes password toggle
- **Apple Liquid Glass Nav**: visionOS-style backdrop blur + multi-layer refraction on landing page
- **Parent Dashboard**: Real-time ward tracking with 3-column layout (Ward Profile, Attendance Rate, Calendar)
- **Parent Notifications**: `NotificationBell` with Parent Blue theme on parent portal
- **Leave Filter**: Status filter chips on Parent Leave Status page
- **Notices Search**: Live search bar on Parent Notices & Announcements page

### Changed
- Upgraded to **Zod v4** for runtime request validation
- Upgraded to **Next.js 16** (App Router)
- Upgraded to **pnpm 10** workspace management
- Upgraded to **Jest 30** test runner
- ESLint upgraded to **flat config (ESLint 9)** with Next.js Core Web Vitals rules

### Fixed
- Socket.io CORS configuration for production deployment
- Redis pattern-delete invalidation on multi-key payloads
- Razorpay HMAC signature verification edge cases

---

## [1.5.0] — 2026-04-20

### Added
- **AI Complaint Classification**: Groq API integration (llama-3.1-8b-instant) for auto-categorisation + urgency flags
- **Smart Lost & Found**: Jaccard-similarity auto-matching; both parties notified when score > 25%
- **Emergency Alerts**: Warden can broadcast system-wide emergency notice to all students instantly
- **In-App Notifications**: Per-user notification centre with read/unread state and WebSocket push
- **GitHub Actions CI/CD**: Lint → build → server tests → security audit → Docker verify on every push
- **Husky Pre-commit Hooks**: ESLint + Jest must pass before any commit
- **Docker**: Multi-service containerisation (`docker-compose.yml`) with layer-cached builds

### Changed
- Redis caching upgraded to tiered TTL model (2–60 min) with smart pattern-based invalidation
- Attendance stats endpoint migrated to Redis cache (5-min TTL)

---

## [1.0.0] — 2026-02-10

### Added
- **Rotating QR Attendance**: 30-second token rotation prevents screenshot fraud
- **Haversine Geofencing**: 100 m radius enforcement with exact distance in rejection errors
- **RBAC Middleware**: `requireStudent` / `requireWarden` / `requireStaff` on every route
- **Zod Validation**: Type-safe schemas on every POST / PUT / PATCH
- **Supabase RLS**: Row-level security policies on all database tables
- **Helmet Security Headers**: CSP, HSTS, X-Frame-Options on every response
- **Rate Limiting**: General (100 req/15min) · Auth (10 req/15min) · Notifications (30 req/2min)
- **Winston Logging**: Structured HTTP logging with daily file rotation (14-day retention)
- **Mess Menu Management**: CRUD operations with per-meal student review ratings
- **Notices Board**: Role-targeted announcements (Student / Parent / All)
- **Leave Request Lifecycle**: Submit → Warden approve/reject → Student notified
- **Complaint Ticketing**: Categorized submissions, urgency flags, status updates (open → resolved)
- **Swagger / OpenAPI 3.0**: Interactive docs at `/api/docs`
- **Turborepo**: Parallel monorepo build orchestration with remote caching support

---

[Unreleased]: https://github.com/nivo-in/hostelmate/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/nivo-in/hostelmate/compare/v1.5.0...v2.0.0
[1.5.0]: https://github.com/nivo-in/hostelmate/compare/v1.0.0...v1.5.0
[1.0.0]: https://github.com/nivo-in/hostelmate/releases/tag/v1.0.0
