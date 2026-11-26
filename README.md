# FamilyCraft (play site)

Live address (once DNS and GitHub Pages are set up): **https://play.familyjourney.io**

The playable FamilyCraft demo as a plain static site: one page, no build step.

| File | What it is |
|---|---|
| `index.html` | The whole game (three.js from a CDN). |
| `fc-config.js` | Online settings: your Supabase Project URL and anon / publishable key. |
| `serve.mjs` | Optional home Wi-Fi server for two devices without Supabase: `node serve.mjs`. |
| `CNAME` | The custom domain GitHub Pages serves this site on: `play.familyjourney.io`. |

## Two devices

- **On the public site:** needs `fc-config.js` filled in. Room messages go through Supabase Realtime (broadcast only, nothing is stored).
- **At home without Supabase:** `node serve.mjs`, open the printed address, scan the QR from the second device.

## Publish (GitHub Pages)

1. Create an empty GitHub repository and push this folder to its `main` branch.
2. Repository Settings -> Pages -> Deploy from a branch -> `main` / root.
3. Settings -> Pages -> Custom domain: `play.familyjourney.io` (already in the `CNAME` file), then tick "Enforce HTTPS" once the certificate is ready.
4. At the DNS provider for familyjourney.io add one record: type `CNAME`, name `play`, value `<github-username>.github.io`.

Never put a Supabase `service_role` / secret key in this repository: everything here is public.
