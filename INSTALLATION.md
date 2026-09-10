# NHCE — Installation Guide

This guide explains how to set up NHCE locally for development.

---

## 1. Prerequisites

Install the following:

### Node.js

Node.js 20 or later is recommended.

Check:

```bash
node --version
```

### npm

```bash
npm --version
```

### Git

```bash
git --version
```

### MetaMask

Install MetaMask if you want to test Web3 functionality.

You will also need a wallet configured for the Sepolia network.

---

# 2. Clone the Repository

Fork the repository first if you are contributing.

Clone your fork:

```bash
git clone https://github.com/<your-username>/nhce.git
cd nhce
```

Add the original repository:

```bash
git remote add upstream https://github.com/atharvaajoshii/nhce.git
```

Verify:

```bash
git remote -v
```

You should have:

```text
origin    your fork
upstream  atharvaajoshii/nhce
```

---

# 3. Install Dependencies

From the repository root:

```bash
npm install
```

NHCE uses npm workspaces, so this installs dependencies for the workspace applications.

---

# 4. Configure Environment Variables

## Backend

Create:

```text
apps/api/.env
```

Configure the required database and authentication variables.

Example:

```env
DATABASE_URL="your-database-url"
DIRECT_URL="your-direct-database-url"

JWT_SECRET="your-development-jwt-secret"

# Add other backend service configuration here
```

Never commit the real `.env` file.

---

## Frontend

Create the appropriate local environment file if required by the current frontend configuration:

```text
apps/web/.env.local
```

Use the environment variable names expected by the existing frontend code.

---

# 5. Configure PostgreSQL / Supabase

NHCE uses PostgreSQL through Supabase.

Create or obtain access to the project's development database.

After configuring the backend environment variables:

```bash
cd apps/api
```

Validate Prisma:

```bash
npx prisma validate
```

Generate Prisma Client:

```bash
npx prisma generate
```

Apply the schema:

```bash
npx prisma db push
```

If the project is using migrations at the time of setup, use the project's migration workflow instead.

---

# 6. Start the Backend

From:

```text
apps/api
```

run:

```bash
npm run dev
```

The API should be available at:

```text
http://localhost:3001
```

---

# 7. Start the Frontend

Open another terminal.

From the repository root:

```bash
npm run dev:web
```

The frontend should be available at:

```text
http://localhost:3000
```

---

# 8. Run the Full Application

You should have two development processes running.

### Terminal 1

```bash
npm run dev:api
```

### Terminal 2

```bash
npm run dev:web
```

Architecture:

```text
Browser
   │
   ▼
Next.js
localhost:3000
   │
   │ REST API
   ▼
Backend
localhost:3001
   │
   ▼
Prisma
   │
   ▼
Supabase PostgreSQL
```

Web3 functionality additionally communicates with:

```text
MetaMask
   │
   ▼
Ethereum Sepolia
   │
   ▼
Smart Contracts
```

---

# 9. Smart Contracts

Compile the contracts:

```bash
npm run compile
```

For Sepolia deployment:

```bash
npm run deploy:sepolia
```

Make sure the required blockchain environment variables and deployment credentials are configured before deploying.

**Never commit private keys or wallet seed phrases.**

---

# 10. Common Prisma Commands

From:

```text
apps/api
```

### Validate schema

```bash
npx prisma validate
```

### Generate Prisma Client

```bash
npx prisma generate
```

### Apply schema changes

```bash
npx prisma db push
```

### Open Prisma Studio

```bash
npx prisma studio
```

---

# 11. Git Development Workflow

Always start from the latest `dev` branch.

```bash
git fetch upstream
git switch dev
git pull --ff-only upstream dev
```

Create your feature branch:

```bash
git switch -c feature/<feature-name>
```

Example:

```bash
git switch -c feature/messaging
```

Push:

```bash
git push -u origin feature/messaging
```

Then open a Pull Request targeting:

```text
atharvaajoshii/nhce → dev
```

---

# 12. Troubleshooting

## Prisma cannot find the schema

Make sure you are inside:

```text
apps/api
```

Then:

```bash
npx prisma generate
```

---

## Prisma requires a driver adapter

The project uses Prisma's PostgreSQL driver adapter.

Make sure the required packages are installed:

```bash
npm install
```

Then regenerate:

```bash
npx prisma generate
```

---

## Database authentication failed

Check:

* `DATABASE_URL`
* `DIRECT_URL`
* Supabase database password
* Supabase project
* Connection host and port

Do not commit database credentials.

---

## Port 3000 already in use

Next.js may automatically select another available port.

Alternatively, stop the process using port 3000.

---

## Port 3001 already in use

Stop the existing API process before starting another backend instance.

---

# 13. Before Opening a Pull Request

Run:

```bash
npm install
```

Then verify:

```bash
npx prisma validate
```

Generate Prisma Client:

```bash
npx prisma generate
```

Run the frontend:

```bash
npm run dev:web
```

Run the backend:

```bash
npm run dev:api
```

If your change affects contracts:

```bash
npm run compile
```

Then check:

```text
✓ Application starts
✓ API starts
✓ Database connects
✓ Prisma schema is valid
✓ No secrets are committed
✓ Existing functionality still works
✓ PR targets dev
```
