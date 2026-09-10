-- Minimal, additive-only change: one new MilestoneStatus value used when a
-- dispute resolves in the client's favor. Does not touch any existing rows,
-- columns, or enum values.

ALTER TYPE "MilestoneStatus" ADD VALUE 'REFUNDED';
