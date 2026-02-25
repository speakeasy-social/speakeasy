# Requirements: Speakeasy Media Get API

## Purpose

Add a **GET** endpoint to the Speakeasy media service so the web app can fetch private profile media (avatar/banner) by key with authentication. This is required for the "private → public profile" flow on web: the client must re-download the image and re-upload it to ATProto; direct CDN fetch fails due to CORS, so the client calls this API with the user's Bluesky JWT instead.

## Client contract (already implemented)

The app calls this endpoint when migrating private profile media to public (Bluesky/ATProto) on web only.

- **Base URL**: Same host as `social.spkeasy.media.upload` (e.g. `http://localhost:3003` in dev, `https://api.spkeasy.social` in production for media routes).
- **Path**: `GET /xrpc/social.spkeasy.media.get`
- **Query parameters**:
  - `key` (required): The Speakeasy media key (e.g. the value stored in private profile `avatarUri` / `bannerUri`). Same key format returned by the upload endpoint and used to build CDN URLs.
- **Headers**:
  - `Authorization: Bearer <accessJwt>` (required): Bluesky/ATProto session access JWT for the requesting user.

## Requirements for the API

### 1. Endpoint

- **Method**: GET  
- **Path**: `/xrpc/social.spkeasy.media.get`  
- **Query**: `key` (required, string) — the Speakeasy media key (e.g. `media/...` or whatever format the media service uses internally / returns from upload).

### 2. Authentication and authorization

- **Authentication**: Validate the `Authorization: Bearer <accessJwt>` header. Resolve the JWT to a Bluesky DID (and optionally handle/refresh). Reject with **401 Unauthorized** if missing or invalid.
- **Authorization**: The caller may only access media they are allowed to see. At minimum:
  - Media that was uploaded by the same user (same DID as the JWT) — e.g. private profile avatar/banner uploaded in the context of their profile session — **must** be accessible.
  - Any existing policy for “who can read this key” (e.g. profile session ownership, post audience) must be enforced. If the media service already has a notion of “owner” or “session” for a key, use it; otherwise require that the key belongs to the authenticated user’s private profile or other user-owned resource.
- Return **403 Forbidden** when the JWT is valid but the user is not allowed to access the given `key`.

### 3. Response (success)

- **Status**: 200 OK.
- **Body**: Raw binary body of the media file (same bytes as served from the CDN or stored object).
- **Headers** (recommended):
  - `Content-Type`: The actual media type (e.g. `image/jpeg`, `image/png`). The client uses `response.blob()` and then `blob.type` when re-uploading; if the service knows the type from upload metadata or extension, set it. Default to `image/jpeg` if unknown.
  - Optional: `Content-Length`, `Cache-Control` (e.g. short-lived or no-store for private media) as appropriate.

### 4. Error responses

- **400 Bad Request**: Missing or invalid `key` query parameter.
- **401 Unauthorized**: Missing or invalid `Authorization` header / JWT.
- **403 Forbidden**: Valid JWT but caller not allowed to access this media key.
- **404 Not Found**: Key not found or no object stored for that key.
- **500**: Server/storage error; client will surface a generic error.

Return a JSON body for errors if the rest of the Speakeasy XRPC surface uses JSON for errors (e.g. `{ "error": "...", "message": "..." }`); otherwise plain text or consistent with existing media service conventions.

### 5. Behavior

- Resolve `key` to the underlying blob (same storage/CDN path or object as used for public CDN URLs).
- Stream the blob bytes in the response body. Do not require the client to send a body.
- Idempotent and safe (GET, no side effects).

### 6. Security and operational notes

- **Rate limiting**: Apply the same or similar rate limits as other authenticated media endpoints to prevent abuse.
- **Logging**: Log access (e.g. key, DID, success/failure) for debugging and abuse detection; avoid logging full JWTs.
- **CORS**: Ensure the media service (or API gateway in front of it) allows requests from the web app origin(s) (e.g. `https://app.spkeasy.social`, `http://localhost:19006` in dev) so the browser allows the fetch.
- **TLS**: In production, serve over HTTPS only.

### 7. Host and routing

- The endpoint must be exposed on the **same host** the app uses for `social.spkeasy.media.upload` (see `getHost(agent, 'social.spkeasy.media.upload')` in the app). In local dev that is `http://localhost:3003`; in production it is the host that serves the `social.spkeasy.media` prefix (e.g. `https://api.spkeasy.social` with routing by path or subdomain). No change is needed in the app if the new route is added on that host.

## Out of scope for this API

- No change to the existing **upload** endpoint (`social.spkeasy.media.upload`).
- No change to how the CDN or public URLs work; this endpoint is only for authenticated, programmatic access by the owner (for migration).
- No new query parameters (e.g. image resizing) unless the product explicitly requires them later.

## Acceptance criteria

1. **GET** `/xrpc/social.spkeasy.media.get?key=<key>` with valid `Authorization: Bearer <accessJwt>` for a user who owns the media returns **200** and the raw blob, with a correct `Content-Type` when available.
2. Missing or invalid JWT returns **401**.
3. Valid JWT but no permission to the key returns **403**.
4. Unknown or deleted key returns **404**.
5. Missing or invalid `key` returns **400**.
6. Web app (from allowed origin) can call the endpoint without CORS errors and successfully use `response.blob()` for the migration flow.

## Reference: client usage

The app uses this only on **web** when migrating private profile avatar/banner to public:

```ts
// private-profiles.ts (web path)
const url = `${serverUrl}/xrpc/social.spkeasy.media.get?key=${encodeURIComponent(speakeasyKey)}`
const response = await fetch(url, {
  method: 'GET',
  headers: { Authorization: `Bearer ${agent.session?.accessJwt}` },
})
// ... then response.blob() is re-uploaded to ATProto via agent.uploadBlob()
```

The `speakeasyKey` is the value stored in the user’s private profile (e.g. `avatarUri` / `bannerUri`) and is the same key format used to build CDN URLs (e.g. `getBaseCdnUrl(agent) + '/' + key`).
