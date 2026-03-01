# Developer Guide — Dia (Doctor Assistant)

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Local Development Setup](#local-development-setup)
5. [Environment Variables](#environment-variables)
6. [Key Data Models](#key-data-models)
7. [AI Agent System](#ai-agent-system)
8. [Production Deployment](#production-deployment)

---

## Architecture Overview

```
Browser (Next.js / Vercel)
  ├── Admin Dashboard  ──REST + Bearer──▶  FastAPI (Railway)
  │     └── Voice Button ──WebSocket──▶   Gemini Live Audio API
  └── Public /clinic/[slug]  ──REST──▶    FastAPI (Railway)
                                               │
                                          Firebase Firestore
                                          Firebase Auth
```

- **Firestore real-time** (`onSnapshot`) drives live UI updates — queue, prescriptions, print queue. No polling.
- **WebSocket** is used *only* for the AI voice audio stream (Gemini Live API). All data flows over REST + Firestore.
- **Multi-tenant** — every collection is scoped under `clinics/{clinicId}/...`
- **Agent tools run server-side** — frontend streams raw audio bytes; backend runs the Gemini agent and calls tool functions.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), TypeScript, TailwindCSS, shadcn/ui |
| Backend | FastAPI (Python 3.13), Pydantic v2, asyncio |
| Database | Firebase Firestore |
| Auth | Firebase Auth (Google Sign-In + custom claims) |
| AI Agent | Google Gemini Live API (`gemini-2.5-flash-native-audio-preview`) |
| Drag-and-drop | @dnd-kit/core |
| Deployment BE | Railway |
| Deployment FE | Vercel |

---

## Project Structure

```
Da-Agent/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app, WebSocket voice handler, router registration
│   │   ├── firebase_admin.py        # Firebase Admin SDK init
│   │   ├── dependencies.py          # require_auth (Bearer token → Firebase verify)
│   │   ├── agent/
│   │   │   ├── agent.py             # Gemini agent system prompt / INSTRUCTION
│   │   │   └── tools.py             # Tool functions: search_patient_in_queue,
│   │   │                            #   get_patient_info, update_prescription,
│   │   │                            #   finalize_prescription
│   │   ├── models/                  # Pydantic models
│   │   ├── routers/
│   │   │   ├── clinics.py           # Clinic + doctor + staff CRUD
│   │   │   ├── patients.py          # Patient CRUD
│   │   │   ├── appointments.py      # Queue management + reorder
│   │   │   ├── prescriptions.py     # Rx CRUD + print-queue + mark-printed
│   │   │   ├── availability.py      # Doctor schedule slots
│   │   │   ├── register.py          # Public self-registration + /slots endpoint
│   │   │   └── auth.py              # /api/auth/link — Google user → clinic claims
│   │   └── services/
│   │       ├── patient_service.py
│   │       ├── appointment_service.py
│   │       ├── prescription_service.py   # + list_print_queue, mark_printed
│   │       ├── clinic_service.py
│   │       ├── availability_service.py
│   │       └── scheduling_service.py     # Slot-based estimated appointment datetime
│   ├── requirements.txt
│   └── railway.toml
│
├── frontend/
│   ├── app/
│   │   ├── (admin)/
│   │   │   ├── layout.tsx           # Sidebar, LanguageProvider, DoctorProvider
│   │   │   ├── dashboard/           # Stats overview
│   │   │   ├── appointments/        # Live queue + completed section
│   │   │   ├── prescriptions/       # Rx editor
│   │   │   ├── print-queue/         # Finalized Rx awaiting print
│   │   │   ├── patients/            # Patient history
│   │   │   ├── clinic-admin/        # Doctors/staff/availability management
│   │   │   └── admin/               # Platform admin (create clinics)
│   │   ├── clinic/[slug]/           # Public patient self-registration (no auth)
│   │   ├── login/
│   │   ├── components/
│   │   │   ├── prescription-print.tsx
│   │   │   ├── voice-button.tsx
│   │   │   └── ui/
│   │   └── lib/
│   │       ├── auth-context.tsx     # Firebase auth state + claims
│   │       ├── doctor-context.tsx   # Selected doctor switcher
│   │       ├── language-context.tsx # EN/HI toggle (localStorage)
│   │       ├── i18n.ts              # Translation strings
│   │       ├── firebase.ts          # Firebase client SDK
│   │       └── api.ts               # Authenticated fetch wrapper
│   └── package.json
│
└── docs/
```

---

## Local Development Setup

### Prerequisites
- Python 3.11+, Node.js 18+
- Firebase project (Firestore + Auth enabled)
- Google AI Studio API key

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Create backend/.env
cp .env.example .env              # fill in values (see Environment Variables below)

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install

# Create frontend/.env.local
cp .env.local.example .env.local  # fill in Firebase + API URL

npm run dev                        # http://localhost:3000
```

### Running Both Together

```bash
# Terminal 1
cd backend && source venv/bin/activate && uvicorn app.main:app --reload

# Terminal 2
cd frontend && npm run dev
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `GOOGLE_API_KEY` | Gemini API key from https://aistudio.google.com/apikey |
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Service account `client_email` |
| `FIREBASE_PRIVATE_KEY` | Service account `private_key` (include full PEM with `\n`) |
| `CORS_ORIGINS` | Comma-separated allowed origins e.g. `http://localhost:3000` |
| `GEMINI_LIVE_MODEL` | `gemini-2.5-flash-native-audio-preview-12-2025` |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase web app `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | From Firebase web app config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | From Firebase web app config |
| `NEXT_PUBLIC_API_URL` | Backend base URL e.g. `http://localhost:8000` |
| `NEXT_PUBLIC_WS_URL` | WebSocket base e.g. `ws://localhost:8000` |

---

## Key Data Models

### Firestore Collections

```
clinics/{clinicId}
  ├── appointments/{appointmentId}
  │     fields: patientId, patientName, patientPhone, doctorId,
  │             date, status, queuePosition, estimatedTime, paymentStatus
  ├── patients/{patientId}
  │     fields: name, phone, age, gender, clinicId, visits, notes
  ├── prescriptions/{prescriptionId}
  │     fields: patientId, doctorId, date, status (draft|final),
  │             content {patientInfo, complaints, diagnosis,
  │                      medications, tests, followUp, notes},
  │             printQueued, printedAt, createdAt, updatedAt
  ├── availability/{docId}
  │     fields: doctorId, recurring (bool), dayOfWeek (0-6) or date,
  │             slots [{start: "HH:MM", end: "HH:MM"}]
  └── doctors/{doctorId}
        fields: name, email, specialization, phone
```

### Firebase Auth Custom Claims

```json
{
  "role": "doctor" | "staff" | "platform_admin",
  "clinicId": "<clinicId>",
  "doctorId": "<doctorId>"   // only for doctors
}
```

Claims are assigned by `POST /api/auth/link` called after first Google Sign-In.

---

## AI Agent System

The agent runs server-side via a **WebSocket connection** at `wss://<backend>/ws/agent`.

### Flow

```
Doctor speaks → Browser mic → WebSocket (audio bytes) → Backend
Backend → Gemini Live API (bidirectional audio stream)
Gemini → calls tool functions (Python async) → reads/writes Firestore
Gemini → sends audio response bytes back → WebSocket → Browser speaker
```

### Tools (`backend/app/agent/tools.py`)

| Tool | Description |
|---|---|
| `search_patient_in_queue(clinic_id, doctor_id, patient_name)` | Searches today's queue by name; always returns queue head patient |
| `get_patient_info(clinic_id, patient_id)` | Full patient history + all prescriptions |
| `update_prescription(clinic_id, patient_id, ...)` | Create or update draft Rx (complaints, diagnosis, meds, tests, followUp, notes) |
| `finalize_prescription(clinic_id, patient_id)` | Lock Rx as final, mark appointment completed, set `printQueued: true` |

### Adding a New Tool

1. Write an `async def my_tool(clinic_id, doctor_id, ...) -> str` in `tools.py`
2. Register it in `main.py` — add to the `tools` list passed to the Gemini client config
3. Add a handler in the `tool_call` dispatch block in `main.py`
4. The agent's `INSTRUCTION` prompt in `agent.py` should describe when to call it

---

## Production Deployment

### Backend → Railway

```bash
cd backend
railway up        # deploys from current directory using railway.toml
```

`railway.toml` sets the start command:
```toml
[deploy]
startCommand = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"
```

Required Railway environment variables: same as local `.env` above.

### Frontend → Vercel

```bash
cd frontend
vercel --prod --yes
```

Or push to `main` branch — Vercel auto-deploys on every push if connected to GitHub.

### Full Deployment Walkthrough

See `RAILWAY_DEPLOY.md` in the project root for the complete step-by-step including Firebase Auth domain setup, CORS config, and platform admin claim setup.

### Re-deploy After Code Changes

```bash
# From project root
git add -A && git commit -m "your message" && git push origin main

# Backend
cd backend && railway up --detach

# Frontend
cd frontend && vercel --prod --yes
```

---

## Auth Flow

1. User visits `/login`, clicks **Continue with Google**
2. Firebase Auth completes Google OAuth → `user.uid` available client-side
3. Frontend calls `POST /api/auth/link` with Firebase ID token in `Authorization: Bearer` header
4. Backend verifies token, looks up email in Firestore doctors/staff collections
5. Backend sets custom claims: `{ role, clinicId, doctorId? }` via Firebase Admin SDK
6. Frontend forces token refresh → claims available in `useAuth()` context
7. User is redirected to `/dashboard`

**Platform admin** uses email+password auth (created once via `set_admin.py` script). No `/api/auth/link` call needed — claims are pre-set.
