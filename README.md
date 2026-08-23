# ROCARE_backend

Backend API for **RO Care** — a multi-role RO (water purifier) service & sales management platform. Handles user/vendor/agent onboarding, product & service catalogs, lead management, order & delivery tracking, technician/service assignment, payments & invoicing, and admin/super-admin controls.

## Tech Stack

- **Runtime:** Node.js + Express 5
- **Language:** TypeScript
- **ORM / DB:** Prisma 7 + PostgreSQL (Neon serverless)
- **Auth:** JWT, bcrypt, Google OAuth (`google-auth-library`), WebAuthn (`@simplewebauthn/server`)
- **File / Media:** Cloudinary, `fluent-ffmpeg`, `canvas`
- **Email:** SendGrid
- **Validation:** `class-validator`, `class-transformer`
- **Security:** Helmet, CORS, `express-rate-limit`

## Roles

| Role     | Description                                  |
|----------|-----------------------------------------------|
| `CLIENT` | Sign-up user / customer                       |
| `VENDOR` | Agent / vendor / technician                   |
| `ADMIN`  | Manages users, vendors, products, leads, etc. |
| `SADMIN` | Super admin — full system control             |

## Core Modules

- **Auth** — signup/login, OTP verification, token blacklisting, Google sign-in
- **User & Vendor Profiles** — client and vendor/agent accounts, vendor banking & live location
- **Product & Service Catalog** — RO / AC / Geyser products and services
- **Lead Management** — New → Accepted → Ongoing → Completed / Denied lead pipeline
- **Orders & Service Requests** — product orders and installation/repair/AMC service jobs
- **Payments** — order & service payment tracking
- **Complaints & Support** — customer complaint handling
- **Notifications & Chat** — in-app notifications, direct messaging
- **AI Chatbot** — support assistant with session-based chat history

## Project Structure

```
src/
  modules/
    auth/
    user/
    product/
    service/
    lead/
    order/
    payment/
    complaint/
    notification/
    chatbot/
  types/
  prisma/
  server.ts
prisma/
  schema.prisma
```

*(Structure may evolve as modules are added.)*

## Getting Started

### Prerequisites

- Node.js (LTS)
- Yarn
- A PostgreSQL database (e.g. [Neon](https://neon.tech))

### Installation

```bash
git clone https://github.com/ProgrammerSnehasish/ROCARE_backend.git
cd ROCARE_backend
yarn install
```

### Database Setup

```bash
yarn prisma:generate
yarn prisma:migrate
```

### Run the Dev Server

```bash
yarn dev
```

### Build & Run for Production

```bash
yarn build
yarn start
```

## Scripts

| Script                 | Description                              |
|-------------------------|-------------------------------------------|
| `yarn dev`              | Start dev server with hot reload          |
| `yarn build`             | Compile TypeScript to `dist/`             |
| `yarn start`             | Run the compiled production server        |
| `yarn prisma:migrate`    | Run Prisma migrations                     |
| `yarn prisma:generate`   | Generate the Prisma client                |
| `yarn prisma:studio`     | Open Prisma Studio                        |
| `yarn lint`              | Type-check without emitting               |

## License

MIT