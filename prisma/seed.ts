import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("🌱 Starting seed...");

  const passwordHash = await bcrypt.hash("password123", 10);

  const user = await prisma.user.upsert({
    where: { email: "vulicevic.andrija@gmail.com" },
    update: {},
    create: {
      email: "vulicevic.andrija@gmail.com",
      name: "Andrija Vulicevic",
      passwordHash,
    },
  });

  console.log("✅ Created user:", user.email);

  const categories = await Promise.all([
    prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: "Food & Dining" } },
      update: {},
      create: {
        name: "Food & Dining",
        color: "#EF4444",
        icon: "🍔",
        userId: user.id,
        budget: 500,
      },
    }),
    prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: "Transportation" } },
      update: {},
      create: {
        name: "Transportation",
        color: "#3B82F6",
        icon: "🚗",
        userId: user.id,
        budget: 200,
      },
    }),
    prisma.category.upsert({
      where: { userId_name: { userId: user.id, name: "Entertainment" } },
      update: {},
      create: {
        name: "Entertainment",
        color: "#8B5CF6",
        icon: "🎮",
        userId: user.id,
        budget: 150,
      },
    }),
  ]);

  console.log("✅ Created categories:", categories.length);

  await prisma.expense.deleteMany({
    where: { userId: user.id },
  });

  const expenses = await prisma.expense.createMany({
    data: [
      {
        amount: 45.5,
        description: "Grocery shopping",
        date: new Date("2024-02-01"),
        categoryId: categories[0].id,
        userId: user.id,
      },
      {
        amount: 12.0,
        description: "Uber ride",
        date: new Date("2024-02-01"),
        categoryId: categories[1].id,
        userId: user.id,
      },
      {
        amount: 59.99,
        description: "Movie tickets",
        date: new Date("2024-01-30"),
        categoryId: categories[2].id,
        userId: user.id,
      },
      {
        amount: 89.99,
        description: "Restaurant dinner",
        date: new Date("2024-01-28"),
        categoryId: categories[0].id,
        userId: user.id,
      },
      {
        amount: 25.0,
        description: "Gas",
        date: new Date("2024-01-27"),
        categoryId: categories[1].id,
        userId: user.id,
      },
    ],
  });

  console.log("✅ Created expenses:", expenses.count);
  console.log("🌱 Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
