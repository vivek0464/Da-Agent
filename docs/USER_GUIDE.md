# User Guide — Dia (Doctor Assistant)

Complete onboarding and usage guide for Platform Admins, Doctors, Staff, and Patients.

---

## Table of Contents
1. [Platform Admin — Setup and Clinic Management](#platform-admin)
2. [Doctor — Daily Workflow](#doctor)
3. [Staff — Daily Workflow](#staff)
4. [Patient — Self Registration](#patient)

---

## Platform Admin

The Platform Admin is the system owner. They create and manage all clinics on the platform.

### First Login

1. Go to the platform URL (e.g. `https://your-app.vercel.app/login`)
2. Click **"Sign in with email & password"** (collapsed link at the bottom of the form)
3. Enter your admin email and password
4. You land on the **Dashboard** with a **Platform Admin** link in the sidebar

> Platform admin credentials are created once during initial setup — they are not created through the UI.

---

### Creating a New Clinic

1. Click **Platform Admin** in the left sidebar
2. Click **New Clinic**
3. Fill in:
   - **Clinic Name** — displayed on patient registration page and prescriptions
   - **Address** — appears on prescription prints
   - **Phone** — appears on prescription prints
   - **URL Slug** — unique short name for the public link (e.g. `city-hospital`)
   - **First Doctor's Name, Email, Specialization, Phone** — the doctor who will manage this clinic
4. Click **Create Clinic + Doctor**

What happens automatically:
- Clinic is created in the database
- Doctor record is created and linked to the clinic
- A public registration page is live at `platform.com/clinic/{slug}`
- A QR code is generated pointing to that page — print and place it at the clinic reception

---

### Adding More Doctors or Staff to an Existing Clinic

Platform admins do not manage doctors/staff beyond initial setup. This is done by the **doctor** of that clinic via the **Clinic Admin** panel. See the Doctor section below.

---

### Managing Existing Clinics

From the Platform Admin page you can:
- View all clinics and their doctor list
- Edit clinic details (name, address, phone, slug)
- Remove a clinic

---

## Doctor

### First Login

1. Go to `https://your-app.vercel.app/login`
2. Click **Continue with Google**
3. Sign in with the Google account whose email matches what the admin registered you with
4. The system automatically links your Google account to your clinic
5. You land on the **Dashboard** showing your clinic and today's queue

> If you see "No doctor found for this email" — contact your platform admin. Your registered email may not match your Google account email.

---

### Setting Up Availability (Do This First)

Before patients can register, you need to set your available hours so the system can calculate estimated appointment times.

1. Click **Clinic Admin** in the sidebar
2. Click the **Schedule** tab
3. Select your doctor name
4. Under **Recurring Weekly Schedule**, toggle on the days you work and set start/end times for each slot
   - Example: Monday 9:00 AM – 1:00 PM, Wednesday 9:00 AM – 1:00 PM
5. To override a specific date (holiday, special hours), use the date-specific override section
6. Click **Save**

Patients registering on any day will now see your slots and receive an estimated time based on their queue position.

---

### Dashboard Overview

After login you see the **Dashboard** with:
- Total patients today
- Pending / in-progress / completed appointment counts
- Quick navigation in the left sidebar

---

### Managing the Appointment Queue

Click **Appointments** in the sidebar.

**Active Queue (top section):**
- Shows all scheduled and in-progress appointments for today
- Each card shows: queue number, patient name, phone, wait time estimate, payment status, status badge

**Actions per appointment:**
- **Start** — moves status from "scheduled" to "in-progress"
- **Done** — moves status to "completed"; appointment disappears from active queue and appears in Completed section
- **Cancel** — marks appointment as cancelled
- **Drag handle (⠿)** — drag rows up or down to reprioritize the queue
- **Trash icon** — removes patient from queue (patient record is not deleted)
- **Paid / Unpaid badge** — click to toggle payment status

**Completed Today (bottom section, green):**
- Read-only list of all appointments marked done today
- Shows payment status for billing reference

**Date filter:** Use the date picker (top right) to view a different day's queue.

---

### Using the AI Voice Agent

The mic button (bottom-right corner) activates the voice agent powered by Google Gemini.

**How to use:**

1. Click the mic button — it turns red, indicating it's listening
2. Speak naturally to the agent
3. The agent responds with voice and makes changes in the dashboard in real-time
4. Click mic again to stop

**What you can say:**

| Spoken command | What happens |
|---|---|
| "Search for Ramesh" | Agent looks up "Ramesh" in today's queue and tells you their details |
| "What's the queue head?" | Agent tells you the next patient in line |
| "Patient has fever for 3 days and cough" | Agent records complaints on the current patient's prescription |
| "Diagnosis is viral fever" | Agent records diagnosis |
| "Prescribe paracetamol 500mg twice daily for 5 days" | Agent adds medication to the prescription |
| "Order CBC and LFT tests" | Agent adds lab tests to the prescription |
| "Follow up in 1 week" | Agent records follow-up instruction |
| "Finalize" | Agent locks prescription as final, marks appointment done, sends to print queue |

**Tips:**
- You can chain commands: "Diagnosis is hypertension. Prescribe amlodipine 5mg once daily for 30 days. Follow up in 1 month. Finalize."
- The prescription editor on screen updates live as you speak — you can verify
- If the agent mishears something, edit the prescription manually in the editor and then say "Finalize" to complete

---

### Prescriptions Page

Click **Prescriptions** in the sidebar.

- Left panel: list of prescriptions filtered by date range and searchable by patient name
- Right panel: full prescription editor for the selected prescription
- **New Rx button** — create a blank prescription for a patient
- **Finalize button** — lock prescription as final and send to print queue
- **Print button** — open browser print dialog for the selected prescription
- Draft prescriptions are editable; Final prescriptions are read-only

---

### Print Queue Page

Click **Print Queue** in the sidebar.

Shows all prescriptions finalized (by agent or manually) that have not yet been printed.
Doctors can also print from here, but this page is primarily for pharmacy staff.

---

### Adding Doctors and Staff (Clinic Admin)

Click **Clinic Admin** in the sidebar. Only doctors have access to this page.

**Doctors tab:**
- Click **Add Doctor** → enter name, email, specialization, phone → Save
- The doctor signs in with Google (matching email) → auto-linked to clinic

**Staff tab:**
- Click **Add Staff** → enter name and email → Save
- The staff member signs in with Google (matching email) → auto-linked as staff

**Schedule tab:**
- Set availability slots per doctor (see Setting Up Availability above)

---

### Switching Between Doctors (Multi-Doctor Clinics)

If your clinic has multiple doctors:
- A **doctor switcher dropdown** appears below the navigation in the sidebar
- Select a different doctor to view their queue, prescriptions, and print queue
- Staff also see this switcher to manage any doctor's queue

---

### Language Toggle

Click the 🌐 button in the sidebar footer to switch between **English** and **हिन्दी**.
The preference is saved in your browser and persists across sessions.

---

## Staff

### First Login

1. Go to `https://your-app.vercel.app/login`
2. Click **Continue with Google**
3. Sign in with the Google account email your doctor/admin registered you with
4. You land on the **Dashboard** with staff-level access

Staff can see: Dashboard, Appointments, Patients, Prescriptions, Print Queue.
Staff cannot see: Clinic Admin (doctor-only).

---

### Daily Workflow

#### Morning: Queue Setup
- Open **Appointments**
- Confirm today's date is selected
- As patients arrive, mark them as present (no separate check-in UI — their status updates as doctor starts consultation)

#### During Consultations: Payment Management
- When a patient pays, click the **Unpaid** badge on their queue card — it flips to **Paid**
- This is visible in real-time to everyone on the dashboard

#### Queue Reordering
- If a patient needs to be seen earlier (emergency, scheduled appointment), drag their queue card to the top using the **⠿** handle on the left

#### Printing Prescriptions (Print Queue)
1. Click **Print Queue** in the sidebar
2. Select the doctor from the switcher (if clinic has multiple doctors)
3. New prescriptions appear automatically as the doctor finalizes them
4. **To print one prescription:** click the **Print** button on that row → browser print dialog opens → confirm → prescription is automatically removed from queue
5. **To print multiple:** check the boxes next to each prescription → click **Print Selected** → they print one by one; each is removed after printing
6. **Mark Printed (without printing):** check boxes → click **Mark Printed** → removes from queue without opening print dialog (for manual handling)

> Patient collects their printed prescription from the staff/pharmacy counter.

#### Removing a Patient from Queue
- Click the **trash icon** on an appointment card
- Confirm the removal dialog
- The patient record is preserved; only the queue entry is deleted

---

### Viewing Patient History

Click **Patients** in the sidebar to search and view any patient's full visit and prescription history.

---

## Patient

Patients do not need to create an account or install anything.

### Registering and Joining the Queue

1. **Scan the QR code** at the clinic reception (or get the direct link from reception staff)
2. A registration page opens in your browser
3. Select your **doctor** from the list shown
4. The page shows the doctor's **available hours** for today
5. Fill in your details:
   - Full name
   - Phone number
   - Age
   - Gender
6. Click **Register**
7. You receive a confirmation showing:
   - Your **queue number**
   - **Estimated appointment time** — calculated based on patients ahead of you (5 minutes per patient)
   - The doctor's name

### What to Do Next

- Note your estimated time
- Arrive at the clinic around your estimated time
- Show your queue number to reception if needed
- Wait to be called by the doctor

### Collecting Your Prescription

- After your consultation, the doctor finalizes your prescription digitally
- Go to the **pharmacy/reception counter**
- Staff will have your prescription ready to print and hand over

### If the Queue is Running Late

The estimated time shown at registration is an estimate based on the queue at that moment. The actual time may vary. You can re-scan the QR code at the clinic to re-register if you missed your slot (subject to clinic policy).
