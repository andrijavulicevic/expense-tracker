import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await prisma.$connect();

    const userCount = await prisma.user.count();

    return NextResponse.json({
      success: true,
      message: "Database connected!",
      userCount,
    });
  } catch (error) {
    console.error("Database connection error:", error);
    return NextResponse.json(
      { success: false, error: "Database connection failed" },
      { status: 500 },
    );
  }
}
