import { prisma } from "@/lib/db/prisma";
import { toPublicUser } from "@/lib/server/auth";
import type { PublicUser } from "@/types";

export class UserServiceError extends Error {
  constructor(message: string, public readonly code = "NOT_FOUND") {
    super(message);
    this.name = "UserServiceError";
  }
}

export async function getUserById(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UserServiceError("Пользователь не найден");
  return toPublicUser(user);
}

export async function getBalance(userId: string): Promise<{ balance: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { balance: true },
  });
  if (!user) throw new UserServiceError("Пользователь не найден");
  return { balance: user.balance };
}
