# Railway + Vercel Deployment — Step by Step

## Prerequisites
- GitHub repo with this code pushed
- Firebase project already configured (Firestore + Auth)
- `vivek.iitg0464@gmail.com` already has `platform_admin` claim (via `set_admin.py`)

---

## Part 1 — Backfill Existing Doctors (Run Once Before Deploy)

Your 2 existing clinics have doctors with old email+password Firebase Auth accounts.
Delete those so they can use Google Sign-In cleanly:

```bash
cd backend
source venv/bin/activate

# Preview what will happen
python backfill_doctors.py --dry-run

# Delete old Firebase Auth accounts (doctors will use Google sign-in from now)
python backfill_doctors.py
```

> ⚠️ This deletes the doctor's old email+password Firebase Auth account.
> They will sign in with **Google** (same email) and get their claims automatically.

---

## Part 2 — Firebase Console (Required for Google Sign-In)

1. Go to https://console.firebase.google.com → your project
2. **Authentication → Sign-in method**
   - Enable **Google** provider
   - Add your email: `vivek.iitg0464@gmail.com` as a support email
3. **Authentication → Settings → Authorized domains**
   - Add: `your-app.vercel.app` (you'll get this URL after Step 4)
   - For local dev `localhost` is already authorized

---

## Part 3 — Deploy Backend to Railway

### 3a. Create Railway project
1. Go to https://railway.app → **New Project → Deploy from GitHub repo**
2. Select this repo
3. Set **Root Directory** → `backend`
4. Railway will detect Python via `railway.toml` — click **Deploy**

### 3b. Set Environment Variables
In Railway → your service → **Variables** tab, add each one:

| Variable | Value |
|---|---|
| `GEMINI_API_KEY` | From https://aistudio.google.com/apikey |
| `FIREBASE_PROJECT_ID` | From Firebase Console → Project Settings |
| `FIREBASE_CLIENT_EMAIL` | From `serviceAccount.json` → `client_email` |
| `FIREBASE_PRIVATE_KEY` | From `serviceAccount.json` → `private_key` (paste the whole thing including `-----BEGIN...-----`) |
| `CORS_ORIGINS` | `https://your-app.vercel.app` (update after Vercel deploy) |
| `PLATFORM_URL` | `https://your-app.vercel.app` (same — update after Vercel deploy) |
| `GEMINI_LIVE_MODEL` | `gemini-2.5-flash-native-audio-preview-12-2025` |

> **FIREBASE_PRIVATE_KEY tip**: In Railway, paste the key value exactly as it appears in the JSON file. The newlines (`\n`) will be handled correctly.

### 3c. Get your backend URL
After deploy: copy `https://your-service.railway.app` from the Railway dashboard.

---

## Part 4 — Deploy Frontend to Vercel

### 4a. Create Vercel project
1. Go to https://vercel.com → **New Project → Import Git Repository**
2. Select this repo
3. Set **Root Directory** → `frontend`
4. Framework: **Next.js** (auto-detected) → **Deploy**

### 4b. Set Environment Variables
In Vercel → your project → **Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Console → Project Settings → Web app → `apiKey` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `your-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `your-project-id` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `your-project.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | from Firebase web app config |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | from Firebase web app config |
| `NEXT_PUBLIC_API_URL` | `https://your-service.railway.app` |
| `NEXT_PUBLIC_WS_URL` | `wss://your-service.railway.app` |
| `NEXT_PUBLIC_PLATFORM_URL` | `https://your-app.vercel.app` |

### 4c. Redeploy
After adding env vars → **Deployments → Redeploy** (latest deployment).

### 4d. Update Railway CORS + PLATFORM_URL
Now that you have your Vercel URL, go back to Railway and update:
- `CORS_ORIGINS` → `https://your-app.vercel.app`
- `PLATFORM_URL` → `https://your-app.vercel.app`

Then Railway will auto-redeploy.

---

## Part 5 — Verify the Platform Admin Login

1. Open `https://your-app.vercel.app/login`
2. Click **"Sign in with email & password"** (the collapsed link at the bottom)
3. Enter `vivek.iitg0464@gmail.com` + your password
4. You should land on `/dashboard` with **Platform Admin** in the sidebar
5. Navigate to **Platform Admin** to see your 2 existing clinics

---

## Part 6 — Verify Doctor Google Sign-In

After running `backfill_doctors.py`, each doctor:
1. Opens `https://your-app.vercel.app/login`
2. Clicks **Continue with Google**
3. Signs in with their Google account (matching the email you registered them with)
4. The app automatically calls `/api/auth/link` → assigns `clinicId` + `doctorId` claims
5. Token refreshes → they land on their clinic dashboard

**If a doctor sees "No doctor found for this email"**: their email in Firestore doesn't match their Google account email. Fix:
```bash
cd backend
python link_google_doctor.py --clinic <clinic_id> --list  # see emails
# Then update the Firestore doctor record's email to match their Google email
```

---

## Part 7 — Create New Clinics (Post-Deploy)

1. Log in as platform admin → **Platform Admin** tab
2. Click **New Clinic** → fill clinic details + first doctor's Google email
3. Click **Create Clinic + Doctor**
4. A QR code is auto-generated pointing to `{PLATFORM_URL}/clinic/{slug}`
5. The patient page is **immediately live** — no additional steps

---

## Summary of Auth Flows

| User | How to sign in | What happens |
|---|---|---|
| Platform admin (you) | Email + password (expand the form on login page) | Direct to dashboard |
| Doctor | Google Sign-In | Auto-link assigns clinic/doctor claims → dashboard |
| Staff | Google Sign-In | Auto-link assigns clinic/staff claims → read-only view |
| Patient | No sign-in — scan QR | Opens `/clinic/{slug}` directly |

---

## Troubleshooting

**Backend 500 on `/api/auth/link`**: Check Railway logs — usually means `FIREBASE_PRIVATE_KEY` has formatting issues. Ensure the key is pasted as a single string with literal `\n` characters.

**Google Sign-In popup blocked**: Firebase Auth domain not in authorized list. Add `your-app.vercel.app` in Firebase Console → Auth → Authorized Domains.

**CORS error from frontend**: Update `CORS_ORIGINS` in Railway to include your Vercel URL exactly (no trailing slash).

**"auth/account-exists-with-different-credential"**: Means the doctor still has an old email/password Firebase Auth account. Re-run `python backfill_doctors.py` to delete it.
