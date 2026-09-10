/**
 * @file admin.controller.ts
 * @description Admin console data — real aggregates and lists pulled from the
 * same Job / Dispute / User / JobApplication tables the rest of the platform
 * writes to. No separate "admin" data store; this is a read (and, for dispute
 * resolution, a light write) layer over existing records.
 *
 * Every handler here is mounted behind `authenticateToken` + `requireAdmin`.
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { prisma } from '../config/db.config';
import { DisputeStatus, JobStatus, VoteChoice, MilestoneStatus, LedgerEventType, LedgerStatus } from '@prisma/client';
import { escrowService } from '../services/web3/escrow.service';
import { recordLedgerEvent, isMockTxHash, isMockEscrowAddress } from '../services/ledger.service';

const RELEASED_ISH_STATUSES: JobStatus[] = [
  JobStatus.FREELANCER_SELECTED,
  JobStatus.IN_PROGRESS,
  JobStatus.COMPLETED,
];

export class AdminController {
  /**
   * GET /api/admin/overview
   * Real, aggregate platform counters — no seeded/sample numbers.
   */
  public async getOverview(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const [
        totalUsers,
        clientCount,
        freelancerCount,
        jurorCount,
        totalJobs,
        publishedJobs,
        inProgressJobs,
        completedJobs,
        totalDisputes,
        openDisputes,
        votingDisputes,
        resolvedDisputes,
        totalApplications,
        escrowAgg,
        releasedAgg,
      ] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { role: 'CLIENT' } }),
        prisma.user.count({ where: { role: 'FREELANCER' } }),
        prisma.user.count({ where: { role: 'JUROR' } }),
        prisma.job.count(),
        prisma.job.count({ where: { status: { in: [JobStatus.PUBLISHED, JobStatus.OPEN] } } }),
        prisma.job.count({ where: { status: JobStatus.IN_PROGRESS } }),
        prisma.job.count({ where: { status: JobStatus.COMPLETED } }),
        prisma.dispute.count(),
        prisma.dispute.count({ where: { status: DisputeStatus.OPEN } }),
        prisma.dispute.count({ where: { status: DisputeStatus.VOTING } }),
        prisma.dispute.count({ where: { status: DisputeStatus.RESOLVED } }),
        prisma.jobApplication.count(),
        prisma.job.aggregate({
          _sum: { budget: true },
          where: { status: { in: RELEASED_ISH_STATUSES } },
        }),
        prisma.milestone.aggregate({
          _sum: { amount: true },
          where: { status: 'RELEASED' },
        }),
      ]);

      res.json({
        users: { total: totalUsers, clients: clientCount, freelancers: freelancerCount, jurors: jurorCount },
        jobs: { total: totalJobs, published: publishedJobs, inProgress: inProgressJobs, completed: completedJobs },
        disputes: { total: totalDisputes, open: openDisputes, voting: votingDisputes, resolved: resolvedDisputes },
        applications: { total: totalApplications },
        escrow: {
          lockedVolume: escrowAgg._sum.budget ?? 0,
          releasedVolume: releasedAgg._sum.amount ?? 0,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to load admin overview', message: error.message });
    }
  }

  /**
   * GET /api/admin/users?limit=&cursor=
   * Real platform accounts. Never includes passwordHash / siweNonce.
   */
  public async listUsers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10) || 100, 200);
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;

      const users = await prisma.user.findMany({
        take: limit + 1,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          rating: true,
          walletAddress: true,
          isPro: true,
          jobsPostedCount: true,
          jobsAppliedCount: true,
          onboardingCompleted: true,
          createdAt: true,
        },
      });

      const hasMore = users.length > limit;
      const page = hasMore ? users.slice(0, limit) : users;

      res.json({ users: page, nextCursor: hasMore ? page[page.length - 1].id : null });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to load users', message: error.message });
    }
  }

  /**
   * GET /api/admin/disputes
   * Every dispute with its job/milestone context, participants, and the real
   * juror votes cast so far (no fixed "5 seats" — voting is open to any
   * connected wallet, per dispute.service.ts).
   */
  public async listDisputes(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const disputes = await prisma.dispute.findMany({
        orderBy: { createdAt: 'desc' },
        include: {
          job: {
            include: {
              client: { select: { id: true, name: true, email: true, walletAddress: true } },
              freelancer: { select: { id: true, name: true, email: true, walletAddress: true, rating: true } },
              milestones: { select: { id: true, title: true, amount: true, status: true } },
            },
          },
          milestone: { select: { id: true, title: true, amount: true, status: true } },
          initiator: { select: { id: true, name: true, email: true, role: true } },
          votes: { orderBy: { createdAt: 'asc' } },
        },
      });

      // Best-effort: resolve a juror's wallet address back to a display name.
      const jurorAddresses = Array.from(
        new Set(disputes.flatMap((d) => d.votes.map((v) => v.jurorAddress.toLowerCase())))
      );
      const jurorUsers = jurorAddresses.length
        ? await prisma.user.findMany({
            where: { walletAddress: { in: jurorAddresses } },
            select: { walletAddress: true, name: true, email: true },
          })
        : [];
      const jurorNameByAddress = new Map(
        jurorUsers.map((u) => [u.walletAddress!.toLowerCase(), u.name || u.email?.split('@')[0] || null])
      );

      const shaped = disputes.map((d) => {
        const releasedForJob = d.job.milestones
          .filter((m) => m.status === 'RELEASED')
          .reduce((sum, m) => sum + m.amount, 0);
        const freelancerFavor = d.votes.filter((v) => v.vote === VoteChoice.FREELANCER_FAVOR).length;
        const clientFavor = d.votes.filter((v) => v.vote === VoteChoice.CLIENT_FAVOR).length;

        return {
          id: d.id,
          status: d.status,
          reason: d.reason,
          evidenceUrls: d.evidenceUrls,
          createdAt: d.createdAt,
          job: {
            id: d.job.id,
            title: d.job.title,
            budget: d.job.budget,
            tokenSymbol: d.job.tokenSymbol,
            client: d.job.client,
            freelancer: d.job.freelancer,
          },
          milestone: d.milestone,
          initiator: d.initiator,
          financials: {
            totalBudget: d.job.budget,
            disputedAmount: d.milestone.amount,
            alreadyReleased: releasedForJob,
            remaining: Math.max(0, d.job.budget - releasedForJob - d.milestone.amount),
          },
          votes: d.votes.map((v) => ({
            jurorAddress: v.jurorAddress,
            jurorName: jurorNameByAddress.get(v.jurorAddress.toLowerCase()) ?? null,
            choice: v.vote,
            rewardClaimed: v.rewardClaimed,
            createdAt: v.createdAt,
          })),
          tally: { freelancerFavor, clientFavor, total: d.votes.length },
        };
      });

      res.json({ disputes: shaped });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to load disputes', message: error.message });
    }
  }

  /**
   * POST /api/admin/disputes/:id/resolve
   * Finalizes a dispute by real vote majority (whichever choice has more
   * votes; a tie is rejected). Requires at least one vote.
   *
   * Real fund consequence of the outcome:
   *  - FREELANCER_FAVOR: releases the disputed milestone for real, through
   *    the same escrowService.releaseMilestonePayment() call the normal
   *    (non-disputed) release flow uses.
   *  - CLIENT_FAVOR: the JobEscrow contract has no refund function (only
   *    releaseMilestone, which pays the freelancer) — so there is no real
   *    on-chain transfer to trigger. The funds simply stay unreleased in
   *    the vault; this just marks the milestone REFUNDED so it stops
   *    appearing as payable and the ledger records what happened.
   */
  public async resolveDispute(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const dispute = await prisma.dispute.findUnique({
        where: { id },
        include: { votes: true, milestone: { include: { job: true } } },
      });
      if (!dispute) {
        res.status(404).json({ error: 'Dispute not found' });
        return;
      }
      if (dispute.status === DisputeStatus.RESOLVED) {
        res.status(409).json({ error: 'Dispute is already resolved' });
        return;
      }
      const freelancerFavor = dispute.votes.filter((v) => v.vote === VoteChoice.FREELANCER_FAVOR).length;
      const clientFavor = dispute.votes.filter((v) => v.vote === VoteChoice.CLIENT_FAVOR).length;
      if (freelancerFavor === 0 && clientFavor === 0) {
        res.status(409).json({ error: 'Cannot resolve a dispute with no votes cast' });
        return;
      }
      if (freelancerFavor === clientFavor) {
        res.status(409).json({ error: 'Vote is tied — cannot auto-resolve. Wait for another vote.' });
        return;
      }

      const outcome: VoteChoice = freelancerFavor > clientFavor ? VoteChoice.FREELANCER_FAVOR : VoteChoice.CLIENT_FAVOR;

      const milestone = dispute.milestone;
      const job = milestone?.job;
      let fundOutcome: 'RELEASED_TO_FREELANCER' | 'REFUNDED_TO_CLIENT' | 'ALREADY_SETTLED' | 'SKIPPED_NO_MILESTONE' =
        'SKIPPED_NO_MILESTONE';
      let releaseTxHash: string | null = null;
      let releaseError: string | null = null;

      if (milestone && job) {
        const alreadySettled =
          milestone.status === MilestoneStatus.RELEASED || milestone.status === MilestoneStatus.REFUNDED;

        if (alreadySettled) {
          fundOutcome = 'ALREADY_SETTLED';
        } else if (outcome === VoteChoice.FREELANCER_FAVOR) {
          const escrowAddress = job.escrowAddress || '0x' + '1'.repeat(40);
          void recordLedgerEvent({
            jobId: job.id,
            milestoneId: milestone.id,
            escrowId: escrowAddress,
            eventType: LedgerEventType.PAYMENT_PENDING,
            status: LedgerStatus.PENDING,
            actorId: req.user?.id ?? null,
            actorRole: req.user?.role ?? null,
            amount: milestone.amount,
            currency: job.tokenSymbol,
            previousStatus: milestone.status,
            newStatus: null,
            description: `Dispute resolved in freelancer's favor — releasing milestone payout`,
            details: { disputeId: dispute.id },
            dedupeKey: `payment-pending:${milestone.id}:${Date.now()}`,
          });

          try {
            const releaseResult = await escrowService.releaseMilestonePayment(escrowAddress, 1);
            releaseTxHash = releaseResult.txHash;
            const mocked = isMockTxHash(releaseResult.txHash) || isMockEscrowAddress(escrowAddress);

            await prisma.milestone.update({ where: { id: milestone.id }, data: { status: MilestoneStatus.RELEASED } });

            void recordLedgerEvent({
              jobId: job.id,
              milestoneId: milestone.id,
              escrowId: escrowAddress,
              eventType: LedgerEventType.MILESTONE_RELEASED,
              status: mocked ? LedgerStatus.PENDING : LedgerStatus.CONFIRMED,
              actorId: req.user?.id ?? null,
              actorRole: req.user?.role ?? null,
              amount: milestone.amount,
              currency: job.tokenSymbol,
              previousStatus: milestone.status,
              newStatus: MilestoneStatus.RELEASED,
              description: mocked
                ? 'Milestone released per dispute resolution (devnet mock payout — no real on-chain settlement)'
                : 'Milestone released on-chain per dispute resolution',
              details: { disputeId: dispute.id },
              blockchainTransactionHash: releaseResult.txHash,
              dedupeKey: `milestone-released:${milestone.id}`,
            });
            fundOutcome = 'RELEASED_TO_FREELANCER';
          } catch (err: any) {
            releaseError = String(err?.message || err);
            void recordLedgerEvent({
              jobId: job.id,
              milestoneId: milestone.id,
              escrowId: escrowAddress,
              eventType: LedgerEventType.PAYMENT_FAILED,
              status: LedgerStatus.FAILED,
              actorId: req.user?.id ?? null,
              actorRole: req.user?.role ?? null,
              amount: milestone.amount,
              currency: job.tokenSymbol,
              previousStatus: milestone.status,
              newStatus: milestone.status,
              description: 'Milestone release (from dispute resolution) failed',
              details: { disputeId: dispute.id, errorMessage: releaseError },
              dedupeKey: `payment-failed:${milestone.id}:${Date.now()}`,
            });
            // Resolution still proceeds — the dispute outcome itself is
            // final even if the on-chain release call failed; the failure
            // is visible in the ledger for follow-up.
          }
        } else {
          // CLIENT_FAVOR — no on-chain refund capability exists; record the
          // real, honest outcome: no payout, milestone marked refunded.
          await prisma.milestone.update({ where: { id: milestone.id }, data: { status: MilestoneStatus.REFUNDED } });
          void recordLedgerEvent({
            jobId: job.id,
            milestoneId: milestone.id,
            escrowId: job.escrowAddress,
            eventType: LedgerEventType.PAYMENT_REFUNDED,
            status: LedgerStatus.CONFIRMED,
            actorId: req.user?.id ?? null,
            actorRole: req.user?.role ?? null,
            amount: milestone.amount,
            currency: job.tokenSymbol,
            previousStatus: milestone.status,
            newStatus: MilestoneStatus.REFUNDED,
            description:
              'Dispute resolved in client\'s favor — milestone funds remain unreleased in escrow (no on-chain refund transfer: the escrow contract has no refund function)',
            details: { disputeId: dispute.id },
            dedupeKey: `payment-refunded:${milestone.id}`,
          });
          fundOutcome = 'REFUNDED_TO_CLIENT';
        }
      }

      const updated = await prisma.dispute.update({
        where: { id },
        data: { status: DisputeStatus.RESOLVED },
      });

      res.json({
        message: 'Dispute resolved',
        dispute: updated,
        outcome,
        tally: { freelancerFavor, clientFavor },
        fundOutcome,
        releaseTxHash,
        releaseError,
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to resolve dispute', message: error.message });
    }
  }

  /**
   * GET /api/admin/activity
   * Recent platform activity, derived from real timestamps on Jobs,
   * Disputes, and Applications — not a separate persisted audit log.
   */
  public async listActivity(_req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const [recentJobs, recentDisputes, recentApplications] = await Promise.all([
        prisma.job.findMany({
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: { client: { select: { name: true, email: true } } },
        }),
        prisma.dispute.findMany({
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: {
            job: { select: { title: true } },
            initiator: { select: { name: true, email: true } },
          },
        }),
        prisma.jobApplication.findMany({
          orderBy: { createdAt: 'desc' },
          take: 15,
          include: {
            job: { select: { title: true } },
            freelancer: { select: { name: true, email: true } },
          },
        }),
      ]);

      const events = [
        ...recentJobs.map((j) => ({
          id: `job-${j.id}`,
          type: 'JOB_POSTED' as const,
          title: j.title,
          actor: j.client?.name || j.client?.email || 'A client',
          detail: `Job posted with status ${j.status}`,
          amount: j.budget,
          timestamp: j.createdAt,
        })),
        ...recentDisputes.map((d) => ({
          id: `dispute-${d.id}`,
          type: 'DISPUTE_OPENED' as const,
          title: d.job?.title || 'Untitled job',
          actor: d.initiator?.name || d.initiator?.email || 'A participant',
          detail: d.reason,
          amount: undefined,
          timestamp: d.createdAt,
        })),
        ...recentApplications.map((a) => ({
          id: `application-${a.id}`,
          type: 'APPLICATION_SUBMITTED' as const,
          title: a.job?.title || 'Untitled job',
          actor: a.freelancer?.name || a.freelancer?.email || 'A freelancer',
          detail: `Applied at $${a.requestedRate}/proposal — status ${a.status}`,
          amount: a.requestedRate,
          timestamp: a.createdAt,
        })),
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      res.json({ activity: events.slice(0, 30) });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to load activity', message: error.message });
    }
  }
}

export const adminController = new AdminController();
