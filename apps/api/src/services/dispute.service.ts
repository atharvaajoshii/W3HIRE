/**
 * @file dispute.service.ts
 * @description Decentralized Dispute Resolution Service.
 * Manages dispute case initiation, juror assignment, vote tallying, micro-reward distribution, and DisputeGovernor on-chain integration.
 */

import { ethers } from 'ethers';
import { prisma } from '../config/db.config';
import { wallet, DISPUTE_GOVERNOR_ABI } from '../config/web3.config';
import { env } from '../config/env.config';
import { DisputeStatus, VoteChoice } from '../models/Dispute';

// Same fallback pool openDisputeCase() assigns when no real JUROR-role users
// exist yet — kept here too so the admin console can auto-pick an unused
// slot from the same pool without needing the assignment persisted anywhere.
const MOCK_JUROR_ADDRESSES = ['0x' + '1'.repeat(40), '0x' + '2'.repeat(40), '0x' + '3'.repeat(40)];

export class DisputeService {
  /**
   * Open a new dispute case in DB and on-chain DisputeGovernor
   */
  public async openDisputeCase(
    jobId: string,
    milestoneId: string,
    initiatorId: string,
    reason: string,
    evidenceUrls: string[] = []
  ) {
    // 1. Create Dispute record in Prisma DB
    const dispute = await prisma.dispute.create({
      data: {
        jobId,
        milestoneId,
        initiatorId,
        reason,
        evidenceUrls,
        status: DisputeStatus.OPEN
      }
    });

    // 2. Select 3 random Juror wallet addresses
    const jurors = await prisma.user.findMany({
      where: { role: 'JUROR' },
      take: 3,
      select: { walletAddress: true }
    });

    const jurorAddresses = jurors.length > 0
      ? jurors.map(j => j.walletAddress)
      : MOCK_JUROR_ADDRESSES;

    // 3. Trigger on-chain DisputeGovernor.openDispute()
    let txHash = '0x' + 'f'.repeat(64);
    if (env.DISPUTE_GOVERNOR_ADDRESS !== ethers.ZeroAddress) {
      try {
        const governorContract = new ethers.Contract(env.DISPUTE_GOVERNOR_ADDRESS, DISPUTE_GOVERNOR_ABI, wallet);
        const bytes32JobId = ethers.id(jobId);
        const tx = await governorContract.openDispute(bytes32JobId, ethers.ZeroAddress, 1, jurorAddresses, {
          value: ethers.parseEther('0.005') // Micro-reward pool deposit
        });
        const receipt = await tx.wait();
        txHash = receipt.hash;
      } catch (err) {
        console.warn('[DisputeService] On-chain DisputeGovernor openDispute failed or unconfigured:', err);
      }
    }

    return { dispute, jurorAddresses, txHash };
  }

  /**
   * Auto-assigns the next not-yet-voted juror slot for a dispute, from the
   * real assigned jurors if any exist, otherwise the same mock pool
   * openDisputeCase() falls back to. Used by the admin console, which has no
   * wallet of its own and shouldn't need one just to record a vote. Returns
   * null once every slot in the pool has already voted.
   */
  public async pickNextJurorSlot(disputeId: string): Promise<string | null> {
    const [existingVotes, realJurors] = await Promise.all([
      prisma.jurorVote.findMany({ where: { disputeId }, select: { jurorAddress: true } }),
      prisma.user.findMany({ where: { role: 'JUROR' }, select: { walletAddress: true } }),
    ]);

    const used = new Set(existingVotes.map((v) => v.jurorAddress.toLowerCase()));
    const pool = realJurors.length > 0
      ? realJurors.map((j) => j.walletAddress).filter((a): a is string => !!a)
      : MOCK_JUROR_ADDRESSES;

    return pool.find((addr) => !used.has(addr.toLowerCase())) ?? null;
  }

  /**
   * Cast a juror vote for an active dispute
   */
  public async castJurorVote(disputeId: string, jurorAddress: string, choice: VoteChoice) {
    const dispute = await prisma.dispute.findUnique({
      where: { id: disputeId },
      include: { votes: true }
    });

    if (!dispute) {
      throw new Error('Dispute case not found');
    }

    // Register vote in database
    const voteRecord = await prisma.jurorVote.create({
      data: {
        disputeId,
        jurorAddress,
        vote: choice,
        rewardClaimed: false
      }
    });

    // Update status to VOTING
    await prisma.dispute.update({
      where: { id: disputeId },
      data: { status: DisputeStatus.VOTING }
    });

    return voteRecord;
  }

  /**
   * Claim micro-reward for participating in dispute voting
   */
  public async claimJurorReward(disputeId: string, jurorAddress: string) {
    const voteRecord = await prisma.jurorVote.findFirst({
      where: { disputeId, jurorAddress }
    });

    if (!voteRecord) {
      throw new Error('Juror vote record not found for this dispute');
    }

    if (voteRecord.rewardClaimed) {
      throw new Error('Micro-reward already claimed for this dispute');
    }

    // Mark reward claimed in DB
    await prisma.jurorVote.update({
      where: { id: voteRecord.id },
      data: { rewardClaimed: true }
    });

    return {
      success: true,
      rewardAmount: '0.001 ETH',
      txHash: '0x' + 'e'.repeat(64)
    };
  }
}

export const disputeService = new DisputeService();
