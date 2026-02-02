"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  createExpenseSchema,
  updateExpenseSchema,
} from "@/lib/validations/expense";
import { validateWithJoi } from "../utils/validation";

export async function createExpense(formData: FormData) {
  const session = await auth();
  if (!session?.user) {
    return { error: "Unauthorized" };
  }

  const data = {
    amount: parseFloat(formData.get("amount") as string),
    description: formData.get("description") as string,
    categoryId: formData.get("categoryId") as string,
    date: new Date(formData.get("date") as string),
    receiptUrl: (formData.get("receiptUrl") as string) || null,
  };

  const { error, value } = createExpenseSchema.validate(data, {
    abortEarly: false,
  });

  if (error) {
    const fieldErrors: Record<string, string[]> = {};
    error.details.forEach((detail) => {
      const field = detail.path[0] as string;
      if (!fieldErrors[field]) {
        fieldErrors[field] = [];
      }
      fieldErrors[field].push(detail.message);
    });

    return { error: fieldErrors };
  }

  try {
    const expense = await prisma.expense.create({
      data: {
        ...value,
        userId: session.user.id,
      },
      include: {
        category: true,
      },
    });

    revalidatePath("/dashboard");
    return { success: true, data: expense };
  } catch (error) {
    console.error("Database error:", error);
    return { error: { _form: ["Failed to create expense"] } };
  }
}

interface GetExpensesOptions {
  categoryId?: string;
  startDate?: Date;
  endDate?: Date;
  search?: string;
  limit?: number;
  offset?: number;
  sortBy?: "date" | "amount" | "description";
  sortOrder?: "asc" | "desc";
}

export async function getExpenses(options: GetExpensesOptions = {}) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const {
      categoryId,
      startDate,
      endDate,
      search,
      limit = 50,
      offset = 0,
      sortBy = "date",
      sortOrder = "desc",
    } = options;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {
      userId: session.user.id,
    };

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    if (search) {
      where.description = {
        contains: search,
        mode: "insensitive",
      };
    }

    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: {
          category: true,
        },
        orderBy: {
          [sortBy]: sortOrder,
        },
        take: limit,
        skip: offset,
      }),
      prisma.expense.count({ where }),
    ]);

    return {
      expenses,
      total,
      hasMore: offset + expenses.length < total,
    };
  } catch (error) {
    console.error("Get expenses error:", error);
    throw error;
  }
}

export async function getExpense(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const expense = await prisma.expense.findFirst({
      where: {
        id,
        userId: session.user.id, // Security: only get own expenses
      },
      include: {
        category: true,
      },
    });

    if (!expense) {
      throw new Error("Expense not found");
    }

    return expense;
  } catch (error) {
    console.error("Get expense error:", error);
    throw error;
  }
}

export async function updateExpense(id: string, formData: FormData) {
  try {
    // Check authentication
    const session = await auth();
    if (!session?.user) {
      return { error: { _form: ["You must be logged in to update expenses"] } };
    }

    const data: Record<string, unknown> = {};

    if (formData.has("amount")) {
      data.amount = parseFloat(formData.get("amount") as string);
    }
    if (formData.has("description")) {
      data.description = formData.get("description") as string;
    }
    if (formData.has("categoryId")) {
      data.categoryId = formData.get("categoryId") as string;
    }
    if (formData.has("date")) {
      data.date = new Date(formData.get("date") as string);
    }
    if (formData.has("receiptUrl")) {
      data.receiptUrl = (formData.get("receiptUrl") as string) || null;
    }

    const validation = validateWithJoi(updateExpenseSchema, data);

    if (!validation.success) {
      return { error: validation.errors };
    }

    const existingExpense = await prisma.expense.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingExpense) {
      return { error: { _form: ["Expense not found"] } };
    }

    if (validation.data.categoryId) {
      const category = await prisma.category.findFirst({
        where: {
          id: validation.data.categoryId,
          userId: session.user.id,
        },
      });

      if (!category) {
        return {
          error: { categoryId: ["Invalid category selected"] },
        };
      }
    }

    const expense = await prisma.expense.update({
      where: {
        id,
      },
      data: validation.data,
      include: {
        category: true,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/expenses");

    return { success: true, data: expense };
  } catch (error) {
    console.error("Update expense error:", error);
    return {
      error: { _form: ["Failed to update expense. Please try again."] },
    };
  }
}

export async function deleteExpense(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { error: "You must be logged in to delete expenses" };
    }

    const expense = await prisma.expense.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!expense) {
      return { error: "Expense not found" };
    }

    await prisma.expense.delete({
      where: {
        id,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/expenses");

    return { success: true };
  } catch (error) {
    console.error("Delete expense error:", error);
    return { error: "Failed to delete expense. Please try again." };
  }
}

export async function bulkDeleteExpenses(ids: string[]) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { error: "You must be logged in to delete expenses" };
    }

    const result = await prisma.expense.deleteMany({
      where: {
        id: { in: ids },
        userId: session.user.id,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/expenses");

    return { success: true, count: result.count };
  } catch (error) {
    console.error("Bulk delete expenses error:", error);
    return { error: "Failed to delete expenses. Please try again." };
  }
}

export async function bulkUpdateCategory(ids: string[], categoryId: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { error: "You must be logged in to update expenses" };
    }

    const category = await prisma.category.findFirst({
      where: {
        id: categoryId,
        userId: session.user.id,
      },
    });

    if (!category) {
      return { error: "Invalid category selected" };
    }

    const result = await prisma.expense.updateMany({
      where: {
        id: { in: ids },
        userId: session.user.id,
      },
      data: {
        categoryId,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/expenses");

    return { success: true, count: result.count };
  } catch (error) {
    console.error("Bulk update category error:", error);
    return { error: "Failed to update expenses. Please try again." };
  }
}

export async function getExpenseStats(
  period: "week" | "month" | "year" = "month",
) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const now = new Date();
    let startDate: Date;

    switch (period) {
      case "week":
        startDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 7,
        );
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
    }

    const expenses = await prisma.expense.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: startDate,
          lte: now,
        },
      },
      include: {
        category: true,
      },
    });

    const total = expenses.reduce(
      (sum, expense) => sum + Number(expense.amount),
      0,
    );

    const byCategory = expenses.reduce(
      (acc, expense) => {
        const categoryName = expense.category.name;
        if (!acc[categoryName]) {
          acc[categoryName] = {
            name: categoryName,
            color: expense.category.color,
            icon: expense.category.icon,
            total: 0,
            count: 0,
          };
        }
        acc[categoryName].total += Number(expense.amount);
        acc[categoryName].count += 1;
        return acc;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as Record<string, any>,
    );

    const days = Math.ceil(
      (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const averagePerDay = total / days;

    const previousStartDate = new Date(startDate);
    previousStartDate.setTime(
      previousStartDate.getTime() - (now.getTime() - startDate.getTime()),
    );

    const previousExpenses = await prisma.expense.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: previousStartDate,
          lt: startDate,
        },
      },
    });

    const previousTotal = previousExpenses.reduce(
      (sum, expense) => sum + Number(expense.amount),
      0,
    );

    const percentageChange =
      previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : 0;

    return {
      total,
      count: expenses.length,
      averagePerDay,
      byCategory: Object.values(byCategory),
      percentageChange,
      previousTotal,
    };
  } catch (error) {
    console.error("Get expense stats error:", error);
    throw error;
  }
}

export async function getExpensesByDateRange(startDate: Date, endDate: Date) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const expenses = await prisma.expense.findMany({
      where: {
        userId: session.user.id,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        category: true,
      },
      orderBy: {
        date: "asc",
      },
    });

    const byDate = expenses.reduce(
      (acc, expense) => {
        const dateKey = expense.date.toISOString().split("T")[0];
        if (!acc[dateKey]) {
          acc[dateKey] = {
            date: dateKey,
            total: 0,
            expenses: [],
          };
        }
        acc[dateKey].total += Number(expense.amount);
        acc[dateKey].expenses.push(expense);
        return acc;
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as Record<string, any>,
    );

    return Object.values(byDate);
  } catch (error) {
    console.error("Get expenses by date range error:", error);
    throw error;
  }
}

export async function searchExpenses(query: string, limit = 10) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const expenses = await prisma.expense.findMany({
      where: {
        userId: session.user.id,
        description: {
          contains: query,
          mode: "insensitive",
        },
      },
      include: {
        category: true,
      },
      orderBy: {
        date: "desc",
      },
      take: limit,
    });

    return expenses;
  } catch (error) {
    console.error("Search expenses error:", error);
    throw error;
  }
}

export async function getRecentExpenses(limit = 10) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const expenses = await prisma.expense.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        category: true,
      },
      orderBy: {
        date: "desc",
      },
      take: limit,
    });

    return expenses;
  } catch (error) {
    console.error("Get recent expenses error:", error);
    throw error;
  }
}

export async function duplicateExpense(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { error: "You must be logged in to duplicate expenses" };
    }

    const originalExpense = await prisma.expense.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!originalExpense) {
      return { error: "Expense not found" };
    }

    const duplicate = await prisma.expense.create({
      data: {
        amount: originalExpense.amount,
        description: `${originalExpense.description} (copy)`,
        categoryId: originalExpense.categoryId,
        date: new Date(),
        receiptUrl: originalExpense.receiptUrl,
        userId: session.user.id,
      },
      include: {
        category: true,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/expenses");

    return { success: true, data: duplicate };
  } catch (error) {
    console.error("Duplicate expense error:", error);
    return { error: "Failed to duplicate expense. Please try again." };
  }
}
