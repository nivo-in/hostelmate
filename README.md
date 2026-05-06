# HostelMate

**HostelMate** is a smart, end-to-end hostel management SaaS platform built by Nivo Technologies. It streamlines attendance, leave requests, complaints, and mess management for students, wardens, and parents in a unified, modern interface.

## Tech Stack

| Technology | Usage |
| --- | --- |
| Next.js 14 (App Router) | Frontend Framework |
| TypeScript | Type Safety |
| Tailwind CSS | Styling & Design System |
| Node.js + Express | Backend API |
| Supabase | Database & Authentication |

## Features by Role

### 🎓 Students
- **Smart Attendance:** Mark daily attendance via geofenced QR code scanning.
- **Leave Requests:** Apply for leaves and track approval status.
- **Complaints:** Report maintenance issues and track resolution.
- **Mess Menu:** View weekly menus and rate daily meals.
- **Lost & Found:** Report lost items or claim found ones.
- **Notices:** Receive real-time announcements from administration.

### 👮 Wardens
- **Attendance Management:** Generate dynamic QR codes and view daily stats.
- **Leave Management:** Approve or reject student leave requests.
- **Complaint Resolution:** Track and update the status of student complaints.
- **Mess Management:** Update weekly menus and review meal ratings.
- **Notice Board:** Post announcements targeting students, parents, or both.
- **Lost & Found:** Manage reported items and mark them as claimed.

### 👪 Parents
- **Student Tracking:** Monitor their child's daily attendance with a 30-day calendar view.
- **Leave Status:** View all leave applications and their current status.
- **Notices:** Receive official communications from the hostel administration.
- **Contact:** Quickly access emergency contact details for the chief warden.

## Folder Structure

```
hostelmate/
├── apps/
│   ├── client/          # Next.js 14 frontend app
│   │   ├── app/         # Next.js App Router (Auth & Dashboard routes)
│   │   ├── components/  # Reusable UI components
│   │   ├── hooks/       # Custom React hooks (useApi, useProfile)
│   │   ├── lib/         # Supabase client/server utilities
│   │   └── types/       # TypeScript interface definitions
│   └── server/          # Express.js backend API
│       ├── src/
│       │   ├── config/  # Database/Env configuration
│       │   ├── middleware/# Auth, RBAC, Rate Limiting
│       │   └── routes/  # API endpoint handlers
```

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone <repo-url>
   cd hostelmate
   ```

2. **Install dependencies:**
   ```bash
   # Install client dependencies
   cd apps/client
   pnpm install

   # Install server dependencies
   cd ../server
   pnpm install
   ```

3. **Environment Variables:**
   Create `.env.local` in `apps/client` and `.env` in `apps/server` with the following variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_API_URL`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

4. **Run the development servers:**
   ```bash
   # Run frontend (http://localhost:3000)
   cd apps/client
   pnpm dev

   # Run backend (http://localhost:3001)
   cd ../server
   pnpm dev
   ```

## API Endpoints Summary

- **`/api/attendance`**: Mark attendance, fetch daily stats, and student history.
- **`/api/leaves`**: Apply, approve, reject, and fetch leave requests.
- **`/api/complaints`**: Create and manage status of student complaints.
- **`/api/mess`**: Update weekly menu and submit/view meal ratings.
- **`/api/notices`**: Post and fetch announcements based on user role.
- **`/api/lost-found`**: Report lost/found items and manage claims.
- **`/api/stats`**: Aggregate dashboard statistics for the warden.

## Contributing

Please follow the existing Linear-inspired design system (white backgrounds, minimal borders, no shadows) and strict TypeScript typings when contributing new features.
