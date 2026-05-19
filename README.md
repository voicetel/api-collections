# 📮 VoiceTel API Collections

Official **Postman** and **Bruno** collections for the [VoiceTel REST API](https://voicetel.com/docs/api/v2.2/) — every endpoint, every quirk, pre-wired auth, click-and-go.

![Version](https://img.shields.io/badge/version-2.2.10-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Postman](https://img.shields.io/badge/Postman-Collection_v2.1-orange)
![Bruno](https://img.shields.io/badge/Bruno-supported-purple)

## 📚 Table of Contents

- [What's in the box](#-whats-in-the-box)
- [Importing to Postman](#-importing-to-postman)
- [Importing to Bruno](#-importing-to-bruno)
- [Authentication walk-through](#-authentication-walk-through)
- [Variables](#-variables)
- [Rate Limits](#-rate-limits)
- [Validation script](#-validation-script)
- [API Documentation](#-api-documentation)
- [Contributors](#-contributors)
- [Sponsors](#-sponsors)
- [License](#-license)

## 📦 What's in the box

| File / directory | Purpose |
|------------------|---------|
| `voicetel-api.postman_collection.json` | Single-file Postman Collection v2.1 (drag-and-drop import). |
| `voicetel-api.postman_environment.json` | Companion Postman environment with `baseUrl`, `username`, `password`, `apiKey`. |
| `bruno/` | One `.bru` file per request, organized into 10 resource folders. Git-friendly plain text. |
| `bruno/bruno.json` | Bruno project file. |
| `bruno/environments/production.bru` | Production environment (`https://api.voicetel.com`). |
| `spec/v2.2.json` | Pinned copy of the OpenAPI 3.1 source spec, for reproducible builds. |
| `scripts/build.mjs` | Regenerates both collections from the spec. |
| `scripts/validate.mjs` | Asserts every `operationId` in the spec is represented in both collections. |

All **74 operations** across **10 resource families** are covered:

| Family | Endpoints | Highlights |
|--------|-----------|-----------|
| **Account** | 11 | Sign up, log in, CDR, credits, payments, recurring charges. |
| **ACL** | 3 | API IP allow-list management. |
| **Authentication** | 2 | Password / IP / API-key rotation policy. |
| **e911** | 6 | Validate, provision, list, delete 911 records. |
| **Gateways** | 6 | Outbound SIP gateway CRUD + bound-numbers view. |
| **iNumbering** | 7 | Inventory search, orders, port-ins, port-availability (with `localRoutingNumber` & `rateCenterTier`). |
| **Lookups** | 2 | CNAM and LRN dips. |
| **Messaging** | 6 | SMS / MMS send + history, 10DLC brand & campaign registration. |
| **Numbers** | 24 | Per-number config — routing, CNAM, LIDB, fax, forwarding, SMS, 10DLC campaigns, translations. |
| **Support** | 7 | Tickets CRUD, threaded messages, replies. |

![Postman screenshot](docs/postman.png)

## 🚀 Importing to Postman

1. Open Postman.
2. Click **Import** (top-left).
3. Drop in **both** files from this repo:
   - `voicetel-api.postman_collection.json`
   - `voicetel-api.postman_environment.json`
4. In the top-right environment dropdown, select **VoiceTel · Production**.
5. Open the environment (click the eye icon), and set:
   - `username` — your VoiceTel account ID.
   - `password` — your VoiceTel account password.
   - `apiKey` — leave blank; the collection fills it in for you on first login.
6. Open **Account → Account · Login (get API key)** and click **Send**. The response body contains your API key, and a post-response script writes it into the `apiKey` collection variable automatically. Every other request reads it as `Authorization: Bearer {{apiKey}}` from then on.

## 🟪 Importing to Bruno

1. Install Bruno from [usebruno.com](https://www.usebruno.com).
2. Click **Open Collection**.
3. Select the `bruno/` directory inside this repo.
4. In the bottom-left, choose the **production** environment, then click the gear icon to fill in:
   - `username` — your VoiceTel account ID.
   - `password` — your VoiceTel account password.
   - `apiKey` — leave blank; auto-filled on login.
5. Open **Account → Account · Login (get API key)** and click **Send**. A post-response script writes `apiKey` into your environment automatically.

![Bruno screenshot](docs/bruno.png)

## 🔐 Authentication walk-through

The VoiceTel API uses **bearer auth** with an API key on every endpoint **except** `POST /v2.2/account/api-key`, which exchanges a username and password for the key.

Both collections are pre-wired for this exact pattern:

1. The collection itself uses `Authorization: Bearer {{apiKey}}` at the root level — every request inherits it.
2. The login endpoint (`Account · Login (get API key)`) overrides auth to **none** and sends `username` + `password` in the body.
3. A post-response script reads `response.data.apikey` and stores it in the `apiKey` collection variable.
4. Every other request now authenticates automatically without you ever touching the value.

If you rotate your password, just re-run the login request — the new key replaces the old one.

## 🔧 Variables

| Variable | Default | Notes |
|----------|---------|-------|
| `baseUrl` | `https://api.voicetel.com` | Override only if you've been issued a private endpoint. |
| `username` | _(empty)_ | Your VoiceTel account ID. |
| `password` | _(empty)_ | Treat as a secret. |
| `apiKey` | _(empty)_ | Auto-populated by the login request's post-response script. |

## ⏱ Rate Limits

The following six endpoints are rate-limited to **6 requests per hour per IP**. Their descriptions inside the collection are tagged with a ⚠️ marker.

- `GET /v2.2/account`
- `GET /v2.2/account/cdr`
- `GET /v2.2/account/recurring-charges`
- `GET /v2.2/account/payments`
- `GET /v2.2/account/registration`
- `POST /v2.2/account/api-key`

All other endpoints have no per-IP throttling and are governed only by your account's plan limits.

## ✅ Validation script

```bash
# Verify both collections still match the OpenAPI spec.
node scripts/validate.mjs

# Or via the shell wrapper (also runs jq if available).
./scripts/validate.sh
```

The validation script reads every `operationId` out of `spec/v2.2.json`, then walks the Postman JSON and every `.bru` file under `bruno/`. It exits non-zero (and prints what's missing) if any operation isn't represented.

Run by CI on every push & PR — see `.github/workflows/ci.yml`.

To regenerate everything from the pinned spec:

```bash
node scripts/build.mjs
```

## 📖 API Documentation

- **Reference docs:** [voicetel.com/docs/api/v2.2/](https://voicetel.com/docs/api/v2.2/)
- **Interactive playground:** [voicetel.com/docs/api/v2.2/playground/](https://voicetel.com/docs/api/v2.2/playground/) — try the API in your browser without writing any code
- **API credentials:** [voicetel.com/docs/api/v2.2/credentials/](https://voicetel.com/docs/api/v2.2/credentials/)
- **Source OpenAPI spec:** [`spec/v2.2.json`](spec/v2.2.json)

## 🙌 Contributors

- [Michael Mavroudis](https://github.com/mavroudis) — Lead Developer

Contributions welcome. Open an issue describing the change you want to make, or send a pull request against `main`. If you're adding a new endpoint, run `node scripts/build.mjs` to regenerate both collections from the spec — don't hand-edit the JSON.

## 💖 Sponsors

| Sponsor | Contribution |
|---------|--------------|
| [VoiceTel Communications](https://voicetel.com) | Primary development and production hosting |

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
