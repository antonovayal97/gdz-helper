import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const packages = [
  { name: "Старт", credits: 30, price: 99, currency: "RUB" },
  { name: "Оптимум", credits: 100, price: 199, currency: "RUB" },
  { name: "Максимум", credits: 300, price: 399, currency: "RUB" },
];

async function main() {
  console.log("Seeding credit packages...");

  for (const pkg of packages) {
    await prisma.creditPackage.upsert({
      where: { id: pkg.name },
      update: { credits: pkg.credits, price: pkg.price, active: true },
      create: {
        id: pkg.name,
        name: pkg.name,
        credits: pkg.credits,
        price: pkg.price,
        currency: pkg.currency,
        active: true,
      },
    });
    console.log(`  ✓ ${pkg.name} — ${pkg.credits} решений за ${pkg.price} ${pkg.currency}`);
  }

  console.log("Seeding done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
