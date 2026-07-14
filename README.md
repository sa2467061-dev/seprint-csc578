# SePrint Kiosk

## Files
- `index.html` — markup only
- `styles.css` — all custom CSS (original styles + mobile fixes)
- `tailwind.config.js` — Tailwind CDN theme config
- `app.js` — Firebase + Supabase data logic (ES module)
- `ui.js` — view switching, dropzone, price calculator (no DB calls)
- `config.js` — your **real** Firebase/Supabase keys — **git-ignored, do not commit**
- `config.example.js` — safe template to commit instead
- `.gitignore` — excludes `config.js`

## About the "hidden" keys
I pulled the Firebase `apiKey` and Supabase URL/anon key out of `index.html` into `config.js`, which `app.js` imports and `.gitignore` excludes from version control.

One honest caveat: these are all **client-side/public keys** by design (Firebase web `apiKey`, Supabase `anon` key). Anyone can still find them by opening dev tools on your live site — that's normal and expected for these SDKs. Moving them out of git isn't about making them secret, it's about:
- not leaking them in your public GitHub history,
- making it easy to swap keys per environment (dev/staging/prod) without touching code.

**The real protection is your backend rules**, not hiding these values:
- Firestore: lock down `orders` reads/writes with [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started) (e.g., only allow customers to read their own order by ID/phone, only authenticated operators to update status).
- Supabase Storage: set bucket policies on `seprint-files` so uploads/reads follow the access pattern you want, rather than relying on the anon key alone.

If you ever want a truly private key (e.g. a Firebase *service account* or Supabase *service_role* key), that must live on a server/serverless function — never in any file shipped to the browser, `.gitignore` or not.

## Local setup
```bash
cp config.example.js config.js
# then edit config.js with your real project values
```
Because `app.js` is an ES module, open this with a local server (not `file://`), e.g.:
```bash
npx serve .
# or
python3 -m http.server 8000
```

## Where to host it
This is a static site (HTML/CSS/JS) that talks directly to Firebase and Supabase — no server-side code — so any static host works:

- **Firebase Hosting** — natural fit since you're already using Firebase Auth/Firestore. `firebase init hosting`, then `firebase deploy`. Free tier is generous.
- **Netlify** — drag-and-drop the folder, or connect the GitHub repo for auto-deploys on push.
- **Vercel** — same idea, connect the repo, zero config for a static site.
- **GitHub Pages** — free, works fine for this since there's no build step.

Any of these is fine; pick whichever you're most comfortable managing. If you connect a Git repo to auto-deploy, remember `config.js` won't be in git (by design) — set your real keys either by committing a *non-secret* build step that writes `config.js`, or just uploading `config.js` directly to the host (most of these hosts also support environment variables, but since these are static files rather than a build process, the simplest path is just to make sure `config.js` exists on the server, even though it's excluded from git).
