# Product Overview — Dia (Doctor Assistant)

**Current version:** March 2026  
**Status:** Live in production (Railway + Vercel)

---

## What is Dia?

Dia is a voice-first clinic management platform that lets doctors manage patient queues, dictate prescriptions hands-free using an AI agent, and coordinate with pharmacy/front-desk staff — all from a single dashboard. Patients self-register via QR code and are automatically assigned a queue position with an estimated consultation time.

---

## Core User Roles

| Role | Description |
|---|---|
| **Platform Admin** | Creates and manages clinics; one per deployment |
| **Doctor** | Manages their queue, dictates prescriptions via AI agent |
| **Staff** | Manages queue, prints prescriptions from print queue, marks payments |
| **Patient** | Self-registers via QR code link; no login required |

---

## Feature Status

### ✅ Multi-Tenant Clinic Management
- Platform admin creates clinics with a name, address, phone, and unique URL slug
- Each clinic gets a public QR code pointing to `platform.com/clinic/{slug}` for patient self-registration
- Multiple doctors per clinic supported; staff can be assigned per clinic

### ✅ Patient Self-Registration (Public Page)
- Patients scan clinic QR code → open a page in their browser (no app download, no login)
- Select doctor from the available list
- Enter: name, phone, age, gender
- System automatically assigns a **queue position** and calculates an **estimated appointment datetime** based on the doctor's availability slots
- Slot-based time calculation:
  - 5 minutes per patient ahead in queue
  - If estimated time overflows first slot, system offers second available slot
  - Never schedules beyond 2 hours after last slot; never pushes to next day
- Confirmation screen shows queue number and estimated time
- Doctor's available slots for the day are displayed on the registration page

### ✅ Live Appointment Queue
- Real-time queue display (Firestore `onSnapshot` — updates instantly across all browsers)
- Queue shows: patient name, phone, queue position, estimated wait time, payment status
- **Status flow:** scheduled → in-progress → completed
- **Actions:**
  - Start / Done buttons advance the status
  - Cancel button marks appointment cancelled
  - Remove button deletes from queue (patient record preserved)
  - Payment toggle (Paid / Unpaid) per appointment
- **Drag-and-drop reorder:** staff and doctors can drag entries to reprioritize
- Queue reorder persists to Firestore and recalculates positions

### ✅ Completed Appointments Section
- Appointments marked "done" are automatically removed from the active queue
- They appear in a separate **"Completed Today"** section below the active queue
- Completed section shows patient name, phone, queue number, payment status
- No manual action needed — Firestore real-time update handles the transition

### ✅ AI Voice Agent (Doctor Tool)
- Mic button in the bottom-right corner of the dashboard (visible to doctor role only)
- Doctor speaks naturally; agent understands clinic context
- **Agent capabilities:**
  - Search for a patient by name in today's queue
  - Look up patient's full history (previous visits, prescriptions)
  - Create or update a draft prescription: complaints, diagnosis, medications, tests, follow-up, notes
  - Finalize prescription: locks as "final", marks appointment as completed, adds to print queue
- Agent responds with voice and also reflects changes live in the prescriptions UI
- Fully hands-free: doctor never needs to touch a keyboard during consultation

### ✅ Prescription Management
- Prescription editor with structured fields: Patient Info, Complaints, Diagnosis, Medications (name/dose/frequency/duration/instructions), Lab Tests, Follow-up, Notes
- Real-time sync — changes made by the agent appear instantly in the editor
- Status: **Draft** (editable) → **Final** (locked, sent to print queue)
- Print button on any prescription triggers browser print dialog with formatted layout
- Search/filter by patient name and date range
- Prescriptions stored per clinic, visible to both doctor and staff

### ✅ Print Queue
- When agent (or staff) finalizes a prescription, it automatically appears in the **Print Queue** tab
- Print queue is **per doctor** — filtered by the currently selected doctor
- Real-time updates via Firestore listener
- **Staff/pharmacy actions:**
  - **Print single** — opens browser print dialog for one prescription; auto-marks as printed after
  - **Print selected (bulk)** — prints multiple prescriptions sequentially, marks each as printed
  - **Mark Printed** — clears from queue without printing (for manual handling)
- Prescriptions disappear from print queue once marked printed

### ✅ Doctor Availability Scheduling
- Clinic admin sets **recurring weekly slots** for each doctor (e.g., Mon–Fri 9 AM–12 PM)
- Can override specific dates with different hours or mark as unavailable
- Slots shown on the public patient registration page
- Slot data used by scheduling service to calculate estimated appointment times

### ✅ Clinic Admin Panel
- Doctor management: add/edit/remove doctors with name, email, specialization, phone
- Staff management: add/edit/remove staff members
- Availability editor: drag-to-configure weekly slots per doctor, date-specific overrides
- Accessible only to doctors of that clinic (not staff)

### ✅ Hindi / English Language Toggle
- Toggle button (🌐) in the sidebar footer
- Switches all static dashboard UI text between English and Hindi
- Preference persists in browser localStorage
- Translated: navigation, appointment page, prescriptions, print queue, clinic admin
- Dynamic content (clinic name, doctor name, patient name, agent voice) is unaffected

### ✅ Multi-Doctor View (Staff/Admin)
- Staff sees appointments across all doctors in the clinic
- Doctor switcher in sidebar lets any user filter queue/prescriptions by doctor
- Print queue also respects the doctor filter

---

## Data Architecture (Firestore)

```
clinics/{clinicId}
  ├── doctors/{doctorId}           name, email, specialization
  ├── staff/{staffId}              name, email, role
  ├── patients/{patientId}         name, phone, age, gender, visits
  ├── appointments/{id}            date, status, queuePosition, estimatedTime, paymentStatus
  ├── prescriptions/{id}           status, content, printQueued, printedAt
  └── availability/{id}            doctorId, recurring, slots[]
```

---

## What is NOT Yet Built

| Feature | Notes |
|---|---|
| Patient login / profile portal | Patients currently have no account |
| SMS / WhatsApp notification | No outbound messaging to patients yet |
| Billing / invoicing | Payment toggle exists but no invoice generation |
| Medicine inventory / pharmacy management | Print queue is the pharmacy touchpoint; no stock management |
| Multi-clinic staff (shared staff) | Staff is per-clinic only |
| Analytics / reporting | No dashboard analytics charts yet |
| Appointment booking (future slots) | Queue is walk-in only; no advance booking for future days from patient side |
| Lab test result tracking | Tests are documented in Rx but no result upload/tracking |
| Mobile app | Web only (responsive but not a native app) |

---

## Key Metrics / Flows

**Typical patient journey:**
1. Scan QR → register (< 1 min) → receive queue number + estimated time
2. Wait → arrive at clinic when time approaches
3. Doctor consultation (agent-assisted, voice-driven)
4. Doctor finalizes Rx → patient goes to pharmacy counter
5. Staff prints from Print Queue → patient collects prescription

**Typical staff shift start:**
1. Sign in → see today's queue
2. Mark payments as patients arrive
3. Reorder queue if needed (drag)
4. Monitor print queue for new prescriptions to print

---

## Integration Points

| System | Method | Purpose |
|---|---|---|
| Firebase Auth | Google OAuth + custom claims | Authentication for all roles |
| Firestore | REST + real-time listeners | All persistent data |
| Gemini Live API | WebSocket audio stream | AI voice agent |
| Browser Print API | `window.print()` | Prescription printing |
