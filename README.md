# The Becoming Conference — backend

Conference date: **December 4, 2026**. Independent Node.js/Express API using the official MongoDB driver. No frontend files or credentials are bundled into this service.

## Start locally

Use Node.js 22.13 or newer. From this directory:

```powershell
npm install
# Only if .env does not already exist:
Copy-Item .env.example .env
npm run admin:create
npm start
```

The API runs on port **4000**. Run the separate frontend on port 3000; attendees use the frontend URL. The backend `.env` supplied during development already contains the provided Atlas URI. It is ignored by Git. Do not overwrite it with the example or commit it. Rotate the disclosed Atlas password and update this file.

Configuration:

| Variable | Purpose |
| --- | --- |
| `mongoURL` or `MONGODB_URI` | Server-only MongoDB URI; `mongoURL` takes precedence |
| `MONGODB_DB` | Database name; defaults to `becoming_conference` |
| `PORT` | API port; defaults to 4000 |
| `APP_ORIGIN` | Exact **frontend** origin, e.g. `http://localhost:3000`; HTTPS required in production |
| `NODE_ENV` | Set `production` for Secure cookies and HTTPS enforcement |
| `API_PROXY_SECRET` | Same random server-only value as frontend, minimum 32 characters; required in production. Local values are already generated |
| `TRUST_PROXY` | Defaults to 0. Set 1 only for exactly one trusted proxy with direct backend access restricted |

Atlas must allow the backend host’s outbound IP, resolve SRV DNS, and allow TLS connections to the cluster. Give the application database user access only to the application database. Startup checks connectivity and creates collections/indexes; it fails safely rather than pretending to save records. The live integration test needs permission to create and drop an isolated `becoming_test_*` database; use a dedicated test account where possible. Never relax production access merely to run tests.

## First administrator

Run `npm run admin:create` in an interactive terminal. Enter the admin email and a password of 14–256 characters. Password input is hidden; passwords are stored as salted scrypt hashes. There is no default password or public account-creation endpoint. The tool refuses duplicate accounts. Sign in at the frontend’s `/admin/login`. To revoke access immediately, remove the admin’s sessions and disable/change the admin role in MongoDB. There is no password-reset UI in this implementation; rotate/reset credentials through an authorized operational process.

## Database model

`registrations`: automatically generated UUID `id`, `full_name`, normalized lowercase `email`, international-format `whatsapp`, `school`, integer `age` in years (0?120), `guardian_email`, `guardian_phone`, server-generated ISO UTC `created_at`, `status` (`registered`), `consent_role` (`attendee` or `guardian`), `consent_version`, and server-generated `consent_at`. MongoDB supplies its internal `_id` separately; it is not exported.

`src/schema.js` defines the MongoDB document validator used when creating a new registrations collection. Existing collections are preserved, not silently migrated; application validation still applies. Review existing records before applying stricter collection validation manually. Startup creates unique indexes on normalized registration email and registration ID, and a compound date/ID index. Existing duplicate records must be resolved by an authorized organizer before the unique index can be created; startup does not overwrite or delete them.

`admins`: `_id`, normalized email (unique), scrypt `password_hash`, role. `sessions`: SHA-256 digest of the random session token as `_id`, `admin_id`, and BSON-date `expires_at`. MongoDB TTL deletes expired sessions; every request also checks expiration immediately and verifies the administrator’s current role. Sessions last eight hours. Cookies are HttpOnly, SameSite=Strict, and Secure in production.

Duplicate policy: one registration per normalized email. No overwrites. Existing email submissions return HTTP 409 with instructions to request corrections through the organizer’s established channel. Plus aliases are not stripped. Both guardian fields are required for every registration. Phone validation accepts formatted international numbers beginning with `+`, normalizes spacing/punctuation, and checks an 8–15 digit international structure. It does not verify carrier allocation, WhatsApp membership, or ownership.

Consent policy: an adult attendee may consent for themselves; a parent/legal guardian must submit and consent for anyone under 18 at registration time. The separate submitter dropdown is removed; the consent checkbox identifies a parent/legal guardian when age is under 18. The declaration and privacy-notice version/time are recorded. This is a recorded declaration, not identity verification or a claim of legal sufficiency. Organizers must approve the age policy and any additional guardian verification before launch.

## Endpoints

| Method and path | Behavior |
| --- | --- |
| `POST /api/registrations` | Validate and persist; 201 + ID, 422 field errors, 409 duplicate, 429 rate limit, 503 safe failure |
| `POST /api/admin/login` | Rate-limited admin authentication and session cookie |
| `POST /api/admin/logout` | Delete current session and clear cookie |
| `GET /api/admin/session` | Authenticated session/role check |
| `GET /api/admin/registrations?q=&date=&page=` | Protected database search and 20-row pagination; date is UTC |
| `GET /api/admin/registrations/:id` | Protected detail, including age/guardian contacts |
| `GET /api/admin/registrations/export` | Protected complete database CSV, independent of list filters/page |
| `GET /api/health` | Basic process health, no personal data |

All write requests require JSON and an `Origin` matching `APP_ORIGIN`. Frontend server proxies `/api/*` to this service; no cross-site browser cookie setup or permissive CORS is needed. Unauthenticated admin requests return 401; revoked/non-admin roles return 403. Lists omit age/guardian contacts. All API responses use `Cache-Control: no-store`.

CSV: UTF-8 BOM, quoted/escaped cells, CRLF rows, required 10 columns, numeric age and UTC registration timestamp, attachment filename `the-becoming-conference-registrations-2026-12-04.csv`. User-controlled formula prefixes are apostrophe-prefixed, including international phone numbers, so spreadsheets retain them as text. A MongoDB cursor with 250-document batches and response backpressure avoids loading the dataset into backend memory. An empty dataset exports headers. A failure after streaming starts terminates the download; the frontend reports a failure rather than treating it as a complete file.

## Verification

```powershell
npm test
npm run lint
npm run build
npm run test:live
```

`npm test` uses a clearly separated in-memory MongoDB test double to test HTTP behavior. It does not prove Atlas connectivity. `npm run test:live` uses the real configured cluster and a temporary database, verifies persistence, unique indexes, pagination and export, and drops only that temporary database afterwards. See `docs/IMPLEMENTATION.md` for actual execution results and limitations.

## Production requirements

Deploy this directory as its own Node service. Set the variables above through the host’s secret manager, use HTTPS, and set the frontend’s `BACKEND_URL` to this service’s HTTPS origin. The public registration link is the **frontend** URL. Configure persistent Atlas connectivity, backups, restricted database roles, monitoring without personal-data logging, and secret rotation. Do not ship `.env`, `.tools`, or `.npm-cache` in deployment archives.

The IP rate limiter is process-local (20 registration attempts and 10 login attempts per 15 minutes). Deploy a single API instance or add a shared limiter/WAF before scaling. The frontend sends client IP information together with the server-only proxy secret; the backend accepts that information only when the secret matches. Direct requests without the configured secret are denied. Configure frontend trusted-edge forwarding when it is behind a hosting proxy. Never enable numeric proxy trust on an unrestricted backend that accepts forged forwarded headers. The proxy credential is required in production and must never enter browser code.

Organizers must publish their responsible organization’s identity, privacy contact, retention period, and applicable consent policy before opening registration. No retention period was supplied, so automatic deletion is deliberately not scheduled. Exports and backups require the same retention/access policy as the database. Email notifications, payments and ticket issuance are not implemented.

Recent update: numeric age replaces the date-of-birth picker and the sixth CSV column is now Age. The submitter-role dropdown and its helper text were removed. Existing DOB records are preserved, with age at registration derived for details/export. Existing application DOB collection validators are upgraded compatibly at startup.

To create or update a specific admin account, run `npm run admin:set -- <email>`. This prompts for a hidden password (8–256 characters), saves only its salted scrypt hash, verifies the saved hash, and revokes previous sessions. The supplied account creation attempt failed with an Atlas DNS timeout; no account write was confirmed. No password is hardcoded in this script or frontend code.

Current form update: both numeric age and date of birth are required. DOB is validated as a real, non-future calendar date and age must match DOB. Both are saved, shown only in protected details, and exported as Date of Birth followed by Age (11 CSV columns total). Existing age-only records retain a blank DOB; no date is invented. The submitter-role dropdown remains removed.
