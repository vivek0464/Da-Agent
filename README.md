# Doctor Voice Assistant

A full-stack voice-powered clinic management platform with Next.js frontend, FastAPI backend, Google ADK + Gemini Live API for voice streaming, Firebase Firestore for data, and MSG91 for SMS.

---

## Project Structure

```
Da-Agent/
├── backend/           # FastAPI backend
│   ├── app/
│   │   ├── main.py            # FastAPI entry point + WebSocket voice endpoint
│   │   ├── firebase_admin.py  # Firebase Admin SDK init
│   │   ├── dependencies.py    # Auth dependency injection
│   │   ├── models/            # Pydantic models
│   │   ├── services/          # Firestore service layer
│   │   ├── routers/           # FastAPI routers
│   │   └── agent/             # Google ADK agent + tools
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/          # Next.js 14 frontend
    ├── app/
    │   ├── (auth)/login/      # Login page
    │   ├── (admin)/           # Authenticated dashboard area
    │   │   ├── layout.tsx     # Sidebar layout + VoiceButton
    │   │   ├── dashboard/     # Live queue dashboard
    │   │   ├── appointments/  # Drag-drop queue management
    │   │   ├── patients/      # Patient records CRUD
    │   │   ├── prescriptions/ # Prescription editor + print
    │   │   └── admin/         # Platform admin (clinics/doctors)
    │   ├── (public)/book/[clinicId]/  # Public patient booking page
    │   ├── components/
    │   │   ├── ui/            # shadcn/ui base components
    │   │   ├── voice-button.tsx        # Gemini Live API voice UI
    │   │   ├── prescription-editor.tsx # Rich prescription editor
    │   │   └── prescription-print.tsx  # Print-ready prescription view
    │   └── lib/
    │       ├── firebase.ts    # Firebase client SDK
    │       ├── api.ts         # Auth-injecting API utility
    │       ├── auth-context.tsx
    │       └── utils.ts
    ├── package.json
    └── .env.local.example
```

---

## Quick Start

### Backend

```bash
cd backend

# Create a virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and fill in:
#   GEMINI_API_KEY, FIREBASE_SERVICE_ACCOUNT_PATH, MSG91_AUTH_KEY, etc.

# Run the server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.local.example .env.local
# Edit .env.local and fill in Firebase client SDK credentials

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Path to Firebase service account JSON |
| `MSG91_AUTH_KEY` | MSG91 SMS auth key |
| `MSG91_SENDER_ID` | MSG91 sender ID |
| `MSG91_TEMPLATE_ID` | MSG91 template ID |
| `FRONTEND_URL` | Frontend URL for CORS |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase app ID |
| `NEXT_PUBLIC_API_URL` | Backend API URL (default: `http://localhost:8000`) |
| `NEXT_PUBLIC_WS_URL` | Backend WebSocket URL (default: `ws://localhost:8000`) |

---

## Key Features

- **Live Queue Dashboard** — Real-time Firestore listener for today's appointments
- **Drag-Drop Queue** — Reorder patient queue with `@dnd-kit`
- **Patient Records** — Full CRUD with search
- **Prescription Editor** — Structured Rx with complaints, diagnosis, medications, tests; finalize + print
- **Voice Assistant** — Floating mic button streams audio via Web Audio API → WebSocket → Gemini Live API → agent tools
- **Public Booking** — Patients scan QR code → select doctor/slot → SMS confirmation
- **Platform Admin** — Create clinics, add doctors, manage availability

## Voice Safety

The ADK agent **never exposes delete operations** — it can only create, read, and update records.
