import { injectable, inject } from "tsyringe";
import createHttpError from "http-errors";
import { Prisma, PrismaClient } from "../../generated/prisma/client";
import {
  MlmCommissionType,
  UserRank,
  WalletTxnStatus,
  WalletTxnType,
  WithdrawalStatus,
} from "../../generated/prisma/enums";

// 4-Level Commission Percentage Plan (Level 1: 7%, Level 2: 3%, Level 3: 2.5%, Level 4: 2%)
export const LEVEL_COMMISSION_RATES: Record<number, number> = {
  1: 0.07, // 7%
  2: 0.03, // 3%
  3: 0.025, // 2.5%
  4: 0.02, // 2%
};

// Pure Cumulative Revenue Thresholds for Ranks
export const REVENUE_RANK_THRESHOLDS: {
  rank: UserRank;
  minRevenue: number;
  label: string;
  leadershipBonusRate: number;
}[] = [
  { rank: UserRank.DIAMOND, minRevenue: 810000, label: "Diamond", leadershipBonusRate: 0.02 },
  { rank: UserRank.PLATINUM, minRevenue: 270000, label: "Platinum", leadershipBonusRate: 0.015 },
  { rank: UserRank.GOLD, minRevenue: 90000, label: "Gold", leadershipBonusRate: 0.01 },
  { rank: UserRank.SILVER, minRevenue: 30000, label: "Silver", leadershipBonusRate: 0 },
  { rank: UserRank.BRONZE, minRevenue: 0, label: "Bronze", leadershipBonusRate: 0 },
];

export interface RankProgressInfo {
  currentRank: UserRank;
  badgeLabel: string;
  currentRevenue: number;
  nextRank: UserRank | null;
  nextRankLabel: string | null;
  nextRankTarget: number | null;
  remainingToNext: number;
  progressPercent: number;
}

@injectable()
export class MlmService {
  constructor(
    @inject("PrismaClient") private readonly prisma: PrismaClient
  ) {}

  /**
   * Determine rank from pure cumulative revenue
   */
  calculateRank(revenue: number): UserRank {
    for (const threshold of REVENUE_RANK_THRESHOLDS) {
      if (revenue >= threshold.minRevenue) {
        return threshold.rank;
      }
    }
    return UserRank.BRONZE;
  }

  /**
   * Calculate detailed rank progression meter (0 - 100%)
   */
  getRankProgress(currentRevenue: number): RankProgressInfo {
    const rev = Math.max(0, currentRevenue);
    let currentRank: UserRank = UserRank.BRONZE;
    let badgeLabel = "Bronze";
    let nextRank: UserRank | null = UserRank.SILVER;
    let nextRankLabel: string | null = "Silver";
    let nextRankTarget: number | null = 30000;
    let prevThreshold = 0;

    if (rev >= 810000) {
      currentRank = UserRank.DIAMOND;
      badgeLabel = "Diamond";
      nextRank = null;
      nextRankLabel = null;
      nextRankTarget = null;
      prevThreshold = 810000;
    } else if (rev >= 270000) {
      currentRank = UserRank.PLATINUM;
      badgeLabel = "Platinum";
      nextRank = UserRank.DIAMOND;
      nextRankLabel = "Diamond";
      nextRankTarget = 810000;
      prevThreshold = 270000;
    } else if (rev >= 90000) {
      currentRank = UserRank.GOLD;
      badgeLabel = "Gold";
      nextRank = UserRank.PLATINUM;
      nextRankLabel = "Platinum";
      nextRankTarget = 270000;
      prevThreshold = 90000;
    } else if (rev >= 30000) {
      currentRank = UserRank.SILVER;
      badgeLabel = "Silver";
      nextRank = UserRank.GOLD;
      nextRankLabel = "Gold";
      nextRankTarget = 90000;
      prevThreshold = 30000;
    } else {
      currentRank = UserRank.BRONZE;
      badgeLabel = "Bronze";
      nextRank = UserRank.SILVER;
      nextRankLabel = "Silver";
      nextRankTarget = 30000;
      prevThreshold = 0;
    }

    const remainingToNext = nextRankTarget ? Math.max(0, nextRankTarget - rev) : 0;
    const progressPercent = nextRankTarget
      ? Math.min(100, Math.round(((rev - prevThreshold) / (nextRankTarget - prevThreshold)) * 100))
      : 100;

    return {
      currentRank,
      badgeLabel,
      currentRevenue: rev,
      nextRank,
      nextRankLabel,
      nextRankTarget,
      remainingToNext,
      progressPercent,
    };
  }

  /**
   * Distribute MLM commissions when an order is completed and paid.
   * Updates PV, BV, distributes 4-level commissions, awards leadership bonuses, and updates ranks.
   */
  async distributeOrderCommissions(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: { include: { product: true } },
      },
    });

    if (!order) throw createHttpError(404, "Order not found.");

    // Check if commissions have already been distributed for this order
    const existingCount = await this.prisma.mlmCommission.count({
      where: { orderId },
    });
    if (existingCount > 0) return { message: "Commissions already processed." };

    // Calculate total order PV and BV
    let totalPv = new Prisma.Decimal(0);
    let totalBv = new Prisma.Decimal(0);

    for (const item of order.items) {
      const qty = item.quantity;
      const pPv = item.product.pv ? item.product.pv.times(qty) : new Prisma.Decimal(0);
      const pBv = item.product.bv
        ? item.product.bv.times(qty)
        : item.product.price.times(qty); // fallback to price if BV is 0

      totalPv = totalPv.plus(pPv);
      totalBv = totalBv.plus(pBv);
    }

    if (totalBv.lte(0)) {
      totalBv = order.totalAmount;
    }

    const customerId = order.customerId;
    const customer = order.customer;

    // 1. Update personal PV and BV of customer
    if (customer) {
      await this.prisma.user.update({
        where: { id: customerId },
        data: {
          pv: customer.pv.plus(totalPv),
          bv: customer.bv.plus(totalBv),
        },
      });
    }

    // If customer has no sponsor, this was a normal customer purchase -> finish
    if (!customer?.sponsorId) {
      return {
        success: true,
        message: "Retail order completed. Personal PV updated.",
        totalPv,
        totalBv,
      };
    }

    let currentSponsorId: string | null = customer.sponsorId;
    let level = 1;

    while (currentSponsorId && level <= 4) {
      const sponsor: any = await this.prisma.user.findUnique({
        where: { id: currentSponsorId },
        include: {
          vendorProfile: true,
        },
      });

      if (!sponsor) break;

      const rate = LEVEL_COMMISSION_RATES[level] || 0;
      const commissionAmount = totalBv.times(rate);

      if (commissionAmount.gt(0)) {
        // Record MLM commission
        await this.prisma.mlmCommission.create({
          data: {
            userId: sponsor.id,
            orderId: order.id,
            level,
            percentage: new Prisma.Decimal(rate * 100),
            commissionType:
              level === 1
                ? MlmCommissionType.DIRECT_BONUS
                : MlmCommissionType.LEVEL_BONUS,
            amount: commissionAmount,
            bv: totalBv,
            status: "CREDITED",
          },
        });

        // Credit to sponsor's wallet (vendor or user)
        const vendor = await this.prisma.vendor.findFirst({
          where: {
            OR: [{ email: sponsor.email }, { phone: sponsor.phone || "" }],
          },
          include: { wallet: true },
        });

        if (vendor?.wallet) {
          const newBal = vendor.wallet.balance.plus(commissionAmount);
          await this.prisma.wallet.update({
            where: { id: vendor.wallet.id },
            data: {
              balance: newBal,
              totalEarned: vendor.wallet.totalEarned.plus(commissionAmount),
            },
          });

          await this.prisma.walletTransaction.create({
            data: {
              walletId: vendor.wallet.id,
              type: WalletTxnType.COMMISSION_CREDIT,
              status: WalletTxnStatus.SUCCESS,
              amount: commissionAmount,
              balanceAfter: newBal,
              referenceId: order.id,
              note: `Level ${level} MLM Commission from order #${order.id.slice(0, 8)}`,
            },
          });

          await this.prisma.notification.create({
            data: {
              vendorId: vendor.id,
              title: "MLM Commission Credited! 🎉",
              message: `₹${commissionAmount.toFixed(2)} credited to your wallet (Level ${level} Commission).`,
              type: "COMMISSION",
            },
          });
        }

        // Update sponsor's BV (cumulative revenue) and total earnings
        const newTotalEarned = sponsor.totalEarnings.plus(commissionAmount);
        const newBv = sponsor.bv.plus(totalBv);

        // Check for Pure Cumulative Revenue Rank Upgrade
        const newRank = this.calculateRank(newBv.toNumber());
        const isRankUpgrade = newRank !== sponsor.rank;

        await this.prisma.user.update({
          where: { id: sponsor.id },
          data: {
            bv: newBv,
            totalEarnings: newTotalEarned,
            rank: newRank,
          },
        });

        // If sponsor is also a vendor, sync rank and BV
        if (vendor) {
          await this.prisma.vendor.update({
            where: { id: vendor.id },
            data: {
              bv: newBv,
              totalEarnings: newTotalEarned,
              rank: newRank,
            },
          });
        }

        // Handle Leadership Bonus and Rank Promotion Alert
        if (isRankUpgrade) {
          const tierInfo = REVENUE_RANK_THRESHOLDS.find((t) => t.rank === newRank);
          if (vendor) {
            await this.prisma.notification.create({
              data: {
                vendorId: vendor.id,
                title: `Rank Promoted: ${tierInfo?.label || newRank}! 🏆`,
                message: `Congratulations! Your total network revenue reached ₹${newBv.toFixed(0)}. You are now a ${tierInfo?.label || newRank} Partner!`,
                type: "RANK_UPGRADE",
              },
            });
          }

          // Award Leadership Milestone Bonus if promoted to Gold, Platinum, or Diamond
          if (tierInfo && tierInfo.leadershipBonusRate > 0) {
            const leadershipBonus = totalBv.times(tierInfo.leadershipBonusRate);
            if (leadershipBonus.gt(0)) {
              await this.prisma.mlmCommission.create({
                data: {
                  userId: sponsor.id,
                  orderId: order.id,
                  level,
                  percentage: new Prisma.Decimal(tierInfo.leadershipBonusRate * 100),
                  commissionType: MlmCommissionType.LEADERSHIP_BONUS,
                  amount: leadershipBonus,
                  bv: totalBv,
                  status: "CREDITED",
                },
              });

              if (vendor?.wallet) {
                const bonusBal = vendor.wallet.balance.plus(leadershipBonus);
                await this.prisma.wallet.update({
                  where: { id: vendor.wallet.id },
                  data: {
                    balance: bonusBal,
                    totalEarned: vendor.wallet.totalEarned.plus(leadershipBonus),
                  },
                });

                await this.prisma.walletTransaction.create({
                  data: {
                    walletId: vendor.wallet.id,
                    type: WalletTxnType.COMMISSION_CREDIT,
                    status: WalletTxnStatus.SUCCESS,
                    amount: leadershipBonus,
                    balanceAfter: bonusBal,
                    referenceId: order.id,
                    note: `Leadership Bonus for ${tierInfo.label} Rank from order #${order.id.slice(0, 8)}`,
                  },
                });
              }
            }
          }
        }
      }

      currentSponsorId = sponsor.sponsorId;
      level++;
    }

    return { success: true, totalPv, totalBv };
  }

  /**
   * Get user or vendor MLM Dashboard summary
   */
  async getDashboard(identifier: { userId?: string; vendorId?: string }) {
    let user = null;
    let vendor = null;

    if (identifier.userId) {
      user = await this.prisma.user.findUnique({
        where: { id: identifier.userId },
        include: {
          referrals: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              rank: true,
              pv: true,
              bv: true,
              createdAt: true,
            },
          },
        },
      });
    }

    if (identifier.vendorId) {
      vendor = await this.prisma.vendor.findUnique({
        where: { id: identifier.vendorId },
        include: {
          wallet: true,
          referrals: {
            select: {
              id: true,
              fullName: true,
              phone: true,
              rank: true,
              pv: true,
              bv: true,
              createdAt: true,
            },
          },
        },
      });
    }

    const where = identifier.userId
      ? { userId: identifier.userId }
      : { vendorId: identifier.vendorId };

    const [commissions, totalCommissions] = await Promise.all([
      this.prisma.mlmCommission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      this.prisma.mlmCommission.aggregate({
        where,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const directBonusSum = await this.prisma.mlmCommission.aggregate({
      where: { ...where, commissionType: MlmCommissionType.DIRECT_BONUS },
      _sum: { amount: true },
    });

    const levelBonusSum = await this.prisma.mlmCommission.aggregate({
      where: { ...where, commissionType: MlmCommissionType.LEVEL_BONUS },
      _sum: { amount: true },
    });

    const leadershipBonusSum = await this.prisma.mlmCommission.aggregate({
      where: { ...where, commissionType: MlmCommissionType.LEADERSHIP_BONUS },
      _sum: { amount: true },
    });

    const currentBv = (vendor?.bv || user?.bv || new Prisma.Decimal(0)).toNumber();
    const rankProgress = this.getRankProgress(currentBv);

    return {
      rank: vendor?.rank || user?.rank || UserRank.BRONZE,
      rankProgress,
      pv: vendor?.pv || user?.pv || 0,
      bv: vendor?.bv || user?.bv || 0,
      totalEarnings: vendor?.totalEarnings || user?.totalEarnings || 0,
      referralCode: vendor?.referralCode || user?.referralCode || null,
      directReferralsCount: vendor?.referrals.length || user?.referrals.length || 0,
      directReferrals: vendor?.referrals || user?.referrals || [],
      earningsBreakdown: {
        totalEarned: totalCommissions._sum.amount || 0,
        directBonus: directBonusSum._sum.amount || 0,
        levelBonus: levelBonusSum._sum.amount || 0,
        leadershipBonus: leadershipBonusSum._sum.amount || 0,
        commissionCount: totalCommissions._count || 0,
      },
      recentCommissions: commissions,
    };
  }

  /**
   * Get genealogy tree / downline network
   */
  async getGenealogyTree(userId: string, depth = 3) {
    const buildTree = async (currentId: string, currentDepth: number): Promise<any> => {
      if (currentDepth > depth) return [];

      const directs = await this.prisma.user.findMany({
        where: { sponsorId: currentId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          rank: true,
          pv: true,
          bv: true,
          totalEarnings: true,
          createdAt: true,
        },
      });

      const tree = [];
      for (const d of directs) {
        const children = await buildTree(d.id, currentDepth + 1);
        tree.push({
          ...d,
          level: currentDepth,
          downline: children,
        });
      }
      return tree;
    };

    const rootUser = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        rank: true,
        pv: true,
        bv: true,
        referralCode: true,
      },
    });

    if (!rootUser) throw createHttpError(404, "User not found.");

    const network = await buildTree(userId, 1);
    return { root: rootUser, network };
  }

  /**
   * Request withdrawal from wallet
   */
  async requestWithdrawal(input: {
    userId?: string;
    vendorId?: string;
    amount: number;
    bankAccount?: string;
    ifsc?: string;
    upiId?: string;
  }) {
    if (input.amount < 100) {
      throw createHttpError(400, "Minimum withdrawal amount is ₹100.");
    }

    let wallet = null;

    if (input.vendorId) {
      wallet = await this.prisma.wallet.findUnique({
        where: { vendorId: input.vendorId },
      });
    } else if (input.userId) {
      const user = await this.prisma.user.findUnique({
        where: { id: input.userId },
      });
      const vendor = await this.prisma.vendor.findFirst({
        where: {
          OR: [{ email: user?.email }, { phone: user?.phone || "" }],
        },
        include: { wallet: true },
      });
      wallet = vendor?.wallet || null;
    }

    if (!wallet || wallet.balance.lt(input.amount)) {
      throw createHttpError(400, "Insufficient wallet balance.");
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Deduct balance and increment lockedBalance
      const newBal = wallet.balance.minus(input.amount);
      const newLocked = wallet.lockedBalance.plus(input.amount);

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: newBal,
          lockedBalance: newLocked,
          totalSpent: wallet.totalSpent.plus(input.amount),
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: WalletTxnType.WITHDRAWAL,
          status: WalletTxnStatus.PENDING,
          amount: new Prisma.Decimal(input.amount),
          balanceAfter: newBal,
          note: `Withdrawal request to ${input.upiId || input.bankAccount || "Bank"}`,
        },
      });

      const withdrawal = await tx.withdrawalRequest.create({
        data: {
          userId: input.userId,
          vendorId: input.vendorId,
          amount: new Prisma.Decimal(input.amount),
          bankAccount: input.bankAccount,
          ifsc: input.ifsc,
          upiId: input.upiId,
          status: WithdrawalStatus.PENDING,
        },
      });

      return withdrawal;
    });

    // Alert Admins of new withdrawal request
    await this.prisma.user
      .findMany({
        where: {
          role: { in: ["ADMIN", "SADMIN"] as any },
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      })
      .then(async (admins) => {
        if (admins.length > 0) {
          await this.prisma.notification.createMany({
            data: admins.map((a) => ({
              userId: a.id,
              title: "Withdrawal Requested 🏦",
              message: `${input.vendorId ? "Technician" : "Customer"} requested a withdrawal payout of ₹${input.amount}.`,
              type: "WITHDRAWAL_REQUESTED",
            })),
          });
        }
      })
      .catch((err) => console.error("[Notify Admins Withdrawal Error]", err));

    return result;
  }

  /**
   * List withdrawals for Admin
   */
  async listWithdrawals(status?: WithdrawalStatus, page = 1, limit = 20) {
    const where = status ? { status } : {};
    const [data, total] = await Promise.all([
      this.prisma.withdrawalRequest.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: true,
          vendor: true,
        },
      }),
      this.prisma.withdrawalRequest.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Admin review withdrawal request (Approve / Reject / Mark Paid)
   */
  async reviewWithdrawal(
    id: string,
    status: WithdrawalStatus,
    adminNote?: string,
    transactionRef?: string
  ) {
    const withdrawal = await this.prisma.withdrawalRequest.findUnique({
      where: { id },
      include: { vendor: { include: { wallet: true } }, user: true },
    });

    if (!withdrawal) throw createHttpError(404, "Withdrawal request not found.");
    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw createHttpError(400, `Withdrawal is already ${withdrawal.status}.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const walletId = withdrawal.vendor?.wallet?.id;

      if (status === WithdrawalStatus.REJECTED && walletId) {
        // Refund locked balance back to balance
        const w = await tx.wallet.findUnique({ where: { id: walletId } });
        if (w) {
          await tx.wallet.update({
            where: { id: walletId },
            data: {
              balance: w.balance.plus(withdrawal.amount),
              lockedBalance: w.lockedBalance.minus(withdrawal.amount),
            },
          });

          await tx.walletTransaction.create({
            data: {
              walletId,
              type: WalletTxnType.ADMIN_CREDIT,
              status: WalletTxnStatus.SUCCESS,
              amount: withdrawal.amount,
              balanceAfter: w.balance.plus(withdrawal.amount),
              note: `Refund for rejected withdrawal #${withdrawal.id}: ${adminNote || ""}`,
            },
          });
        }
      } else if ((status === WithdrawalStatus.APPROVED || status === WithdrawalStatus.PAID) && walletId) {
        // Clear locked balance
        const w = await tx.wallet.findUnique({ where: { id: walletId } });
        if (w) {
          await tx.wallet.update({
            where: { id: walletId },
            data: {
              lockedBalance: w.lockedBalance.minus(withdrawal.amount),
            },
          });
        }
      }

      const updated = await tx.withdrawalRequest.update({
        where: { id },
        data: {
          status,
          adminNote,
          transactionRef,
          reviewedAt: new Date(),
        },
      });

      return updated;
    });
  }

  /**
   * Commission history for user or vendor
   */
  async getCommissions(
    identifier: { userId?: string; vendorId?: string },
    page = 1,
    limit = 20,
    commissionType?: string
  ) {
    const where: any = identifier.userId
      ? { userId: identifier.userId }
      : { vendorId: identifier.vendorId };

    if (commissionType) {
      where.commissionType = commissionType;
    }

    const [data, total] = await Promise.all([
      this.prisma.mlmCommission.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          order: {
            select: {
              id: true,
              totalAmount: true,
              status: true,
              createdAt: true,
            },
          },
        },
      }),
      this.prisma.mlmCommission.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
