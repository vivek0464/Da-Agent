## Doctor Voice Assistant — Implementation Plan

Full-stack voice-powered clinic management platform using Next.js, FastAPI, Firestore, Google ADK with Gemini Live API, and MSG91 for SMS.

---

### Tech Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14 (App Router), TailwindCSS, shadcn/ui, Lucide icons | Reactive, premium UI; easy deployment on Vercel |
| **Backend (CRUD)** | FastAPI (Python) | Fast, async, simple REST API |
| **Backend (AI Agent)**| Google ADK + Gemini Live API (bidi-streaming) | Single agent: voice conversation + function calling |
| **Database** | Firebase Firestore | Real-time listeners, no schema mgmt, Firebase Auth integration |
| **Auth** | Firebase Auth (email + phone) | Doctors & staff login; patients have no auth |
| **SMS** | MSG91 (can swap later) | Cheap India transactional SMS; simple REST API |
| **Prescription** | Structured JSON → React print-ready component | Agent fills structured fields; renders as professional medical doc |

---

### Repository Structure

```text
windsurf-project/
├── frontend/                   # Next.js app
│   ├── app/
│   │   ├── (public)/           # Patient-facing (no auth)
│   │   │   └── book/[clinicId]/ # Appointment booking page (QR target)
│   │   ├── (admin)/            # Clinic admin panel (auth required)
│   │   │   ├── dashboard/      # Overview
│   │   │   ├── appointments/   # Queue management (drag & drop)
│   │   │   ├── patients/       # Patient records
│   │   │   └── prescriptions/  # View/edit/print prescriptions
│   │   ├── (platform)/         # Platform owner admin
│   │   │   └── admin/          # Manage clinics, doctors, staff
│   │   ├── components/
│   │   │   ├── ui/             # shadcn/ui components
│   │   │   ├── voice-button.tsx # Floating voice assistant button
│   │   │   ├── prescription-editor.tsx
│   │   │   └── prescription-print.tsx
│   │   └── lib/
│   │       ├── firebase.ts     # Firebase client config
│   │       └── api.ts          # FastAPI client helpers
│   └── package.json
├── backend/                    # FastAPI + ADK agent
│   ├── app/
│   │   ├── main.py             # FastAPI app entry, CORS, routes
│   │   ├── routers/
│   │   │   ├── appointments.py
│   │   │   ├── patients.py
│   │   │   ├── prescriptions.py
│   │   │   ├── clinics.py      # Platform admin CRUD
│   │   │   └── availability.py
│   │   ├── services/           # Business logic
│   │   │   ├── appointment_service.py
│   │   │   ├── patient_service.py
│   │   │   ├── prescription_service.py
│   │   │   ├── clinic_service.py
│   │   │   └── sms_service.py  # MSG91 integration
│   │   ├── models/             # Pydantic models
│   │   ├── agent/
│   │   │   ├── agent.py        # ADK root agent definition
│   │   │   ├── tools.py        # Function tools (calls services directly)
│   │   │   └── streaming.py    # WebSocket handler for bidi voice
│   │   └── firebase_admin.py   # Firebase Admin SDK init
│   ├── requirements.txt
│   └── .env.example
├── project.md
└── README.md




Firebase Data Model


clinics/{clinicId}
  - name, address, phone, qrCodeUrl
  - createdAt, updatedAt

clinics/{clinicId}/doctors/{doctorId}
  - name, email, phone, role: "doctor"
  - firebaseUid

clinics/{clinicId}/staff/{staffId}
  - name, email, phone, role: "staff"
  - firebaseUid

clinics/{clinicId}/availability/{dateString}
  - doctorId, date, slots: [{start, end}]
  - recurring: boolean, dayOfWeek (for recurring templates)

clinics/{clinicId}/appointments/{appointmentId}
  - patientName, patientPhone, patientEmail
  - date, timeSlot, queuePosition
  - status: "scheduled" | "in-progress" | "completed" | "cancelled"
  - estimatedTime, doctorId
  - createdAt

clinics/{clinicId}/patients/{patientId}
  - name, phone, email, dateOfBirth, notes
  - createdAt, visits: count

clinics/{clinicId}/prescriptions/{prescriptionId}
  - patientId, doctorId, appointmentId, date
  - content: {                        # Structured JSON
      patientInfo: {},
      complaints: [],
      diagnosis: [],
      medications: [{name, dosage, frequency, duration}],
      tests: [],
      followUp: "",
      notes: ""
    }
  - status: "draft" | "final"
  - createdAt, updatedAt



Implementation Phases
Phase 1 — Foundation (scaffold + auth + data layer)

Initialize Next.js frontend with TailwindCSS + shadcn/ui

Initialize FastAPI backend with Firebase Admin SDK

Set up Firebase project config (Auth, Firestore rules)

Implement Firestore data models (Pydantic + Firebase Admin)

Platform admin: CRUD endpoints for clinics, doctors, staff

Firebase Auth integration (email + phone login for doctor/staff)

Phase 2 — Patient Booking Flow

Public appointment booking page ( /book/[clinicId] )

Mobile-first, clean form: name, phone (Indian), email, date/time picker

Fetch doctor availability, calculate estimated wait time

Show estimated time before submit

Doctor availability management in admin panel (recurring + per-day override)

Queue position assignment logic

Phase 3 — Clinic Admin Panel

Dashboard overview (today's appointments, queue)

Appointments page with drag-and-drop queue reordering

Patient records CRUD (search, view history)

Real-time Firestore listeners for live queue updates on frontend

Phase 4 — Prescription System

Prescription editor (structured form fields, real-time save to Firestore)

Prescription print view (professional medical document layout, one-click print)

Role-based access: staff cannot edit prescription content

Phase 5 — Voice AI Agent

ADK agent setup with Gemini Live API (bidi-streaming)

Define function tools: manage appointments, search patients, fill prescription, print prescription, check queue

WebSocket endpoint on FastAPI for voice streaming

Frontend voice button component (mic capture → WebSocket → ADK → response audio)

Agent has context of current page data (passed via session)

Agent instruction tuning for medical assistant persona

Phase 6 — Polish & Integration

SMS integration (MSG91) for appointment confirmations (pluggable, off by default)

QR code generation per clinic for booking page URL

Responsive design pass, premium styling

Error handling, loading states, edge cases

README with setup instructions, env vars, deployment guide

Key Design Decisions
Single ADK agent handles voice + function calling. Agent tools call backend service functions directly (same process), no HTTP overhead.

Frontend connects to Firestore directly for real-time UI updates (onSnapshot listeners). FastAPI handles writes + business logic.

Prescription stored as structured JSON, rendered into print-ready React component. Agent manipulates individual fields via function calls.

SMS is pluggable — designed behind an interface so MSG91 can be swapped later. Queue SMS deferred for now.

Voice assistant button is a floating component available on all admin pages. It opens a WebSocket to the FastAPI server which runs the ADK streaming session.

No delete operations exposed to voice agent (safety constraint per your requirement).

Platform admin is a simple page for managing clinics/doctors/staff — also voice-controllable.
