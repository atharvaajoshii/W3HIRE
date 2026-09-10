# NHCE Architecture

## System Overview

```text
                         ┌─────────────────────┐
                         │       Next.js       │
                         │     Web Client      │
                         └──────────┬──────────┘
                                    │
                               REST API
                                    │
                         ┌──────────▼──────────┐
                         │      Backend API     │
                         │   Node.js / NestJS   │
                         └──────────┬──────────┘
                                    │
                              Prisma ORM
                                    │
                         ┌──────────▼──────────┐
                         │ PostgreSQL /         │
                         │ Supabase             │
                         └──────────────────────┘

                                    │
                              Web3 / EVM
                                    │
                         ┌──────────▼──────────┐
                         │      Ethereum        │
                         │       Sepolia        │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │   Smart Contracts    │
                         │ Escrow / Payments /  │
                         │ Dispute Infrastructure│
                         └──────────────────────┘
