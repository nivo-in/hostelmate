<div align="center">

# 🏨 HostelMate

### Smart Hostel Management Infrastructure for Institutions

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://supabase.com/)
[![Redis](https://img.shields.io/badge/Redis-Upstash-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://upstash.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)
[![Playwright](https://img.shields.io/badge/E2E-Playwright-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![Jest](https://img.shields.io/badge/Tests-Jest-C21325?style=for-the-badge&logo=jest&logoColor=white)](https://jestjs.io/)
[![Husky](https://img.shields.io/badge/Git_Hooks-Husky-8B4513?style=for-the-badge)](https://typicode.github.io/husky/)
[![Razorpay](https://img.shields.io/badge/Payments-Razorpay-02042B?style=for-the-badge&logo=razorpay&logoColor=white)](https://razorpay.com/)

**HostelMate replaces manual hostel registers, WhatsApp complaint groups, and paper-based leave forms with a secure, real-time platform — built for scale.**

[Getting Started](#-getting-started) · [Architecture](#-architecture) · [API Docs](#-api-documentation) · [Contributing](#-contributing)

---

> <img width="728" height="418" alt="2026-05-28_19-17-29" src="https://github.com/user-attachments/assets/286575f9-5675-4091-b20e-3f4a06102559" />


>
> <img width="728" height="418" alt="2026-05-28_19-19-14" src="https://github.com/user-attachments/assets/6eba77e7-ef48-45d5-ba26-6548a70ce419" />

>
> <img width="728" height="418" alt="image" src="https://github.com/user-attachments/assets/d55c1143-61ad-47cb-999a-2afd2cde33f1" />



</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Engineering Highlights](#-engineering-highlights)
- [Features by Role](#-features-by-role)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Running Tests](#running-tests)
- [API Documentation](#-api-documentation)
- [Security](#-security)
- [Roadmap](#-roadmap)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

Every hostel in India manages **500+ students** using register books, WhatsApp groups, and verbal complaints. HostelMate digitizes this entirely.

### The Problem

| Traditional Process | Pain Point |
|---|---|
| Paper attendance registers | Proxy attendance, no analytics |
| WhatsApp complaint groups | Messages get buried, no tracking |
| Verbal leave requests | No audit trail, parents uninformed |
| Printed mess menus | Outdated, no feedback mechanism |
| Notice boards | Students miss critical updates |

### The Solution

HostelMate provides a **role-based platform** where students, wardens, and parents each get purpose-built interfaces. Attendance uses **rotating QR codes + GPS geofencing** to eliminate proxy. Complaints flow through a **ticketing system** with urgency flags. Parents get **real-time visibility** into their child's hostel activity.

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Next.js 16)                      │
│              TypeScript · App Router · Tailwind CSS             │
│         Role-based dashboards: Student / Warden / Parent        │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS (REST)
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      API SERVER (Express.js)                         │
│                                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐       │
│  │   Auth   │ │   RBAC   │ │  Zod     │ │  Rate Limiter      │       │
│  │Middleware│ │Middleware│ │Validate  │ │  100 req/15min     │       │ 
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘       │
│                                                                      │
│ Routes: /attendance /leaves /complaints /notices /payments /visitors │
└──────┬─────────────────────────────┬─────────────────────────────────┘
       │                             │
       ▼                             ▼
┌──────────────┐            ┌───────────────────┐
│   Supabase   │            │   Redis (Upstash) │
│  PostgreSQL  │            │   Cache Layer     │
│              │            │                   │
│  • RLS       │            │  • TTL: 2-60 min  │
│  • Auth      │            │  • Smart invalidn │
│  • Realtime  │            │  • Pattern delete │
└──────────────┘            └───────────────────┘
       │
       ▼
┌──────────────┐
│   Winston    │
│   Logging    │
│              │
│  • Daily     │
│    rotation  │
│  • 14-day    │
│    retention │
└──────────────┘
```

---

## 🛠 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | Next.js 16 + TypeScript 5 | Server-side rendering, App Router |
| **Styling** | Tailwind CSS v4 | Utility-first responsive design |
| **Backend** | Node.js 20 + Express 5 | RESTful API server (ES Modules) |
| **Database** | Supabase (PostgreSQL) | Managed Postgres with Row Level Security |
| **Cache** | Redis (Upstash) | Response caching with intelligent invalidation |
| **Auth** | Supabase Auth + JWT | Authentication with role-based access control |
| **Validation** | Zod v4 | Runtime type-safe request validation |
| **Logging** | Winston + DailyRotateFile | Structured logging with 14-day file rotation |
| **Geofencing** | Haversine Formula | GPS-based attendance radius enforcement |
| **Matching** | Jaccard Similarity | Keyword-based lost & found auto-matching |
| **AI / LLM** | Groq API (Llama 3.1 8B) | Complaint classification & predictive maintenance |
| **Payments** | Razorpay | Fee collection with HMAC-SHA256 signature verification |
| **Real-time** | Socket.io | WebSocket push notifications per user room |
| **Biometrics** | face-api.js (SsdMobilenetv1) | 5-angle face registration + liveness detection |
| **Containers** | Docker + Docker Compose | Multi-service containerization with layer caching |
| **API Docs** | Swagger / OpenAPI 3.0 | Interactive documentation at `/api/docs` |
| **Monorepo** | Turborepo + pnpm 10 | Workspace management and parallel build orchestration |
| **Unit Tests** | Jest 30 + Supertest | 20 suites · 200 tests · ≥80% coverage enforced |
| **E2E Tests** | Playwright | Browser automation with auto-started dev servers |
| **Git Hooks** | Husky v9 | Pre-commit: lint client → run server tests |
| **Linting** | ESLint 9 (Next.js config) | TypeScript-aware linting with Core Web Vitals rules |
| **Security** | Helmet + express-rate-limit | HTTP hardening headers + tiered rate limiting |


---

## ⚡ Engineering Highlights

### 1. Rotating QR Codes — Eliminating Screenshot Fraud

Students sharing QR screenshots is the #1 proxy attendance method. HostelMate generates QR codes that **rotate every 30 seconds** with embedded timestamps.

```
QR Payload: {
  "date": "2026-05-08",
  "token": "2026-05-08-secret123-1715150400"  // date + secret + epoch
}
```

**Validation logic:** The server verifies both `parsedQr.date === today` AND `parsedQr.token.startsWith(today-secret)`. A screenshot taken at 9:00 AM is invalid by 9:00:30 AM.

### 2. Haversine Geofencing — Location-Based Enforcement

Even with valid QR codes, students could scan from outside campus. HostelMate enforces a **100-meter radius** using the Haversine formula:

```
a = sin²(Δφ/2) + cos(φ₁) · cos(φ₂) · sin²(Δλ/2)
c = 2 · atan2(√a, √(1−a))
d = R · c        // R = 6,371,000 meters
```

The API returns the exact distance if rejected: *"You are 342m away from hostel. Must be within 100m."*

### 3. Redis Caching with Smart Invalidation

Not all data is equal. HostelMate uses **tiered TTL caching** based on data volatility:

| Cache Key | TTL | Invalidated By |
|---|---|---|
| `mess:menu` | 1 hour | Menu update |
| `stats:dashboard` | 3 min | Any data mutation |
| `attendance:stats:today` | 5 min | New attendance mark |
| `attendance:today:{date}` | 2 min | New attendance mark |
| `notices:{role}` | 3 min | New notice posted |
| `mess:reviews` | 5 min | New review submitted |

Every write operation triggers **targeted cache invalidation** — never stale data, never unnecessary DB hits.

### 4. Role-Based Access Control (RBAC)

Every route is gated by middleware that verifies JWT → fetches user profile → checks role:

```
Request → authenticate() → requireWarden() → validate(schema) → handler
```

Three roles with strict separation: **Student**, **Warden**, **Parent**. A student cannot access warden analytics. A parent cannot submit complaints. Enforced at the middleware layer, not the frontend.

### 5. Zod Schema Validation

Every request body is validated against a Zod schema before reaching the handler. Invalid requests get structured error responses:

```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    { "field": "reason", "message": "Reason must be at least 20 characters" }
  ]
}
```

### 6. Smart Lost & Found Auto-Matching

When a student reports a lost or found item, the system automatically scans existing reports with the opposite status using Jaccard similarity on extracted keywords. If similarity score > 25%, both parties receive an instant notification.

```
Student A: "Lost black leather wallet near Block A"
Student B: "Found black wallet near canteen"
Keywords A: [black, leather, wallet, block]
Keywords B: [black, wallet, canteen]
Jaccard Score: 2/5 = 0.40 → 40% match → NOTIFY BOTH
```

### 7. GitHub Actions CI/CD Pipeline

Two workflows run on every push:

**`ci.yml`** — triggers on push to `v2` and `main`, and on PRs to `main`:

| Step | Command | What it guards |
|---|---|---|
| Lint client | `cd apps/client && pnpm lint` | ESLint (Next.js Core Web Vitals + TypeScript rules) |
| Build client | `cd apps/client && pnpm build` | Next.js production build with injected secrets |
| Check server | `node --check src/index.js` | Syntax validity of the ES Module server |
| Server tests | `cd apps/server && pnpm test` | All 20 Jest suites with mocked Supabase/Redis |
| Security audit | `pnpm audit --audit-level moderate` | Dependency vulnerability scan |

**`docker-build.yml`** — triggers on push to `main` only:

- Builds `hostelmate-server:latest` and `hostelmate-client:latest` using Docker Buildx
- Uses GitHub Actions layer cache (`type=gha`) for fast rebuilds
- Runs with `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` to suppress Node.js 22 deprecation warnings

Pipeline completes in **~55 seconds**. No broken code reaches `main`.

### 8. Face Recognition with Anti-Spoofing Liveness Detection

HostelMate uses **client-side biometric verification** powered by `face-api.js` (SsdMobilenetv1 + 68-point landmarks). Registration captures **5 angles** (straight, left, right, up, down) — 24 frames total, averaged into 5 per-angle descriptors stored in Supabase.

**Verification runs three hard gates before accepting a match:**

| Gate | Check | How it blocks spoofing |
|---|---|---|
| **1 — Blink (mandatory)** | Eye Aspect Ratio (EAR) falling-edge detection using 68-point landmarks. EAR = `(‖p2−p6‖ + ‖p3−p5‖) / (2 × ‖p1−p4‖)`. EAR < 0.25 on a falling edge = blink confirmed. | A static photo on a phone screen **cannot blink** — no real eye movement, no EAR drop. |
| **2 — Frame-diff (hard-block)** | A 32×32 patch of the face region is sampled every tick, compared pixel-by-pixel (grayscale) to the previous frame. Avg diff < 6/255 over 10+ frames = static source. | Catches a photo held still after a fake EAR dip (e.g., tilting the phone). |
| **3 — Face match** | Euclidean distance vs all 5 stored angle descriptors. Best (minimum) distance must be < 0.52. | Threshold set below face-api's default 0.6 — tight enough to reject strangers, loose enough to match front-facing without head rotation. |

**Performance:** Recursive async tick instead of `setInterval` — next detection fires 50ms after the previous completes (~3× more detections/sec). Blink → verified in **~300ms total**. EMA smoothing on the confidence bar prevents jitter.

### 9. AI Complaint Classification & Predictive Maintenance

HostelMate integrates **Groq's blazing-fast inference API** (using `llama-3.1-8b-instant`) to instantly process maintenance requests. 

When a student submits a complaint, the AI automatically:
1. **Categorizes** the issue (e.g., plumbing, electrical).
2. **Flags Urgency** based on safety risks (e.g., "sparking fan" = urgent).
3. **Generates a Warden Summary** with specific resolution steps.

Additionally, a **Predictive Maintenance Dashboard** analyzes the last 30 days of complaints to identify recurring patterns (e.g., "Block A lights flicker frequently") and suggests preventive measures, saving time and money.

### 10. Razorpay Payment Integration

Full fee lifecycle management backed by HMAC-SHA256 payment verification:

```
Warden creates fee structure → generates bills for all students → students/parents pay online
→ Razorpay order created → payment captured → HMAC-SHA256 signature verified → status: paid
→ receipt generated → student + parent notified
```

| Endpoint | Role | Description |
|---|---|---|
| `POST /api/payments/generate-bills` | Warden | Bulk-generate fee bills for a period |
| `POST /api/payments/create-order` | Student/Parent | Create Razorpay order for a pending bill |
| `POST /api/payments/verify` | Student/Parent | Verify HMAC signature, mark paid, notify |
| `POST /api/payments/cancel` | Student/Parent | Reset stuck `processing` payments to `pending` |
| `PATCH /api/payments/:id/mark-paid` | Warden | Record cash/offline payment |
| `POST /api/payments/send-reminders` | Warden | Notify all students with dues within 3 days |

Parents can pay on behalf of their ward — the API resolves the `parent → student` link automatically.

### 11. Visitor Management System

Digital guest check-in with full lifecycle tracking and warden approval gate:

```
Student registers visitor → wardens notified → warden approves/rejects
→ student notified → visitor arrives → warden checks in → visitor checks out
```

Status flow: `pending → approved / rejected → checked_in → checked_out`

All visitor records include `visitor_name`, `visitor_phone`, `purpose`, `relationship`, and `expected_visit_date`.

### 12. Husky Pre-Commit Hooks

Every `git commit` is gated by two automated checks that run **before the commit is created**:

```bash
# .husky/pre-commit
cd apps/client && pnpm lint    # ESLint — blocks on warnings/errors
cd apps/server && pnpm test    # Jest   — blocks on any test failure
```

This ensures **zero broken code is ever committed**, closing the gap between local development and CI. The hooks are installed automatically on `pnpm install` via the `prepare: husky` lifecycle script.

### 13. End-to-End Testing with Playwright

Browser-level E2E tests live in `apps/client/e2e/` and are configured in `playwright.config.ts`:

| Config | Value |
|---|---|
| Test runner | Playwright (`@playwright/test` ^1.60) |
| Browser | Chromium (Desktop Chrome) |
| Base URL | `http://localhost:3000` |
| Retries on CI | 2 |
| Workers on CI | 1 (serial, stable) |
| Trace | On first retry |
| Reporter | HTML |

The config **auto-starts both dev servers** (`client` on :3000, `server` on :3001) before the suite runs — no manual setup needed:

```bash
# Run E2E tests
pnpm test:e2e

# Open Playwright UI (interactive, with time-travel debugging)
pnpm test:e2e-ui
```

The suite covers **59 tests across 5 Playwright projects** (setup · login · student · warden · parent):

| Project | Spec file | Tests | Coverage |
|---|---|---|---|
| `setup` | `auth.setup.ts` | 7 | Login UI structure + per-role auth state generation |
| `login` | `login.spec.ts` | 9 | Title, inputs, password toggle, loading state, redirect |
| `student` | `student.spec.ts` | 13 | All 10 student pages + leave form validation + urgent toggle |
| `warden` | `warden.spec.ts` | 16 | All 13 warden pages + notice form + visitor/fee content checks |
| `parent` | `parent.spec.ts` | 9 | All 6 parent pages + leave/track content checks |

Each role project uses **saved auth storage state** from the setup project — login is performed once, not before every test.

---

## 👥 Features by Role

### 🎓 Student
| Feature | Description |
|---|---|
| QR Attendance | Scan rotating QR code (30-sec rotation) within geofenced zone |
| **Face Recognition** | **Biometric attendance with blink-based liveness check** |
| Leave Requests | Submit with date range and reason (20+ chars) |
| Complaints | File categorized complaints with AI-powered urgency flags |
| Mess Reviews | Rate meals (1-5 stars) with comments |
| Lost & Found | Report or browse lost/found items with auto-match alerts |
| Staff Feedback | Rate hostel staff (1-5 stars) with optional comments |
| Notices | View role-filtered announcements |
| **Fee Payments** | **Pay hostel/mess fees online via Razorpay; view receipts and history** |
| **Room Transfer** | **Submit room transfer requests for warden review** |
| **Visitor Registration** | **Pre-register visitors; receive approval/rejection notifications** |

### 🏛 Warden
| Feature | Description |
|---|---|
| Analytics Dashboard | Redis-cached stats: attendance, leaves, complaints, overdue fees |
| **Face Auth Login** | **5-angle biometric verification with liveness detection** |
| Student Search | Fuzzy search for quick student lookup and assignment |
| Attendance Management | View today's attendance with student details |
| Leave Approvals | Approve/reject with `approved_by` audit trail |
| Complaint Tracking | Update status: open → in_progress → resolved; AI summary shown |
| Mess Menu Management | CRUD menu items by day and meal type |
| Notices Broadcast | Post to students, parents, or all |
| Staff Directory | Manage hostel staff records |
| Staff Feedback Aggregation | View per-staff average ratings from student reviews |
| Emergency Alerts | System-wide emergency notifications |
| Auto-Match Alerts | Notified when lost/found items match automatically |
| Room Management | Allocate rooms, approve transfers, and track availability |
| Curfew Tracking | Monitor curfew violations; auto-alert fires at configurable curfew time |
| **Fee Management** | **Create fee structures, bulk-generate bills, mark cash payments, send reminders** |
| **Visitor Management** | **Approve/reject visitor requests; check in and check out visitors** |
| **Audit Log** | **Full structured audit trail of all warden actions** |

### 👨‍👩‍👧 Parent
| Feature | Description |
|---|---|
| Student Tracking | Real-time attendance and leave status of linked ward |
| Leave Visibility | Track child's leave requests and approvals |
| Notices | View parent-targeted announcements |
| Contact Warden | Direct communication channel |
| **Fee Payments** | **Pay ward's fees via Razorpay; view payment history and receipts** |
| **Curfew Alerts** | **Receive notification if ward hasn't checked in by curfew time** |

---

## 📁 Project Structure

```
hostelmate/
├── .github/
│   └── workflows/
│       ├── ci.yml                       # Lint → build → test → audit (v2 + main)
│       └── docker-build.yml             # Docker image build check (main only)
├── .husky/
│   └── pre-commit                       # Lint client + run server tests before every commit
├── apps/
│   ├── client/                          # Next.js 16 Frontend
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   └── login/               # Login page
│   │   │   ├── (dashboard)/
│   │   │   │   ├── student/             # Student dashboard
│   │   │   │   │   ├── attendance/
│   │   │   │   │   ├── complaints/
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   ├── leaves/
│   │   │   │   │   ├── lost-found/
│   │   │   │   │   ├── mess/
│   │   │   │   │   ├── notices/
│   │   │   │   │   ├── payments/        # Fee payment + receipt view
│   │   │   │   │   ├── room-transfer/   # Room transfer request
│   │   │   │   │   ├── staff-feedback/
│   │   │   │   │   └── visitors/        # Visitor pre-registration
│   │   │   │   ├── warden/              # Warden dashboard
│   │   │   │   │   ├── attendance/
│   │   │   │   │   ├── audit/           # Audit log viewer
│   │   │   │   │   ├── complaints/
│   │   │   │   │   ├── curfew/          # Curfew settings + violations
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   ├── emergency/
│   │   │   │   │   ├── leaves/
│   │   │   │   │   ├── lost-found/
│   │   │   │   │   ├── mess/
│   │   │   │   │   ├── notices/
│   │   │   │   │   ├── payments/        # Fee management + bill generation
│   │   │   │   │   ├── rooms/
│   │   │   │   │   ├── staff/
│   │   │   │   │   └── visitors/        # Visitor approval + check-in/out
│   │   │   │   └── parent/              # Parent dashboard
│   │   │   │       ├── contact/
│   │   │   │       ├── dashboard/
│   │   │   │       ├── leaves/
│   │   │   │       ├── notices/
│   │   │   │       ├── payments/        # Pay ward fees via Razorpay
│   │   │   │       └── track/
│   │   │   ├── globals.css
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx                 # Root redirect to login/dashboard
│   │   ├── components/
│   │   │   ├── ui/                      # Shared UI components
│   │   │   │   ├── Badge.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── EmptyState.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── LoadingSpinner.tsx
│   │   │   │   ├── NotificationBell.tsx # Real-time notification dropdown
│   │   │   │   ├── NivoBadge.tsx
│   │   │   │   └── PageHeader.tsx
│   │   │   ├── face/                    # Biometric components
│   │   │   │   ├── FaceRegistration.tsx       # 5-angle guided enrolment
│   │   │   │   ├── FaceVerification.tsx       # Blink-gated liveness + match
│   │   │   │   ├── WardenFaceRegistration.tsx
│   │   │   │   └── WardenFaceVerification.tsx
│   │   │   └── RouteGuard.tsx           # Client-side role protection
│   │   ├── e2e/                         # Playwright E2E tests (59 tests, 5 projects)
│   │   │   ├── auth.setup.ts            # Per-role auth state generation + login UI tests
│   │   │   ├── login.spec.ts            # Login page: title, fields, toggle, redirect (9 tests)
│   │   │   ├── student.spec.ts          # All 10 student pages + form validation (13 tests)
│   │   │   ├── warden.spec.ts           # All 13 warden pages + content checks (16 tests)
│   │   │   └── parent.spec.ts           # All 6 parent pages + content checks (9 tests)
│   │   ├── hooks/
│   │   │   ├── useApi.ts                # Typed fetch wrapper with auth
│   │   │   ├── useProfile.ts            # Cached Supabase profile hook
│   │   │   └── useSocket.ts             # Socket.io connection hook
│   │   ├── lib/
│   │   │   ├── faceRecognition.ts       # EAR, EMA, frame-diff, bestMatchDistance
│   │   │   ├── socket.ts                # Socket.io client singleton
│   │   │   └── supabase/
│   │   │       ├── client.ts            # Browser Supabase client (singleton)
│   │   │       ├── middleware.ts        # SSR session refresh helper
│   │   │       └── server.ts            # Server-side Supabase client
│   │   ├── public/
│   │   │   └── models/                  # Bundled face-api.js model weights
│   │   │       ├── ssd_mobilenetv1_model-*
│   │   │       ├── face_landmark_68_model-*
│   │   │       ├── face_recognition_model-*
│   │   │       └── tiny_face_detector_model-*
│   │   ├── types/
│   │   │   └── index.ts                 # All shared TypeScript interfaces & enums
│   │   ├── proxy.ts                     # Next.js middleware: session check + role redirect
│   │   ├── eslint.config.mjs            # ESLint 9 flat config (Next.js + TypeScript)
│   │   ├── playwright.config.ts         # E2E config: Chromium, auto-start servers
│   │   ├── next.config.ts
│   │   └── Dockerfile                   # 3-stage: deps → builder → runner
│   │
│   └── server/                          # Express 5 Backend (ES Modules)
│       ├── src/
│       │   ├── config/
│       │   │   ├── curfewJob.js         # Scheduled curfew violation checker (1-min interval)
│       │   │   ├── geofence.js          # Haversine distance calculation
│       │   │   ├── logger.js            # Winston + DailyRotateFile setup
│       │   │   ├── matcher.js           # Jaccard similarity for lost & found
│       │   │   ├── notify.js            # createNotification helper (DB + Socket.io emit)
│       │   │   ├── notifications.js     # Notification query helpers
│       │   │   ├── openai.js            # Groq API client (classifyComplaint, generateMaintenanceSuggestion)
│       │   │   ├── razorpay.js          # Razorpay order creation + HMAC verification
│       │   │   ├── redis.js             # Upstash Redis client (getCache/setCache/deletePattern)
│       │   │   ├── socket.js            # Socket.io server (initSocket, emitToUser, emitToAll)
│       │   │   ├── supabase.js          # Supabase admin client
│       │   │   ├── audit.js             # Audit log writer
│       │   │   └── validation.js        # Zod schemas (shared)
│       │   ├── middleware/
│       │   │   ├── auth.js              # JWT extraction + profile fetch
│       │   │   ├── cache.js             # Redis cache middleware
│       │   │   ├── errorHandler.js      # Global error handler (no stack traces in prod)
│       │   │   ├── rateLimit.js         # generalLimiter / authLimiter / notificationLimiter
│       │   │   ├── rbac.js              # requireStudent / requireWarden / requireStaff
│       │   │   ├── requestLogger.js     # Winston HTTP request logging
│       │   │   └── validate.js          # Zod schema validation middleware
│       │   ├── routes/
│       │   │   ├── attendance.js        # QR + geofence attendance marking
│       │   │   ├── audit.js             # Warden audit log retrieval
│       │   │   ├── complaints.js        # Complaint ticketing + AI classification
│       │   │   ├── curfew.js            # Curfew settings management
│       │   │   ├── leaves.js            # Leave request lifecycle
│       │   │   ├── lost-found.js        # Lost & found + Jaccard auto-matching
│       │   │   ├── mess.js              # Menu CRUD + student reviews
│       │   │   ├── notices.js           # Role-targeted announcements
│       │   │   ├── notifications.js     # Per-user notification centre
│       │   │   ├── parent.js            # Parent portal (attendance/leave view)
│       │   │   ├── payments.js          # Full Razorpay fee payment lifecycle
│       │   │   ├── rooms.js             # Room allocation + transfer approvals
│       │   │   ├── staff-feedback.js    # Student ratings per staff member
│       │   │   ├── stats.js             # Warden dashboard analytics
│       │   │   ├── students.js          # Student search + management
│       │   │   └── visitors.js          # Visitor pre-registration + check-in/out
│       │   └── index.js                 # Server entry: middleware stack + all routes
│       ├── __tests__/                   # Jest integration test suites (20 files)
│       │   ├── attendance.test.js
│       │   ├── audit.test.js
│       │   ├── complaints.test.js
│       │   ├── curfew.test.js
│       │   ├── geofence.test.js
│       │   ├── leaves.test.js
│       │   ├── lost-found.test.js
│       │   ├── matcher.test.js
│       │   ├── mess.test.js
│       │   ├── notices.test.js
│       │   ├── notifications.test.js
│       │   ├── parent.test.js
│       │   ├── rooms.test.js
│       │   ├── staff-feedback.test.js
│       │   ├── stats.test.js
│       │   ├── students.test.js
│       │   ├── validation.test.js
│       │   ├── visitors.test.js
│       │   ├── health.test.js
│       │   └── payments.test.js
│       └── Dockerfile                   # 2-stage: deps → runner (prod-only, no devDeps)
│
├── packages/
│   ├── auth/                            # Shared auth utilities
│   ├── db/                              # Shared database types/helpers
│   └── ui/                             # Shared UI component library
│
├── docker-compose.yml                   # Multi-service orchestration (client + server)
├── turbo.json                           # Turborepo pipeline (dev/build/lint/start)
├── pnpm-workspace.yaml                  # Workspace: apps/* + packages/*
└── package.json                         # Root: husky prepare, predev port-kill, turbo scripts
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | ≥ 18.x (20 LTS recommended) | Runtime |
| pnpm | ≥ 10.x | Package manager |
| Docker | ≥ 24.x | Containerization (optional) |

> **Note:** Husky git hooks are installed automatically when you run `pnpm install` — no extra setup required.

### Installation

```bash
# Clone the repository
git clone https://github.com/nivo-technologies/hostelmate.git
cd hostelmate

# Install dependencies (monorepo — installs both client and server)
pnpm install
```

### Environment Variables

#### `apps/server/.env`

| Variable | Required | Description |
|---|---|---|
| `PORT` | No | Server port (default: `3001`) |
| `NODE_ENV` | Yes | `development` or `production` |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (admin access) |
| `SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `UPSTASH_REDIS_REST_URL` | Yes | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | Upstash Redis auth token |
| `HOSTEL_LAT` | Yes | Hostel latitude for geofencing (e.g. `12.9394941`) |
| `HOSTEL_LNG` | Yes | Hostel longitude for geofencing (e.g. `77.5669014`) |
| `GROQ_API_KEY` | Yes | Groq API key for AI complaint classification |
| `RAZORPAY_KEY_ID` | Yes | Razorpay key ID (use `rzp_test_*` for development) |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay key secret for HMAC-SHA256 verification |
| `FRONTEND_URL` | Prod only | Frontend origin for Socket.io CORS in production |

#### `apps/client/.env.local`

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key |
| `NEXT_PUBLIC_API_URL` | Yes | Backend API URL (default: `http://localhost:3001`) |

### Running Locally

```bash
# Install all dependencies (also installs Husky git hooks automatically)
pnpm install

# Start both client + server concurrently (kills ports 3000 & 3001 first via predev script)
pnpm dev

# Or run individually:
cd apps/server && pnpm dev    # → http://localhost:3001
cd apps/client && pnpm dev    # → http://localhost:3000
```

### Running Tests

```bash
# Backend unit + integration tests (Jest)
cd apps/server
pnpm test               # Run all 20 test suites
pnpm test:watch         # Watch mode
pnpm test:coverage      # Generate coverage report (≥80% threshold enforced)

# Frontend E2E tests (Playwright — auto-starts both dev servers)
cd apps/client
pnpm test:e2e           # Headless Chromium
pnpm test:e2e-ui        # Interactive Playwright UI with time-travel debugging
```

### Running with Docker

```bash
# Build and start all services
docker compose up --build

# Services:
#   Client  → http://localhost:3000
#   Server  → http://localhost:3001
#   Logs    → ./apps/server/logs/ (mounted volume)
```

---

## 📖 API Documentation

Interactive Swagger docs available at **`http://localhost:3001/api/docs`**

> **Note:** All routes are prefixed with `/api/v1/` (e.g. `POST /api/v1/attendance/mark`). The table below omits the prefix for brevity.

### Health & System

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | ✗ | Health check with Redis status and uptime |
| `GET` | `/` | ✗ | API info |

### Attendance

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/api/attendance/mark` | ✓ | Student | Mark attendance via QR + geofence |
| `GET` | `/api/attendance/today` | ✓ | Warden | Today's attendance list (cached 2min) |
| `GET` | `/api/attendance/student/:id` | ✓ | Staff | Student's attendance history |
| `GET` | `/api/attendance/stats` | ✓ | Warden | Attendance statistics (cached 5min) |

### Leaves

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/api/leaves` | ✓ | Student | Submit leave request |
| `GET` | `/api/leaves/my` | ✓ | Student | View own leave requests |
| `GET` | `/api/leaves/all` | ✓ | Warden | View all leave requests |
| `PATCH` | `/api/leaves/:id/approve` | ✓ | Warden | Approve leave request |
| `PATCH` | `/api/leaves/:id/reject` | ✓ | Warden | Reject leave request |

### Complaints

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/api/complaints` | ✓ | Student | File a complaint |
| `GET` | `/api/complaints/my` | ✓ | Student | View own complaints |
| `GET` | `/api/complaints/all` | ✓ | Warden | View all complaints |
| `PATCH` | `/api/complaints/:id/status` | ✓ | Warden | Update complaint status |

### Mess

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/mess/menu` | ✓ | Any | View mess menu (cached 1hr) |
| `PUT` | `/api/mess/menu` | ✓ | Warden | Update menu item |
| `POST` | `/api/mess/review` | ✓ | Student | Submit meal review |
| `GET` | `/api/mess/reviews` | ✓ | Warden | View all reviews (cached 5min) |

### Notices

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/api/notices` | ✓ | Warden | Post announcement |
| `GET` | `/api/notices` | ✓ | Any | View role-filtered notices (cached 3min) |

### Lost & Found

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/api/lost-found` | ✓ | Student | Report lost/found item |
| `GET` | `/api/lost-found` | ✓ | Any | Browse items |
| `PATCH` | `/api/lost-found/:id/claim` | ✓ | Any | Claim/resolve item |

### Rooms

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/rooms` | ✓ | Warden | View all room allocations |
| `POST` | `/api/rooms/assign` | ✓ | Warden | Assign student to a room |
| `GET` | `/api/rooms/transfer-requests` | ✓ | Warden | View room transfer requests |
| `PATCH` | `/api/rooms/transfer-requests/:id` | ✓ | Warden | Approve or reject transfer request |

### Visitors

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/api/visitors` | ✓ | Student | Pre-register a visitor |
| `GET` | `/api/visitors/my` | ✓ | Student | View own visitor requests |
| `GET` | `/api/visitors` | ✓ | Warden | View all visitors (filterable by status/date) |
| `PATCH` | `/api/visitors/:id/approve` | ✓ | Warden | Approve visitor request |
| `PATCH` | `/api/visitors/:id/reject` | ✓ | Warden | Reject visitor request |
| `PATCH` | `/api/visitors/:id/checkin` | ✓ | Warden | Record visitor check-in |
| `PATCH` | `/api/visitors/:id/checkout` | ✓ | Warden | Record visitor check-out |

### Payments

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/payments/fee-structures` | ✓ | Any | List active fee structures |
| `POST` | `/api/payments/fee-structures` | ✓ | Warden | Create a new fee structure |
| `GET` | `/api/payments/my` | ✓ | Student/Parent | View own payment history + totals |
| `GET` | `/api/payments/all` | ✓ | Warden | View all payments (filterable) |
| `POST` | `/api/payments/generate-bills` | ✓ | Warden | Bulk-generate fee bills for a period |
| `POST` | `/api/payments/create-order` | ✓ | Student/Parent | Create Razorpay payment order |
| `POST` | `/api/payments/verify` | ✓ | Student/Parent | Verify HMAC signature + mark paid |
| `POST` | `/api/payments/cancel` | ✓ | Student/Parent | Cancel a stuck `processing` payment |
| `PATCH` | `/api/payments/:id/mark-paid` | ✓ | Warden | Mark payment as paid (cash/offline) |
| `POST` | `/api/payments/send-reminders` | ✓ | Warden | Send due-date reminders (3-day window) |
| `GET` | `/api/payments/receipt/:id` | ✓ | Any | Fetch payment receipt |
| `GET` | `/api/payments/students-list` | ✓ | Warden | List all students with fee summaries |
| `GET` | `/api/payments/last-reminder` | ✓ | Warden | Timestamp of last bulk reminder sent |

### Curfew

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/curfew/settings` | ✓ | Warden | Get current curfew settings |
| `PATCH` | `/api/curfew/settings` | ✓ | Warden | Update curfew time and enabled state |
| `GET` | `/api/curfew/violations` | ✓ | Warden | Students absent after curfew time |
| `POST` | `/api/curfew/notify` | ✓ | Warden | Send curfew violation notifications |

### Parent Portal

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/parent/ward` | ✓ | Parent | Get linked ward's profile + attendance |
| `GET` | `/api/parent/leaves` | ✓ | Parent | Get ward's leave requests |
| `GET` | `/api/parent/complaints` | ✓ | Parent | Get ward's complaint history |

### Staff Feedback

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `POST` | `/api/staff-feedback` | ✓ | Student | Submit rating for a staff member |
| `GET` | `/api/staff-feedback` | ✓ | Warden | View all feedback with per-staff averages |
| `GET` | `/api/staff-feedback/:staffId` | ✓ | Warden | Feedback for a specific staff member |

### Notifications & Audit

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/notifications` | ✓ | Any | View unread + recent notifications |
| `PATCH` | `/api/notifications/:id/read` | ✓ | Any | Mark a single notification as read |
| `PATCH` | `/api/notifications/read-all` | ✓ | Any | Mark all notifications as read |
| `GET` | `/api/audit` | ✓ | Warden | View warden action audit logs |

### Stats

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/stats/dashboard` | ✓ | Warden | Aggregated dashboard stats (cached 3min) |

---

## 🔒 Security

| Layer | Implementation | Details |
|---|---|---|
| **Authentication** | Supabase Auth + JWT | Every API request verified via `authenticate()` middleware |
| **Authorization** | RBAC Middleware | `requireStudent()`, `requireWarden()`, `requireStaff()` |
| **Row Level Security** | Supabase RLS Policies | Database-level access control on all tables |
| **Rate Limiting** | express-rate-limit | General: 100 req/15min · Auth: 10 req/15min · Notifications: 30 req/2min |
| **HTTP Hardening** | Helmet | Secure HTTP headers: CSP, HSTS, X-Frame-Options, X-Content-Type |
| **Geofencing** | Haversine Formula | 100m radius — prevents remote proxy attendance |
| **Input Validation** | Zod v4 Schemas | Type-safe validation on every POST/PUT/PATCH |
| **QR Anti-Fraud** | Rotating Tokens | 30-second rotation prevents screenshot sharing |
| **Payment Security** | HMAC-SHA256 | Razorpay signature verified server-side before marking paid |
| **Biometric Anti-Spoofing** | EAR + Frame-diff | 3-gate liveness: mandatory blink + frame-diff + face match |
| **Pre-commit Gate** | Husky | ESLint + Jest must pass before any commit is created |
| **Error Handling** | Global Handler | Stack traces never exposed in production responses |
| **Audit Trail** | Winston + DB | Every warden action logged with timestamp, resource, and actor |
| **CI/CD Gates** | GitHub Actions | Every push linted, built, tested, and security-audited |

---

## 🗺 Roadmap

| Status | Feature | Description |
|---|---|---|
| ✅ | **GitHub Actions CI/CD** | Lint → build → server tests → security audit → Docker verify on every push |
| ✅ | **Husky Pre-commit Hooks** | Client lint + server tests enforced before every `git commit` |
| ✅ | **E2E Tests (Playwright)** | Browser-level login flow tests with auto-started dev servers |
| ✅ | **Jest Integration Tests** | 20 suites, 200 tests — ≥80% line/function threshold enforced |
| ✅ | **ESLint 9 Flat Config** | Next.js Core Web Vitals + TypeScript rules across the client |
| ✅ | **Redis Caching** | Tiered TTL caching (2–60 min) with smart pattern-based invalidation |
| ✅ | **Docker** | Multi-service containerisation with `docker-compose` (client + server) |
| ✅ | **Winston Logging** | Structured logging with daily file rotation and 14-day retention |
| ✅ | **Zod v4 Validation** | Type-safe request validation schemas on every POST / PUT / PATCH |
| ✅ | **RBAC Middleware** | `requireStudent` / `requireWarden` / `requireStaff` on every route |
| ✅ | **Helmet Security Headers** | Secure HTTP headers (CSP, HSTS, X-Frame-Options) via Helmet |
| ✅ | **Tiered Rate Limiting** | General / Auth / Notification limiters with custom error responses |
| ✅ | **Geofencing** | Haversine formula, 100 m radius enforcement with exact distance in error |
| ✅ | **Rotating QR Codes** | 30-second rotation — screenshot sharing invalid within 30 seconds |
| ✅ | **Smart Lost & Found** | Jaccard-similarity auto-matching with in-app notification on match |
| ✅ | **Staff Management** | Directory, attendance tracking, and monthly staff reports |
| ✅ | **Staff Feedback** | Student rating system (1–5★) per staff member with warden aggregate view |
| ✅ | **Emergency Alerts** | Warden broadcasts instant system-wide emergency notice to all students |
| ✅ | **Face Recognition** | 5-angle biometric (SsdMobilenetv1) + EAR blink liveness + frame-diff anti-spoofing |
| ✅ | **Room Allocation** | Room assignment, transfer requests, and availability tracking |
| ✅ | **Night Curfew Alerts** | Scheduled job (1-min interval, IST-aware) auto-notifies wardens of violations |
| ✅ | **In-App Notifications** | Per-user notification centre with read/unread state |
| ✅ | **Audit Logging** | Structured audit trail for all warden actions |
| ✅ | **WebSocket Notifications** | Real-time push via Socket.io user rooms for instant alerts |
| ✅ | **AI Complaint Classification** | Auto-categorise complaints by type and urgency using Groq/Llama 3.1 |
| ✅ | **Predictive Maintenance** | Predict recurring issues from 30-day complaint history via AI |
| ✅ | **Razorpay Payments** | Full fee lifecycle: bill generation → Razorpay checkout → HMAC verify → receipt |
| ✅ | **Visitor Management** | Digital guest pre-registration, warden approval, and check-in/out tracking |
| ✅ | **E2E Coverage Expansion** | 59 tests across 5 Playwright projects — all critical user flows per role |
| 🔲 | **Mobile App** | React Native cross-platform app for students and parents |
| 🔲 | **Multi-tenancy** | Support multiple hostels under one instance with tenant isolation |

---

## 🤝 Contributing

Contributions are welcome. Please follow the standard process:

1. **Fork** the repository
2. **Create** your feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'feat: add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Commit Convention

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat:     New feature
fix:      Bug fix
docs:     Documentation
refactor: Code restructuring
test:     Adding tests
chore:    Maintenance tasks
perf:     Performance improvement
ci:       CI/CD configuration changes
```

### Pre-commit Checks

When you commit, Husky automatically runs:

1. **ESLint** on `apps/client` — enforces Next.js Core Web Vitals + TypeScript rules
2. **Jest** on `apps/server` — all 20 integration test suites must pass

If either check fails, the commit is **blocked**. Fix the errors, then commit again.

```bash
# Bypass hooks in an emergency (not recommended)
git commit --no-verify -m "chore: emergency fix"
```

### Running the Test Suite Locally

```bash
# Backend integration tests
cd apps/server && pnpm test

# Backend with coverage report
cd apps/server && pnpm test:coverage

# Frontend E2E tests (Playwright)
cd apps/client && pnpm test:e2e

# Frontend E2E with interactive UI
cd apps/client && pnpm test:e2e-ui
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ by [Nivo Technologies](https://github.com/nivo-technologies)**

*Transforming hostel management, one institution at a time.*

</div>
