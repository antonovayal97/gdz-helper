import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Balance top-ups are now custom-amount (price per ⚡ lives in
 * config.payments.creditPrice), so there are no credit packages to seed.
 * The CreditPackage model remains only for legacy payments in the DB.
 */
async function main() {
  console.log("Nothing to seed: packages are removed, top-up price comes from config.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
