import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();

  if (!email || !password) {
    console.error("\n❌ ERROR: Missing required environment variables for seeding.");
    console.error("Both SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be defined before seeding.");
    console.error("Example:");
    console.error('  SEED_ADMIN_EMAIL="admin@yourcompany.com"');
    console.error('  SEED_ADMIN_PASSWORD="YourSecurePassword123!"');
    console.error("Aborting to prevent deployment with insecure default credentials.\n");
    process.exit(1);
  }

  console.log(`Seeding initial ADMIN user: ${email}...`);

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: "ADMIN",
    },
    create: {
      email,
      name: "System Admin",
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log(`✅ Admin user seeded successfully! (ID: ${admin.id}, Email: ${admin.email}, Role: ${admin.role})`);
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
