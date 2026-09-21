# Francis Lin — blog

A single-author personal blog. Static front-end + Firebase (Firestore for posts, Storage for cover images).

- `index.html` — magazine home feed
- `article.html` — individual post page (with view count)
- `admin.html` — owner-only admin (Google sign-in): write/publish posts, upload cover images, see views

## Deploy
- **Site:** Cloudflare (wrangler) serves this folder as static assets (`wrangler.jsonc`).
- **Backend:** a Firebase project. Publish `firestore.rules` and `storage.rules` in the Firebase console, and put your project's web config in `firebase-config.js`.
