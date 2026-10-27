# Setup & Deployment Guide (Step-by-Step)

This guide walks you through setting up **Firebase** (Spark free plan) and **Netlify** from scratch, with zero prior experience required.

---

## 1. Create the Firebase Project & Enable Cloud Firestore

1. Go to [https://console.firebase.google.com/](https://console.firebase.google.com/) and sign in with your Google account.
2. Click **Create a project** (or **Add project**).
3. Enter a project name (for example, `englishtalk-latam`) and click **Continue**.
4. Disable **Google Analytics for this project** (we do not use analytics or trackers) and click **Create project**.
5. Once ready, in the left sidebar click **Build → Firestore Database**, then click **Create database**.
6. Choose **Standard edition**, select location **`southamerica-east1` (São Paulo)**, choose **Start in production mode**, and click **Create**.

---

## 2. Enable Firebase Authentication (Admin Only)

1. In the Firebase Console left sidebar, click **Build → Authentication**, then click **Get started**.
2. On the **Sign-in method** tab, click **Google**, toggle **Enable**, select your support email, and click **Save**.
3. Still under **Sign-in method**, click **Email/Password**, enable **Email/Password** and **Email link (passwordless sign-in)** (used as a fallback if Google Workspace blocks third-party popups), and click **Save**.
4. Go to **Authentication → Settings → Authorized domains** and verify `localhost` is listed. After Step 6, come back here and click **Add domain** to add your Netlify domain (`<your-site>.netlify.app`) and any custom domain you configure later.

---

## 3. Register the Web App & Firebase App Check (reCAPTCHA v3)

1. In the Firebase Console, click the gear icon ⚙️ (**Project Overview → Project settings**).
2. Scroll down to **Your apps** and click the Web icon **`</>`**.
3. Name the app `EnglishTalk Web` (leave Firebase Hosting unchecked) and click **Register app**.
4. Copy the `firebaseConfig` values (`apiKey`, `authDomain`, `projectId`, `appId`) — you will paste them into Netlify in Step 6:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`
5. For bot protection, open [https://www.google.com/recaptcha/admin/create](https://www.google.com/recaptcha/admin/create):
   - Label: `EnglishTalk`
   - Type: **Score based (v3)**
   - Domains: `localhost`, `<your-site>.netlify.app`
   - Submit and copy the **Site Key** and **Secret Key**.
6. In the Firebase Console left sidebar, click **Build → App Check → Apps**, click **Register** next to `EnglishTalk Web`, choose **reCAPTCHA v3**, paste the **Secret Key**, and click **Save**. (Save the **Site Key** for `VITE_APPCHECK_SITE_KEY`).
   - *Note:* By default `APP_CHECK_ENFORCEMENT=soft`, which never blocks legitimate students if a token fails on an old mobile browser — it simply applies the stricter IP rate limit tier.

---

## 4. Create the Service Account for Netlify Functions

1. In the Firebase Console, click the gear icon ⚙️ → **Project settings → Service accounts**.
2. Click **Generate new private key** → **Generate key**. A `.json` file will download to your computer (**never commit this file to Git**).
3. Open the downloaded `.json` file in a text editor and find these three fields:
   - `"project_id"` → `FIREBASE_PROJECT_ID`
   - `"client_email"` → `FIREBASE_CLIENT_EMAIL`
   - `"private_key"` → `FIREBASE_PRIVATE_KEY` (keep the `-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n` string intact).
   - *Why separate fields?* Netlify limits the total size of environment variables passed to serverless functions (4 KB limit), so storing only these 3 fields instead of the full JSON avoids hitting the limit.

---

## 5. Deploy Firestore Security Rules, Indexes & TTL Policy

From your terminal inside this repository:

1. Log in to Firebase and select your project:
   ```bash
   npx firebase-tools login
   npx firebase-tools use <your-firebase-project-id>
   ```
2. Deploy the security rules, composite indexes, and the `rateLimits.expiresAt` TTL policy defined in `firebase/firestore.indexes.json`:
   ```bash
   npx firebase-tools deploy --only firestore --config firebase/firebase.json --project <your-firebase-project-id>
   ```
   *(Firestore automatically activates the TTL cleanup policy on `rateLimits.expiresAt` within a few minutes of deployment).*

---

## 6. Connect the GitHub Repository to Netlify & Set Environment Variables

1. Log in to [https://app.netlify.com/](https://app.netlify.com/) and click **Add new site → Import an existing project**.
2. Choose **GitHub** and select the repository `danbuck84/ehlatamforms`.
3. Netlify automatically detects the settings from `netlify.toml`:
   - Build command: `pnpm build`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
4. Before or right after deploying, go to **Site configuration → Environment variables** and add:

   | Variable | Value |
   |---|---|
   | `VITE_FIREBASE_API_KEY` | From Step 3 (`apiKey`) |
   | `VITE_FIREBASE_AUTH_DOMAIN` | From Step 3 (`authDomain`) |
   | `VITE_FIREBASE_PROJECT_ID` | From Step 3 (`projectId`) |
   | `VITE_FIREBASE_APP_ID` | From Step 3 (`appId`) |
   | `VITE_APPCHECK_SITE_KEY` | Your reCAPTCHA v3 Site Key (optional while `APP_CHECK_ENFORCEMENT=soft`) |
   | `FIREBASE_PROJECT_ID` | From Step 4 (`project_id`) |
   | `FIREBASE_CLIENT_EMAIL` | From Step 4 (`client_email`) |
   | `FIREBASE_PRIVATE_KEY` | From Step 4 (`private_key`, marked as **Secret**) |
   | `ADMIN_EMAILS` | `daniel.buck@rocketseat.team` |
   | `SITE_ORIGIN` | `https://<your-site>.netlify.app` (no trailing slash) |
   | `APP_CHECK_ENFORCEMENT` | `soft` |
   | `HASH_PEPPER` | Output of `openssl rand -hex 32` (marked as **Secret**) |

5. To rename your Netlify subdomain, go to **Site configuration → General → Site details → Change site name** (e.g. `englishtalk`). To add a custom domain later, go to **Domain management → Add a domain**.
6. Deploy Previews on Pull Requests are enabled automatically under **Site configuration → Build & deploy → Continuous deployment → Deploy contexts**.

---

## 7. Create Your First Sessions from `/admin`

1. Open `https://<your-site>.netlify.app/admin` and click **Sign in with Google** using `daniel.buck@rocketseat.team`.
2. Under **Generate Tue/Thu Sessions (18:00–19:00 BRT)**, choose the starting Tuesday (e.g. `2026-10-27`) and number of weeks, deselect any holidays, and click **Generate Selected Sessions**.
3. Click any session in the list to set its **Conversation Topic** and **Secret Keyword** (or click **🎲 Suggest word**), then click **Save Session**.
4. During class, open the **Share** tab to display the permanent QR code on Zoom, or the **Live** tab for Projector Mode!

---

## 8. Rotating the Service-Account Key & Troubleshooting

- **Key rotation:** In Firebase Console → **Project settings → Service accounts**, click **Generate new private key**, update `FIREBASE_PRIVATE_KEY` and `FIREBASE_CLIENT_EMAIL` in Netlify → trigger a new deploy → delete the old key in Google Cloud IAM → Service Accounts.
- **Troubleshooting:**
  - *`unauthorized` on `/admin`*: Make sure your Google account email matches `ADMIN_EMAILS` (`daniel.buck@rocketseat.team`) and that your Netlify domain is added to **Firebase Console → Authentication → Settings → Authorized domains**.
  - *`FIREBASE_PRIVATE_KEY` parse error*: Paste the raw value from the JSON file (either with literal `\n` sequences or actual newlines — the server automatically normalizes `\\n` to `\n`).
