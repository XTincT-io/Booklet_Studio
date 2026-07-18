# Legacy prototype

`booklet-studio-prototype.jsx` was the original standalone artifact prototype — a
self-contained React component using the artifact runtime's `window.storage` API instead
of a real backend. It's kept here for reference only.

`components/BookletApp.tsx` at the project root supersedes it: same UI, but wired to the
real Next.js API routes, Postgres, S3, and Stripe in this repo.
