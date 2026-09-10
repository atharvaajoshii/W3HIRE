# NHCE

> A Web3-native freelance marketplace for transparent work, milestone-based payments, and trustless collaboration.

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql)](https://www.postgresql.org/)
[![Solidity](https://img.shields.io/badge/Solidity-Smart%20Contracts-363636?logo=solidity)](https://soliditylang.org/)
[![Sepolia](https://img.shields.io/badge/Network-Sepolia-6C63FF)](https://sepolia.dev/)

<p align="center">
  <img src="docs/screenshots/landing-page.png" alt="NHCE Landing Page" width="900">
</p>

## Tech Stack

### Frontend

* Next.js
* TypeScript
* Tailwind CSS

### Backend

The platform combines a familiar Web2 application experience with Web3 infrastructure where it actually adds value.

---

## Why NHCE?

Traditional freelance platforms often rely on centralized payment systems and opaque dispute processes.

NHCE explores a different model:

```text
Client
  │
  ├── Create project
  │
  ▼
Freelancer
  │
  ├── Apply / collaborate
  │
  ▼
Milestones
  │
  ├── Work submitted
  ├── Review
  └── Release payment
  │
  ▼
Blockchain / Escrow
```

The goal is simple:

**Make freelance work more transparent, structured, and trustworthy.**

---
## Product Showcase

### Landing Page

<p align="center">
  <img src="docs/screenshots/landing-page.png" alt="NHCE Landing Page" width="850">
</p>

### Marketplace

<p align="center">
  <img src="docs/screenshots/marketplace.png" alt="NHCE Marketplace" width="850">
</p>

### Dashboard

<p align="center">
  <img src="docs/screenshots/dashboard.png" alt="NHCE Dashboard" width="850">
</p>

## Features

### Authentication & Profiles

* Email/password authentication
* JWT-based sessions
* Role-based access
* Client and freelancer profiles
* Profile onboarding
* Portfolio and social links
* Email verification

### Freelance Marketplace

* Browse available work
* Create and publish projects
* Freelancer applications
* Client-side freelancer discovery
* Project management

### Milestone-Based Work

* Break projects into milestones
* Track milestone status
* Submit work
* Review progress
* Automated inactivity handling

### Web3 & Payments

* MetaMask wallet integration
* Ethereum Sepolia development network
* Smart-contract based escrow architecture
* Blockchain transaction handling
* Wallet-linked user accounts

### Disputes

* Dispute creation
* Juror-based resolution architecture
* Voting system
* Transparent dispute states

### Platform Infrastructure

* PostgreSQL database
* Prisma ORM
* Supabase
* REST API
* Scheduled background jobs
* Shared monorepo architecture

---

## Tech Stack

| Layer               | Technology                 |
| ------------------- | -------------------------- |
| Frontend            | Next.js, React, TypeScript |
| Styling             | Tailwind CSS               |
| Backend             | Node.js, TypeScript        |
| API                 | REST                       |
| ORM                 | Prisma                     |
| Database            | PostgreSQL                 |
| Database Platform   | Supabase                   |
| Blockchain          | Ethereum                   |
| Smart Contracts     | Solidity                   |
| Development Network | Sepolia                    |
| Wallet              | MetaMask/Phantom           |
| Monorepo            | npm Workspaces             |

---

## Architecture

```text
                         ┌────────────────────┐
                         │      Next.js       │
                         │     Web Client     │
                         └─────────┬──────────┘
                                   │
                              REST API
                                   │
                         ┌─────────▼──────────┐
                         │     Backend API    │
                         │    TypeScript      │
                         └─────────┬──────────┘
                                   │
                         ┌─────────▼──────────┐
                         │       Prisma       │
                         └─────────┬──────────┘
                                   │
                         ┌─────────▼──────────┐
                         │ PostgreSQL /       │
                         │ Supabase           │
                         └────────────────────┘

                                   │
                                   │ Web3
                                   ▼

                         ┌────────────────────┐
                         │ Ethereum / Sepolia │
                         │ Smart Contracts    │
                         └────────────────────┘
```

---

## Repository Structure

```text
nhce/
├── apps/
│   ├── web/                  # Next.js frontend
│   └── api/                  # Backend API
│
├── packages/                 # Shared packages
│
├── contracts/                # Solidity contracts
├── scripts/                  # Blockchain scripts
│
├── prisma/
│
├── docs/
│   ├── screenshots/
│   └── ...
│
├── hardhat.config.ts
├── package.json
└── README.md
```

> The exact structure may evolve as the platform grows.

---

## Getting Started

### Prerequisites

Make sure you have:

* Node.js 20+
* npm
* Git
* A Supabase PostgreSQL database
* MetaMask for Web3 functionality
* A Sepolia-compatible wallet for blockchain development

## Documentation

- [Installation Guide](INSTALLATION.md)
- [Architecture](docs/architecture.md)

---

## Development

Install dependencies:

```bash
npm install
```

Start the frontend:

```bash
npm run dev:web
```

Start the backend:

```bash
npm run dev:api
```

Compile smart contracts:

```bash
npm run compile
```

Deploy contracts to Sepolia:

```bash
npm run deploy:sepolia
```

---

## Environment Variables

Environment variables are intentionally excluded from the repository.

Backend configuration belongs in:

```text
apps/api/.env
```

Frontend configuration belongs in the appropriate `.env.local` file.

Never commit:

```text
.env
.env.local
.env.production
```

or any file containing private keys, database passwords, JWT secrets, or API keys.

---

## Git Workflow

NHCE follows a fork-based development workflow:

```text
Fork
  ↓
Feature Branch
  ↓
Pull Request
  ↓
dev
  ↓
Testing
  ↓
Pull Request
  ↓
main
```

Feature branches should follow a clear naming convention:

```text
feature/authentication
feature/project-management
feature/messaging
feature/escrow
fix/prisma-connection
```

---

## Contributing

1. Fork the repository.
2. Create a feature branch from `dev`.
3. Make focused changes.
4. Test your changes locally.
5. Commit with a meaningful message.
6. Push your branch.
7. Open a Pull Request into `dev`.

Before submitting a PR, make sure:

```text
✓ No secrets committed
✓ TypeScript builds successfully
✓ Prisma schema is valid
✓ Frontend runs
✓ Backend runs
✓ Existing functionality is not broken
✓ Changes are documented where necessary
```

---

## Project Status

NHCE is actively under development.

Current development areas include:

* Authentication and onboarding
* Marketplace workflows
* Messaging
* Milestone management
* Escrow infrastructure
* Dispute resolution
* Admin tooling
* Web3 wallet integration

---

## Vision

NHCE is built around a simple idea:

> Freelancing should not require blindly trusting a platform to handle every important part of the relationship.

By combining conventional product design with blockchain infrastructure, NHCE aims to make ownership, payments, milestones, and dispute resolution more transparent without forcing users to understand Web3 to use the platform.

---

## License

Add the project's chosen license here before publishing the repository as an open-source project.
