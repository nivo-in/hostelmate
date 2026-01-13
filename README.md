<div align="center">

# 🏨 HostelMate

### Smart Hostel Management Infrastructure for Institutions

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://supabase.com/)
[![Redis](https://img.shields.io/badge/Redis-Upstash-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://upstash.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-22c55e?style=for-the-badge)](LICENSE)

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
│                        CLIENT (Next.js 14)                      │
│              TypeScript · App Router · Tailwind CSS              │
│         Role-based dashboards: Student / Warden / Parent         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTPS (REST)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API SERVER (Express.js)                     │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐  │
│  │   Auth   │ │   RBAC   │ │  Zod     │ │  Rate Limiter      │  │
│  │Middleware│ │Middleware │ │Validate  │ │  100 req/15min     │  │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘  │
│                                                                  │
│  Routes: /attendance /leaves /complaints /mess /notices /stats   │
└──────┬─────────────────────────────┬────────────────────────────┘
       │                             │
       ▼                             ▼
┌──────────────┐            ┌──────────────────┐
│   Supabase   │            │   Redis (Upstash) │
│  PostgreSQL  │            │   Cache Layer     │
│              │            │                   │
│  • RLS       │            │  • TTL: 2-60 min  │
│  • Auth      │            │  • Smart invalidn │
│  • Realtime  │            │  • Pattern delete │
└──────────────┘            └──────────────────┘
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
| **Frontend** | Next.js 14 + TypeScript | Server-side rendering, App Router |
| **Styling** | Tailwind CSS | Utility-first responsive design |
| **Backend** | Node.js + Express | RESTful API server (ES Modules) |
| **Database** | Supabase (PostgreSQL) | Managed Postgres with Row Level Security |
| **Cache** | Redis (Upstash) | Response caching with intelligent invalidation |
| **Auth** | Supabase Auth + JWT | Authentication with role-based access control |
| **Validation** | Zod | Runtime type-safe request validation |
| **Logging** | Winston + DailyRotateFile | Structured logging with 14-day file rotation |
| **Geofencing** | Haversine Formula | GPS-based attendance radius enforcement |
| **Matching** | Jaccard Similarity | Keyword-based lost & found auto-matching |
| **Containers** | Docker + Docker Compose | Multi-service containerization |
| **API Docs** | Swagger / OpenAPI 3.0 | Interactive documentation at `/api/docs` |
| **Monorepo** | Turborepo + pnpm | Workspace management and build orchestration |

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

**Validation logic:** The server verifies both `parsedQr.date === today` AND `parsedQr.token.startsWith(today-secret)`. A screenshot taken at 9:00 AM is invalid by 9:01 AM.

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

Every push to v2 and main triggers automated:

- Lint check (ESLint)
- Production build (Next.js)
- Security audit (pnpm audit)
- Server syntax check (node --check)
- Docker image build verification

Pipeline completes in ~55 seconds. No broken code reaches main.

### 8. Face Recognition with Anti-Spoofing Liveness Detection

HostelMate uses **client-side biometric verification** powered by `face-api.js` (SsdMobilenetv1 + 68-point landmarks). Registration captures **5 angles** (straight, left, right, up, down) — 24 frames total, averaged into 5 per-angle descriptors stored in Supabase.

**Verification runs three hard gates before accepting a match:**

| Gate | Check | How it blocks spoofing |
|---|---|---|
| **1 — Blink (mandatory)** | Eye Aspect Ratio (EAR) falling-edge detection using 68-point landmarks. EAR = `(‖p2−p6‖ + ‖p3−p5‖) / (2 × ‖p1−p4‖)`. EAR < 0.25 on a falling edge = blink confirmed. | A static photo on a phone screen **cannot blink** — no real eye movement, no EAR drop. |
| **2 — Frame-diff (hard-block)** | A 32×32 patch of the face region is sampled every tick, compared pixel-by-pixel (grayscale) to the previous frame. Avg diff < 6/255 over 10+ frames = static source. | Catches a photo held still after a fake EAR dip (e.g., tilting the phone). |
| **3 — Face match** | Euclidean distance vs all 5 stored angle descriptors. Best (minimum) distance must be < 0.52. | Threshold set below face-api's default 0.6 — tight enough to reject strangers, loose enough to match front-facing without head rotation. |

**Performance:** Recursive async tick instead of `setInterval` — next detection fires 50ms after the previous completes (~3× more detections/sec). Blink → verified in **~300ms total**. EMA smoothing on the confidence bar prevents jitter.

---

## 👥 Features by Role

### 🎓 Student
| Feature | Description |
|---|---|
| QR Attendance | Scan rotating QR code within geofenced zone |
| **Face Recognition** | **Biometric attendance with blink-based liveness check** |
| Leave Requests | Submit with date range and reason (20+ chars) |
| Complaints | File categorized complaints with urgency flags |
| Mess Reviews | Rate meals (1-5 stars) with comments |
| Lost & Found | Report or browse lost/found items |
| Auto-Match Notifications | Instant alert when a matching found item is reported |
| Staff Feedback | Rate hostel staff (1-5 stars) with optional comments |
| Notices | View role-filtered announcements |

### 🏛 Warden
| Feature | Description |
|---|---|
| Analytics Dashboard | Redis-cached stats: attendance, leaves, complaints |
| **Face Auth Login** | **5-angle biometric verification with liveness detection** |
| Student Search | Mistype-tolerant fuzzy search for quick student lookup and assignment |
| Attendance Management | View today's attendance with student details |
| Leave Approvals | Approve/reject with `approved_by` audit trail |
| Complaint Tracking | Update status: open → in_progress → resolved |
| Mess Menu Management | CRUD menu items by day and meal type |
| Notices Broadcast | Post to students, parents, or all |
| Staff Directory | Manage hostel staff records |
| Staff Feedback Aggregation | View per-staff average ratings from student reviews |
| Emergency Alerts | System-wide emergency notifications |
| Auto-Match Alerts | Notified when lost/found items match automatically |
| Room Management | Allocate rooms, approve transfers, and track availability |
| Curfew Tracking | Monitor curfew violations and manage curfew settings |

### 👨‍👩‍👧 Parent
| Feature | Description |
|---|---|
| Student Tracking | Real-time attendance and leave status |
| Leave Visibility | Track child's leave requests and approvals |
| Notices | View parent-targeted announcements |
| Contact Warden | Direct communication channel |

---

## 📁 Project Structure

```
hostelmate/
├── apps/
│   ├── client/                          # Next.js 14 Frontend
│   │   ├── app/
│   │   │   ├── (auth)/                  # Login/register pages
│   │   │   ├── (dashboard)/
│   │   │   │   ├── student/             # Student dashboard pages
│   │   │   │   │   ├── attendance/
│   │   │   │   │   ├── complaints/
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   ├── leaves/
│   │   │   │   │   ├── lost-found/
│   │   │   │   │   ├── mess/
│   │   │   │   │   └── notices/
│   │   │   │   ├── warden/              # Warden dashboard pages
│   │   │   │   │   ├── attendance/
│   │   │   │   │   ├── complaints/
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   ├── emergency/
│   │   │   │   │   ├── leaves/
│   │   │   │   │   ├── lost-found/
│   │   │   │   │   ├── mess/
│   │   │   │   │   ├── notices/
│   │   │   │   │   └── staff/
│   │   │   │   └── parent/              # Parent dashboard pages
│   │   │   │       ├── contact/
│   │   │   │       ├── dashboard/
│   │   │   │       ├── leaves/
│   │   │   │       ├── notices/
│   │   │   │       └── track/
│   │   │   ├── globals.css
│   │   │   └── layout.tsx
│   │   ├── components/ui/               # Shared UI components
│   │   ├── components/face/             # Biometric components
│   │   │   ├── FaceRegistration.tsx     # 5-angle guided enrolment (student)
│   │   │   ├── FaceVerification.tsx     # Blink-gated liveness + match (student)
│   │   │   ├── WardenFaceRegistration.tsx
│   │   │   └── WardenFaceVerification.tsx
│   │   ├── lib/faceRecognition.ts       # EAR, EMA, frame-diff, bestMatchDistance
│   │   ├── lib/socket.ts                # Socket.io client configuration
│   │   ├── hooks/                       # Custom React hooks (useApi, useSocket)
│   │   ├── lib/supabase/                # Supabase client config
│   │   ├── middleware.ts                # Auth + role routing
│   │   ├── types/                       # TypeScript definitions
│   │   └── Dockerfile
│   │
│   └── server/                          # Express.js Backend
│       ├── src/
│       │   ├── config/
│       │   │   ├── audit.js             # Audit trail configuration
│       │   │   ├── geofence.js          # Haversine distance calc
│       │   │   ├── logger.js            # Winston configuration
│       │   │   ├── redis.js             # Upstash Redis client
│       │   │   ├── socket.js            # Socket.io configuration
│       │   │   ├── supabase.js          # Supabase admin client
│       │   │   └── validation.js        # Zod schemas
│       │   ├── middleware/
│       │   │   ├── auth.js              # JWT authentication
│       │   │   ├── cache.js             # Cache middleware
│       │   │   ├── errorHandler.js      # Global error handler
│       │   │   ├── rateLimit.js         # Rate limiting
│       │   │   ├── rbac.js              # Role-based access
│       │   │   ├── requestLogger.js     # HTTP request logging
│       │   │   └── validate.js          # Zod validation middleware
│       │   ├── routes/
│       │   │   ├── attendance.js        # QR + geofence attendance
│       │   │   ├── complaints.js        # Complaint ticketing
│       │   │   ├── leaves.js            # Leave management
│       │   │   ├── lost-found.js        # Lost & found directory
│       │   │   ├── mess.js              # Menu + reviews
│       │   │   ├── notices.js           # Announcements
│       │   │   ├── notifications.js     # Real-time notifications
│       │   │   ├── rooms.js             # Room allocation
│       │   │   ├── students.js          # Student management & search
│       │   │   └── stats.js             # Dashboard analytics
│       │   └── index.js                 # Server entry point
│       └── Dockerfile
│
├── docker-compose.yml                   # Multi-service orchestration
├── turbo.json                           # Turborepo config
├── pnpm-workspace.yaml                  # pnpm workspaces
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites

| Tool | Version | Purpose |
|---|---|---|
| Node.js | ≥ 20.x | Runtime |
| pnpm | ≥ 9.x | Package manager |
| Docker | ≥ 24.x | Containerization (optional) |

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

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 3001) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis auth token |
| `HOSTEL_LAT` | Hostel latitude for geofencing |
| `HOSTEL_LNG` | Hostel longitude for geofencing |
| `NODE_ENV` | `development` or `production` |

#### `apps/client/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `NEXT_PUBLIC_API_URL` | Backend API URL (default: `http://localhost:3001`) |

### Running Locally

```bash
# Start backend server
cd apps/server
pnpm dev              # → http://localhost:3001

# Start frontend (new terminal)
cd apps/client
pnpm dev              # → http://localhost:3000

# Or use Turborepo from root
pnpm dev              # Starts both concurrently
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

### Notifications & Audit

| Method | Endpoint | Auth | Role | Description |
|---|---|---|---|---|
| `GET` | `/api/notifications` | ✓ | Any | View user notifications |
| `PATCH` | `/api/notifications/read-all` | ✓ | Any | Mark all as read |
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
| **Rate Limiting** | express-rate-limit | General: 100 req/15min · Auth: 10 req/15min |
| **Geofencing** | Haversine Formula | 100m radius — prevents remote proxy attendance |
| **Input Validation** | Zod Schemas | Type-safe validation on every POST/PUT/PATCH |
| **QR Anti-Fraud** | Rotating Tokens | 60-second rotation prevents screenshot sharing |
| **Error Handling** | Global Handler | Errors never leak stack traces in production |
| **Logging** | Winston | Full audit trail with daily rotation, 14-day retention |
| **CI/CD Gates** | GitHub Actions | Every commit linted, built, and audited before merge |

---

## 🗺 Roadmap

| Status | Feature | Description |
|---|---|---|
| ✅ | **GitHub Actions CI/CD** | Lint → build → security audit → Docker verify on every push to v2/main |
| ✅ | **Redis Caching** | Tiered TTL caching (2–60 min) with smart pattern-based invalidation |
| ✅ | **Docker** | Multi-service containerisation with `docker-compose` (client + server) |
| ✅ | **Winston Logging** | Structured logging with daily file rotation and 14-day retention |
| ✅ | **Zod Validation** | Type-safe request validation schemas on every POST / PUT / PATCH |
| ✅ | **RBAC Middleware** | `requireStudent` / `requireWarden` / `requireStaff` on every route |
| ✅ | **Geofencing** | Haversine formula, 100 m radius enforcement with exact distance in error |
| ✅ | **Rotating QR Codes** | 60-second rotation — screenshot sharing is invalid within 1 minute |
| ✅ | **Smart Lost & Found** | Jaccard-similarity auto-matching with in-app notification on match |
| ✅ | **Staff Management** | Directory, attendance tracking, and monthly staff reports |
| ✅ | **Staff Feedback** | Student rating system (1–5★) per staff member with warden aggregate view |
| ✅ | **Jest Tests** | Attendance, geofence & Zod validation tests with mocked Supabase / Redis |
| ✅ | **Emergency Alerts** | Warden broadcasts instant system-wide emergency notice to all students |
| ✅ | **Face Recognition** | 5-angle biometric (SsdMobilenetv1) + EAR blink liveness + frame-diff anti-spoofing |
| ✅ | **Room Allocation** | Room assignment, transfer requests, and availability tracking |
| ✅ | **Night Curfew Alerts** | Auto-notify parents if student not checked in by 10 PM |
| ✅ | **In-App Notifications** | Per-user notification centre with read/unread state |
| ✅ | **Audit Logging** | Structured audit trail for all warden actions |
| ✅ | **WebSocket Notifications** | Real-time push via Socket.io for instant alerts without polling |
| ✅ | **Redis Pub/Sub** | Live cross-client updates across browser tabs and devices |
| 🔲 | Test Coverage ≥80% | Expand Jest suite to full route coverage with Supertest |
| 🔲 | Mobile App | React Native cross-platform app for students and parents |
| 🔲 | AI Complaint Classification | Auto-categorise complaints by type and urgency using NLP |
| 🔲 | Predictive Maintenance | Predict recurring issues from historical complaint patterns |
| 🔲 | Multi-tenancy | Support multiple hostels under one instance |
| 🔲 | Payment Integration | Mess fees and hostel charges via Razorpay |
| 🔲 | Visitor Management | Digital guest check-in / check-out with warden approval |

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
chore:    Maintenance
```

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

**Built with ❤️ by [Nivo Technologies](https://github.com/nivo-technologies)**

*Transforming hostel management, one institution at a time.*

</div>
