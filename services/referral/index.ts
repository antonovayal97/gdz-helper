import { prisma } from "@/lib/db/prisma";
import { config } from "@/config";

export interface ReferralInfo {
  code: string;
  link: string;
  referralCount: number;
  totalReward: number;
}

/** Build the referral link from the configurable bot username. */
export function buildReferralLink(code: string): string {
  const bot = (config.telegram.botUsername || "your_bot").replace(/^@/, "");
  return `https://t.me/${bot}/app?startapp=ref_${code}`;
}

export async function getReferralInfo(userId: string): Promise<ReferralInfo> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("NOT_FOUND");
  }

  const referrals = await prisma.referral.findMany({
    where: { referrerId: userId },
    select: { reward: true },
  });

  const referralCount = referrals.length;
  const totalReward = referrals.reduce((sum, r) => sum + r.reward, 0);

  return {
    code: user.referralCode,
    link: buildReferralLink(user.referralCode),
    referralCount,
    totalReward,
  };
}
