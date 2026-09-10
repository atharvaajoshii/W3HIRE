/**
 * @file dispute.controller.ts
 * @description Decentralized Dispute Resolution Controller.
 * Handles opening dispute cases, recording juror votes, micro-reward claims, and resolution updates.
 */

import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { disputeService } from '../services/dispute.service';
import { prisma } from '../config/db.config';
import { VoteChoice } from '../models/Dispute';

export class DisputeController {
  /**
   * POST /api/disputes/open
   * Raise a dispute for a job milestone
   */
  public async openDispute(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const { jobId, milestoneId, reason, evidenceUrls } = req.body;

      if (!jobId || !milestoneId || !reason) {
        res.status(400).json({ error: 'Missing required parameters: jobId, milestoneId, and reason' });
        return;
      }

      const result = await disputeService.openDisputeCase(
        jobId,
        milestoneId,
        req.user.id,
        reason,
        evidenceUrls || []
      );

      res.status(201).json({
        message: 'Dispute case opened successfully',
        dispute: result.dispute,
        assignedJurors: result.jurorAddresses,
        txHash: result.txHash
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to open dispute case', message: error.message });
    }
  }

  /**
   * POST /api/disputes/:id/vote
   * Submit juror vote choice
   */
  public async castVote(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const id = String(req.params.id);
      const { choice, jurorAddress } = req.body;

      if (!choice || !Object.values(VoteChoice).includes(choice)) {
        res.status(400).json({ error: 'Invalid vote choice. Expected FREELANCER_FAVOR or CLIENT_FAVOR' });
        return;
      }

      // Normal (non-admin) callers vote as their own linked wallet only. The
      // admin console has no wallet of its own (its JWT carries no
      // walletAddress) — it operates on behalf of assigned jurors for
      // oversight, so for an ADMIN caller it either uses an explicitly given
      // jurorAddress, or auto-assigns the next not-yet-voted juror slot so
      // the admin doesn't need to supply a wallet address at all.
      let voterAddress = req.user.walletAddress;
      if (!voterAddress && req.user.role === 'ADMIN') {
        if (typeof jurorAddress === 'string' && jurorAddress) {
          if (!/^0x[a-fA-F0-9]{40}$/.test(jurorAddress)) {
            res.status(400).json({ error: 'jurorAddress must be a valid 0x-prefixed wallet address' });
            return;
          }
          voterAddress = jurorAddress;
        } else {
          const nextSlot = await disputeService.pickNextJurorSlot(id);
          if (!nextSlot) {
            res.status(409).json({ error: 'Every assigned juror has already voted on this dispute' });
            return;
          }
          voterAddress = nextSlot;
        }
      }

      if (!voterAddress) {
        res.status(400).json({ error: 'A connected wallet is required to vote on disputes' });
        return;
      }

      const voteRecord = await disputeService.castJurorVote(id, voterAddress, choice as VoteChoice);

      res.json({
        message: 'Juror vote recorded successfully',
        vote: voteRecord
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to submit vote', message: error.message });
    }
  }

  /**
   * POST /api/disputes/:id/claim-reward
   * Claim juror participation micro-reward
   */
  public async claimReward(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      if (!req.user.walletAddress) {
        res.status(400).json({ error: 'A connected wallet is required to claim juror rewards' });
        return;
      }

      const id = String(req.params.id);
      const claimResult = await disputeService.claimJurorReward(id, req.user.walletAddress);

      res.json({
        message: 'Juror micro-reward claimed successfully',
        claim: claimResult
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to claim micro-reward', message: error.message });
    }
  }

  /**
   * GET /api/disputes/:id
   * Fetch dispute case details and vote breakdown
   */
  public async getDisputeById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const id = String(req.params.id);
      const dispute = await prisma.dispute.findUnique({
        where: { id },
        include: { job: true, milestone: true, votes: true }
      });

      if (!dispute) {
        res.status(404).json({ error: 'Dispute case not found' });
        return;
      }

      res.json({ dispute });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch dispute details', message: error.message });
    }
  }
}

export const disputeController = new DisputeController();
