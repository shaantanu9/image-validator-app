# ImageKit setup (manual)

Image uploads are **optional**. Until these keys are set, `GET /api/v1/uploads/imagekit-auth`
returns `503` and the profile avatar-upload demo shows "not configured" — the rest
of the app works normally.

## Steps

- [ ] Create a free account at https://imagekit.io/registration
- [ ] In the ImageKit dashboard → **Developer options → API Keys**, copy:
  - **Public key** → `IMAGEKIT_PUBLIC_KEY`
  - **Private key** → `IMAGEKIT_PRIVATE_KEY` (server-only — never ship to the client)
  - **URL endpoint** (e.g. `https://ik.imagekit.io/yourid`) → `IMAGEKIT_URL_ENDPOINT`
- [ ] Set them in the backend `.env` you run:
  - `server/.env` (PostgreSQL backend)
- [ ] Restart the server (`pnpm dev`)
- [ ] Verify: sign in, open **Profile → Upload image**, pick a photo — it should upload
      and render, and the ImageKit dashboard **Media Library** should show the file.

## How it works (no private key in the browser)

1. Client calls `GET /api/v1/uploads/imagekit-auth` (authenticated).
2. Server returns `{ token, expire, signature, publicKey, urlEndpoint }` where
   `signature = HMAC-SHA1(privateKey, token + expire)` — computed server-side.
3. Client POSTs the file + those params to `https://upload.imagekit.io/api/v1/files/upload`.

The private key stays on the server; the browser only ever gets a short-lived signature.

## Notes / gotchas

- ImageKit expects **HMAC-SHA1** (not SHA-256) — already handled in `upload.service.ts`.
- Token validity is 30 minutes (ImageKit max is 1 hour) — see `TOKEN_TTL_SECONDS`.
- The demo shows the uploaded image for the session only. To persist an avatar,
  add an `avatarUrl` column/field on the user and extend `PATCH /api/v1/auth/me`
  to accept it — deliberately out of scope for this project.
- For production, consider restricting uploads by file size / type and adding an
  ImageKit cleanup job for images deleted in-app.
