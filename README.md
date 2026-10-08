# Mandala & Ikigai — Google Drive primary storage

This is a GitHub/Vercel-ready website. Registered adults log in through **Supabase Auth**; their Mandala charts are stored as private JSON files in **the website owner's Google Drive** via authenticated Vercel API functions. **Supabase is for identity only, not chart storage.** Guest editing remains browser-local.

## 1. Create Supabase authentication
1. Create a Supabase project.
2. Under Authentication > Providers, enable email/password and email confirmations; disable anonymous sign-in.
3. Set authentication Site URL to your Vercel URL and allow its redirect URL.
4. Copy the project URL and **public anon/publishable** key into `config.js`. **Never put `service_role`, Google secrets or passwords into `config.js`.**
5. No SQL schema is necessary for charts: Google Drive is the primary data store.

## 2. Connect Google Drive (owner's account)
1. In Google Cloud Console create/select a Google Cloud project; enable **Google Drive API**.
2. Configure the OAuth consent screen and an OAuth 2.0 client. For initial private testing add **your Google account** to OAuth test users.
3. Grant the **`https://www.googleapis.com/auth/drive.file`** scope; obtain an OAuth **refresh token for the owner's account** using your OAuth client. This token must be obtained through a proper Google OAuth authorization flow (for example Google's OAuth Playground configured with your own OAuth client ID/secret). Enable offline access and approve consent.
4. In Vercel Project > Settings > Environment Variables, define:
   - `GOOGLE_CLIENT_ID` — Google OAuth client ID
   - `GOOGLE_CLIENT_SECRET` — Google OAuth client secret
   - `GOOGLE_REFRESH_TOKEN` — owner Google account refresh token
   - `SUPABASE_URL` — same Supabase project URL
   - `SUPABASE_ANON_KEY` — public project anon key used only for verifying sessions
5. Redeploy after adding environment variables.
6. Files created by the site will appear as private `mandala-<user-id>-<template>.json` files in the owner's My Drive. **Do not share that folder/files publicly.** Under the drive.file scope the app can manage files it created. The owner retains access to all saved charts.

**OAuth caution:** Refresh tokens issued to external OAuth apps while their consent screen is in **Testing** mode can expire after 7 days. For long-term use, review Google's OAuth verification and publishing requirements, or move to a verified configuration. Do not commit refresh tokens to GitHub or paste them in chats.

## 3. Deploy
1. Upload the ZIP contents to a GitHub repository (root `index.html`, `api/chart.js`, `config.js`, and `package.json`).
2. Import repository at https://vercel.com/new (Other framework; root directory `/`). Vercel detects `/api/chart.js`.
3. Add environment variables listed above, then deploy.
4. Test on the deployed domain with two **different verified adult accounts**; ensure no user can read or delete another user's charts. Test saving, reloading, switching the 3 templates, logout, deleting saved charts, and a fresh browser.

## Privacy and tester limitations
- **Adults only**: the registration form indicates 18+; age isn't identity verified on this trial. Do NOT onboard minors without a real age/guardian consent process, policy reviews and protections.
- User passwords are managed by Supabase Auth; the server requires a valid verified Supabase session for Drive operations and uses its user ID to find/create individual chart files.
- **Your Google Drive owner account holds all users' private goal data.** The owner can read those files. Disclose this clearly to testers and publish a privacy notice, retention/deletion policy and contact method before collecting real personal data.
- The guest demo uses unencrypted browser `localStorage`. Registered charts load from Google Drive and are not intentionally saved in localStorage by this version. A user can still manually export/download charts.
- The website owner must protect their Google account with MFA, restrict access to credentials, monitor Drive storage quotas and Google/Vercel usage charges, and arrange backup/export procedures.
- Deleting a chart removes the app-created Drive file for that template, but Google Drive trash/version/history and independent backups may affect retention. Account deletion is a separate owner-admin process.
- No teacher/admin features, actual OpenAI coaching, actual Google Calendar connection, or Canva API editing are implemented yet. **Vercel + Google Drive account configuration is required; opening `index.html` locally only enables guest mode.**
- Autosave uses last-write-wins. Avoid editing the same account/chart concurrently in several tabs/devices; a future release should add version conflict checks.
- For stronger defense before public launch add abuse throttling, monitoring, consent collection, account removal automation, and independently review security.
