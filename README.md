<div align="center">

# 🕸️ Stride

### Your Friendly Neighborhood Work Tracker

**Neo-brutalist · Streak-powered · Spider-Man themed**

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?style=for-the-badge&logo=next.js)](https://nextjs.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

> *"With great power comes great productivity."*

</div>

---

## ✨ What is Stride?

**Stride** is a personal productivity and attendance tracker built for interns and employees who want to log their daily work, track streaks, and give their supervisor a clear picture of their day-to-day contributions.

It's not your boring HR system. It's got **Spider-Man easter eggs**, **neo-brutalist design**, **dark mode**, and a **web-click burst effect** every time you click anything. Because work should be fun.

---

## 🚀 Features

### For Every User
| Feature | Description |
|---|---|
| 🕷️ **Daily Work Log** | Log tasks with status (Done, In Progress, Blocked, etc.) and project names |
| 🗓️ **Attendance Marking** | Mark daily status: Present, WFH, Half Day, or Leave |
| 🔥 **Streak Counter** | Tracks consecutive weekday logging — keeps you accountable |
| 📊 **Personal Stats Card** | Weekly done tasks, total entries, monthly days logged, top project |
| 🔍 **History Search** | Filter your entire history by task name, project, or notes |
| 🌙 **Dark Mode** | Full neo-brutalist dark theme with `localStorage` persistence |
| 🕸️ **Spidey Effects** | Web-click burst on every click, web corners on cards, Spidey day quotes |
| ⚙️ **Profile Settings** | Update your name, employment type, and start date |

### For Admins
| Feature | Description |
|---|---|
| 📈 **Team Dashboard** | See today's attendance snapshot for every employee at a glance |
| 👥 **Employee Management** | View all employees, their stats, and full attendance/work history |
| 📋 **Report Generation** | Generate and export attendance reports for any date range |
| ➕ **Add Employees** | Create employee accounts directly from the admin panel |

---

## 🛠️ Tech Stack

```
Frontend     →  Next.js 16 (App Router) + TypeScript
Styling      →  Vanilla CSS — Custom Neo-brutalist Design System
Database     →  Supabase (PostgreSQL + Auth)
Auth         →  Supabase Auth (email/password + server-side middleware)
Deployment   →  Vercel (recommended)
```

---

## 📁 Project Structure

```
worklog/
├── app/
│   ├── (app)/              # Protected routes (requires auth)
│   │   ├── today/          # Daily log + attendance + stats
│   │   ├── history/        # Searchable history view
│   │   ├── settings/       # User profile settings
│   │   └── admin/          # Admin-only dashboard & reports
│   ├── login/              # Sign in page
│   ├── signup/             # Sign up with password strength meter
│   ├── onboarding/         # First-time profile setup
│   ├── auth/callback/      # Supabase OAuth callback
│   └── globals.css         # Full neo-brutalist design system
├── components/
│   ├── AppShell.tsx        # Sidebar, mobile header, Spidey click effect
│   └── HistoryView.tsx     # Reusable history + search component
├── lib/
│   ├── supabase/           # Client + Server Supabase instances
│   └── utils.ts            # Shared helper functions
└── proxy.ts                # Middleware: auth guard + role-based routing
```

---

## ⚡ Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com/) project

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/stride.git
cd stride/worklog
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Copy `.env.local.example` to `.env.local` and fill in your Supabase credentials:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Set up the Supabase database

Run these SQL queries in your Supabase SQL editor:

```sql
-- Profiles table
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  full_name text not null,
  email text not null,
  role text not null default 'EMPLOYEE', -- 'EMPLOYEE' | 'ADMIN'
  employment_type text default 'FULL_TIME', -- 'FULL_TIME' | 'INTERN'
  start_date date,
  created_at timestamptz default now()
);

-- Attendance table
create table attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  status text not null, -- 'PRESENT' | 'WFH' | 'HALF_DAY' | 'LEAVE'
  notes text,
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- Work logs table
create table work_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  task text not null,
  client_or_project text,
  status text not null default 'IN_PROGRESS',
  created_at timestamptz default now()
);

-- Row Level Security
alter table profiles enable row level security;
alter table attendance enable row level security;
alter table work_logs enable row level security;

-- RLS Policies (users see their own data; admins see all)
create policy "Users can manage their own profile" on profiles for all using (auth.uid() = id);
create policy "Users manage their attendance" on attendance for all using (auth.uid() = user_id);
create policy "Users manage their work logs" on work_logs for all using (auth.uid() = user_id);

-- Admin policies (add your admin user ID)
create policy "Admins view all profiles" on profiles for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
);
create policy "Admins view all attendance" on attendance for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
);
create policy "Admins view all work logs" on work_logs for select using (
  exists (select 1 from profiles where id = auth.uid() and role = 'ADMIN')
);
```

### 5. Make yourself an admin

After signing up, run this in Supabase SQL editor:

```sql
update profiles set role = 'ADMIN' where email = 'your@email.com';
```

### 6. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) 🚀

---

## 🎨 Design System

Stride uses a custom **Neo-Brutalist** design system built from scratch in `globals.css`:

- **Heavy borders** with hard box shadows (`4px 4px 0 0 #000`)
- **Bold serif headings** via Fraunces font
- **Monospace accents** via IBM Plex Mono
- **Yellow accent** (`#ffd831`) for CTAs and highlights
- **Full dark mode** via CSS variables + `data-theme="dark"` on `<html>`
- **FOUC prevention** via inline script in `layout.tsx`

### Spider-Man Easter Eggs 🕷️
- **Click anywhere** → 8 red web strands burst from the cursor
- **Every card** → subtle spider web in the top-right corner
- **Sidebar** → "🕸️ Your Friendly Neighborhood Tracker"
- **Day greetings** → Spidey quotes that change by day of week
- **Loading spinners** → Spider-Man red (`#dc2626`)

---

## 📱 Mobile Support

Stride is fully responsive:
- **Sidebar** slides in from the left on mobile with a backdrop overlay
- **Mobile header** with hamburger + theme toggle always visible on small screens
- **Attendance grid** collapses from 4-col to 2-col on phones
- **Form grids** stack to single column on narrow screens
- **Tables** get horizontal scroll on small viewports
- **Touch targets** are minimum 40px for all interactive elements

---

## 🚢 Deployment (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard:
# NEXT_PUBLIC_SUPABASE_URL
# NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## 📄 License

MIT © 2025. Built with ❤️ and too much Spider-Man.

---

<div align="center">

*"Anyone can wear the mask. Start your stride today."* 🕷️

</div>
