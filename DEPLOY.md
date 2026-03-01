# Dia — Deployment Guide

## Architecture

```
Patient QR scan → https://dia-clinic.vercel.app/clinic/{slug}   (Next.js on Vercel — free)
Doctor dashboard  → https://dia-clinic.vercel.app/dashboard       (same app, Google Auth)
Backend API       → https://dia-backend.railway.app               (FastAPI on Railway — free tier)
Database          → Firebase Firestore                             (Spark free plan)
Auth              → Firebase Authentication                        (free)
AI voice          → Gemini Live API (Google AI Studio key)
```

---

## Step 1 — Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com) → your project.
2. **Firestore**: Enable in Native mode (already done if you have data).
3. **Authentication** → Sign-in method → Enable **Google** provider.
   - Add your production domain to "Authorized domains":
     `dia-clinic.vercel.app` (or your Vercel URL once deployed)
4. **Service Account** (for backend):
   - Project Settings → Service accounts → Generate new private key → download JSON.
   - You'll use this for backend env vars.

---

## Step 2 — Backend Hosting Options

### Option A: Fly.io (recommended — truly free, always-on, WebSocket support)

```bash
# Install flyctl: brew install flyctl
cd backend
fly auth login
fly launch --name dia-backend --region sin --no-deploy  # sin = Singapore; use bom for Mumbai
fly secrets set \
  GEMINI_API_KEY=your_key \
  FIREBASE_PROJECT_ID=your_id \
  FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n" \
  FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com \
  CORS_ORIGINS=https://dia-clinic.vercel.app \
  PLATFORM_URL=https://dia-clinic.vercel.app \
  GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio-preview-12-2025
fly deploy
```

Your backend URL: `https://dia-backend.fly.dev`

> Free tier: 3 shared VMs, 256 MB RAM, always-on (no sleep). WebSockets work. `fly.toml` is already configured.

---

### Option B: Railway (~$5 credit/mo)

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo.
2. Select this repo → set **Root Directory** to `backend`.
3. Railway auto-detects Python via `railway.toml`.

### Environment variables (set in Railway dashboard)
```
GEMINI_API_KEY=your_google_ai_studio_key
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
CORS_ORIGINS=https://dia-clinic.vercel.app
PLATFORM_URL=https://dia-clinic.vercel.app
GEMINI_LIVE_MODEL=gemini-2.5-flash-native-audio-preview-12-2025
```

> **Note on FIREBASE_PRIVATE_KEY**: In Railway, paste the raw key with literal `\n` — Railway handles the newlines. Alternatively upload the full `serviceAccount.json` as a file secret and set `FIREBASE_SERVICE_ACCOUNT_PATH=/app/serviceAccount.json`.

### Get your backend URL
After deploy: `https://dia-backend-<random>.railway.app`
Copy it — you'll need it for the frontend.

---

## Step 3 — Frontend on Vercel (free)

### Create project
1. Go to [vercel.com](https://vercel.com) → New Project → Import from GitHub.
2. Set **Root Directory** to `frontend`.
3. Framework: **Next.js** (auto-detected).

### Environment variables (set in Vercel dashboard)
```
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_web_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_API_URL=https://dia-backend-<random>.railway.app
NEXT_PUBLIC_WS_URL=wss://dia-backend-<random>.railway.app
```

### Update vercel.json rewrite
Edit `frontend/vercel.json` and replace `your-backend.railway.app` with your actual Railway URL.

### Custom domain (optional)
- In Vercel project settings → Domains → add a free `.vercel.app` subdomain like `dia-clinic`.
- Or connect your own domain.

---

## Step 4 — QR Code URL

The QR code for each clinic automatically points to:
```
{PLATFORM_URL}/clinic/{slug}
```

For example: `https://dia-clinic.vercel.app/clinic/city-medical-clinic`

This URL is generated when you **create a clinic** via the Platform Admin panel.
To regenerate QR codes for existing clinics, you can patch them via the API or re-create them.

---

## Step 5 — Onboarding Doctors with Google Sign-In

Doctors sign in with **Google** (no password needed).

### Flow
1. Doctor signs in with Google at `/login` for the first time.
2. Their account is created in Firebase Auth but has no clinic claims yet → they see the dashboard but with no data.
3. You (platform admin) link their Google account to the correct doctor record:

```bash
cd backend
# List doctors in a clinic
python link_google_doctor.py --clinic <clinic_id> --list

# Link by email (doctor's Google email)
python link_google_doctor.py --email doctor@gmail.com --clinic <clinic_id> --doctor <doctor_id>

# Or by Firebase UID (find in Firebase Console → Authentication)
python link_google_doctor.py --uid abc123xyz --clinic <clinic_id> --doctor <doctor_id>
```

4. Doctor signs out and signs back in → custom claims load → they see their clinic dashboard.

### For Staff
Same process with `--staff` instead of `--doctor`:
```bash
python link_google_doctor.py --email staff@gmail.com --clinic <clinic_id> --staff <staff_id>
```
Staff get read-only access (no voice assistant).

---

## Step 6 — Add First Clinic

1. Log in as platform admin (set via `python set_admin.py <uid>`).
2. Go to `/admin` → Create Clinic (name, address, phone).
3. A QR code is auto-generated pointing to `{PLATFORM_URL}/clinic/{slug}`.
4. Print and display the QR code in the clinic waiting area.

---

## Free Tier Limits

| Service | Free Limit | Notes |
|---------|-----------|-------|
| Vercel | Unlimited deploys, 100GB bandwidth/mo | More than enough |
| Railway | $5 credit/mo (~500 hours) | Sufficient for 1 clinic; upgrade for more |
| Firebase Firestore | 1GB storage, 50K reads/day, 20K writes/day | Fine for small clinics |
| Firebase Auth | 10K/month Google sign-ins | More than enough |
| Gemini Live API | Pay-per-use (AI Studio key) | Not free — keep usage minimal |

> **Render alternative**: If Railway credit runs out, deploy backend to [render.com](https://render.com) using `backend/render.yaml`. Free tier sleeps after 15 min of inactivity (adds ~30s cold start).

---

## CORS & Security Notes

- The public `/clinic/{slug}` and `/api/register/*` endpoints are intentionally unauthenticated — they are patient-facing.
- All doctor/staff API calls go through `require_auth` middleware (Firebase ID token verification).
- The Gemini WebSocket at `/ws/voice/*` requires a valid Firebase token passed as a query param.
- `serviceAccount.json` is in `.gitignore` — never commit it. Use env vars in production.
