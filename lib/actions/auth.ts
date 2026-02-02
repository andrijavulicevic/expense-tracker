"use server";

import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";
import { validateWithJoi } from "@/lib/utils/validation";
import { registerSchema } from "@/lib/validations/auth";

export async function register(formData: FormData) {
  const data = {
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const validation = validateWithJoi(registerSchema, data);

  if (!validation.success) {
    return { error: validation.errors };
  }

  const { name, email, password } = validation.data;

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return {
      error: { email: ["Email already registered"] },
    };
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
      },
    });

    return { success: true };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    return {
      error: { _form: ["Something went wrong. Please try again."] },
    };
  }
}
