# Si Her DeFi — Backend API (`Server`)

Professional, enterprise-grade RESTful API backend developed with **Node.js**, **Express**, **TypeScript**, and **MongoDB (Mongoose)** for the **Si Her DeFi** cohort learning and on-chain credentialing platform.

---

## 🌟 Features & Highlights

- **Enterprise Modular Architecture**: Clean separation into `models`, `modules` (`controller`, `service`, `routes`, `validation`), `middlewares`, `config`, and `utils`.
- **Comprehensive Security**:
  - **Helmet**: HTTP response header hardening (XSS filter, frameguard, HSTS, noSniff).
  - **CORS**: Domain whitelist for client security.
  - **Rate Limiting**: Tiered rate limiters (standard API limits + strict 10-attempt authentication limiter to stop OTP bombing and brute-force).
  - **NoSQL Injection Sanitation**: Strips MongoDB operators (`$`, `.`) from input bodies and queries.
  - **Zod Validation**: Validates all incoming parameters, queries, and request bodies before touching business logic.
  - **Centralized Error Handling**: Unified API responses for operational errors, Mongoose duplicates, CastErrors, and token expirations.
- **Web3 Base Integration**:
  - Cryptographic signature verification via `ethers` to verify wallet address ownership on Base Mainnet (`8453`).
  - Certificate metadata preparation and on-chain mint transaction recording.
- **Full Cohort Lifecycle**:
  - **Authentication**: Email OTP verification (6 digits), session JWTs, auto-expiry TTLs.
  - **Profile Management**: Bio, organization, social profiles, avatars, and application prefill flags.
  - **Study / Onboarding**: Kara's video walkthrough, follow confirmation, and 3-step entry survey tracking.
  - **Modules & Video Player**: Chapters with timestamps, speaker profiles, and module progress.
  - **Quizzes & Badges**: 5-question quizzes, 3 attempt quotas, explanations & video timestamp hints, badge issuance.
  - **Certificates**: Unlocked upon prerequisite completion (`Collective Capital for Creators`), Base minting, and public verification.
  - **Account Settings**: Email notifications and on-chain verification privacy toggles.

---

## 📂 Directory Structure

```
Server/
├── .env.example
├── .env
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
└── src/
    ├── app.ts                         # Express application factory with middleware stack
    ├── server.ts                      # Server entry point, DB connect & graceful shutdown
    ├── config/
    │   ├── env.ts                     # Zod-validated environment config
    │   └── database.ts                # Resilient Mongoose connection manager
    ├── constants/
    │   └── http-status.ts             # Standardized HTTP status codes
    ├── middlewares/
    │   ├── auth.middleware.ts         # JWT verification & req.user injection
    │   ├── role.guard.ts              # RBAC guard (member, admin)
    │   ├── validate.middleware.ts    # Zod request validation
    │   ├── rate-limiter.middleware.ts # Rate limiting (general + auth)
    │   ├── sanitize.middleware.ts     # NoSQL injection protection
    │   └── error.middleware.ts        # Global error handler
    ├── models/
    │   ├── user.model.ts              # User entity & wallet address
    │   ├── otp.model.ts               # OTP verification codes with TTL
    │   ├── profile.model.ts           # Member profile details
    │   ├── survey.model.ts            # Entry (Part 1) and exit surveys
    │   ├── module.model.ts            # Educational modules, chapters, speakers
    │   ├── quiz.model.ts              # Quizzes & questions
    │   ├── progress.model.ts          # Module progress & earned badges
    │   ├── certificate.model.ts       # On-chain credentials & Base txHash
    │   ├── settings.model.ts          # Member preferences
    │   └── partner.model.ts           # Ecosystem partner listings
    ├── modules/
    │   ├── auth/                      # Authentication (claim-seat, verify-otp, resend)
    │   ├── profile/                   # Profile management & application prefill
    │   ├── wallet/                    # Web3 nonce & wallet connection
    │   ├── onboard/                   # Study survey (Part 1 & 2)
    │   ├── modules/                   # Modules & chapters
    │   ├── quiz/                      # Quizzes & grading
    │   ├── badges/                    # Badges display
    │   ├── certificate/               # Certificate preview, minting & public verification
    │   ├── settings/                  # Member preferences
    │   └── partners/                  # Cohort partners
    ├── routes/
    │   └── index.ts                   # Master v1 API router
    ├── utils/
    │   ├── api-response.ts            # Unified response envelope
    │   ├── api-error.ts               # Custom operational errors
    │   ├── async-handler.ts           # Async controller wrapper
    │   ├── crypto.ts                  # Secure OTP & hash utilities
    │   └── web3.ts                    # EIP-191 personal_sign signature verification
    └── seed/
        └── seed.ts                    # Initial cohort database seeder
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
cd Server
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env` (already created with local defaults):
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://127.0.0.1:27017/siherdefi
JWT_SECRET=super_secret_jwt_key_siherdefi_2026_change_in_production
JWT_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000
BASE_CHAIN_ID=8453
```

### 3. Seed Database
Populates initial cohort modules, quizzes, partner cards, and demo user:
```bash
npm run seed
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
npm start
```

---

## 📡 API Reference Overview

All standard API endpoints are prefixed with `/api/v1`.

| Module | Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- | :--- |
| **System** | `GET` | `/health` | Check API health & uptime | No |
| **System** | `GET` | `/ready` | Check MongoDB connection status | No |
| **Auth** | `POST` | `/api/v1/auth/claim-seat` | Send 6-digit OTP code to email | No (Rate limited) |
| **Auth** | `POST` | `/api/v1/auth/verify-otp` | Verify OTP code & return JWT token | No (Rate limited) |
| **Auth** | `POST` | `/api/v1/auth/resend-otp` | Re-request fresh OTP code | No (Rate limited) |
| **Auth** | `GET` | `/api/v1/auth/me` | Get current authenticated user session | Yes |
| **Auth** | `POST` | `/api/v1/auth/logout` | Logout user session | Yes |
| **Profile** | `GET` | `/api/v1/profile` | Get current user's profile | Yes |
| **Profile** | `PUT` | `/api/v1/profile` | Update profile information | Yes |
| **Profile** | `GET` | `/api/v1/profile/prefill` | Get prefilled application data | Yes |
| **Wallet** | `POST` | `/api/v1/wallet/nonce` | Generate cryptographic signing nonce | Yes |
| **Wallet** | `POST` | `/api/v1/wallet/connect` | Verify signature & bind Base wallet | Yes |
| **Wallet** | `DELETE`| `/api/v1/wallet/disconnect` | Disconnect wallet | Yes |
| **Wallet** | `GET` | `/api/v1/wallet/status` | Get wallet connection status | Yes |
| **Onboard**| `GET` | `/api/v1/onboard/status` | Get Part 1 / Part 2 completion state | Yes |
| **Onboard**| `POST` | `/api/v1/onboard/part1` | Submit Part 1 survey & social follow | Yes |
| **Onboard**| `POST` | `/api/v1/onboard/part2` | Submit Part 2 exit survey | Yes |
| **Modules**| `GET` | `/api/v1/modules` | List all cohort modules & completion | Yes |
| **Modules**| `GET` | `/api/v1/modules/:id` | Module detail, chapters & speakers | Yes |
| **Modules**| `POST` | `/api/v1/modules/:id/complete` | Mark module completed | Yes |
| **Modules**| `POST` | `/api/v1/modules/:id/schedule` | Schedule session (Google / Apple Calendar) | Yes |
| **Modules**| `DELETE`| `/api/v1/modules/:id/schedule`| Remove scheduled session | Yes |
| **Modules**| `GET` | `/api/v1/modules/:id/calendar-link` | Get Google Calendar link & ICS url | No |
| **Modules**| `GET` | `/api/v1/modules/:id/calendar/ics` | Download standard RFC 5545 `.ics` file | No |
| **Calendar**| `GET` | `/api/v1/calendar/my-schedule` | List all scheduled sessions for user | Yes |
| **Calendar**| `POST` | `/api/v1/calendar/schedule` | Schedule module/session with provider | Yes |
| **Calendar**| `GET` | `/api/v1/calendar/:id/ics` | Direct download `.ics` calendar file | No |
| **Quiz** | `GET` | `/api/v1/quiz/:moduleId` | Fetch module quiz questions & attempts | Yes |

| **Quiz** | `POST` | `/api/v1/quiz/:moduleId/submit` | Submit answers, grade & earn badge | Yes |
| **Badges** | `GET` | `/api/v1/badges` | List all earned badges | Yes |
| **Cert** | `GET` | `/api/v1/certificate` | Get certificate unlock & mint status | Yes |
| **Cert** | `POST` | `/api/v1/certificate/prepare-mint`| Validate prerequisites & generate metadata | Yes |
| **Cert** | `POST` | `/api/v1/certificate/record-mint` | Record Base txHash and token ID | Yes |
| **Cert** | `GET` | `/api/v1/certificate/verify/:id` | **Public** verification by token / address | **No** |
| **Settings**| `GET` | `/api/v1/settings` | Get account preferences | Yes |
| **Settings**| `PATCH`| `/api/v1/settings` | Update notifications & privacy | Yes |
| **Partners**| `GET` | `/api/v1/partners` | List cohort ecosystem partners | No |
