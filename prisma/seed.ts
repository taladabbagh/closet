import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// v1 runs in single-user mode: ensure a deterministic default user exists.
// All services resolve this user until real auth is added.
const DEFAULT_USER_EMAIL = "owner@closet.local";

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const db = new PrismaClient({ adapter });

  const user = await db.user.upsert({
    where: { email: DEFAULT_USER_EMAIL },
    update: {},
    create: { email: DEFAULT_USER_EMAIL, name: "Owner" },
  });

  console.log(`Seeded default user: ${user.email} (${user.id})`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
