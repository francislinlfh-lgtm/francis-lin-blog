# Francis Lin — blog

A simple static personal blog. Posts live in the repo; a push publishes them.

## How it works
- **Posts** are in `posts.js` (`window.POSTS = [...]`) — each has `id`, `title`, `date`, `summary`, `body` (HTML). `index.html` shows the feed; `article.html?id=<id>` shows a post. No backend, no login, no build step.
- **Add / edit a post:** edit `posts.js` and push. (`id` is the URL slug; `date` is `YYYY-MM-DD`; `body` is HTML.)
- **View counts (optional):** the post page increments a per-post counter in Firebase Firestore (`postViews`) and shows it. The blog works fine without Firebase — counts just don't appear until you publish `firestore.rules` to the project in `firebase-config.js`.

## Deploy
Static files — deploy the folder on Cloudflare Pages (or `wrangler deploy`; see `wrangler.jsonc`).
