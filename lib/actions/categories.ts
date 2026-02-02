"use server";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  createCategorySchema,
  updateCategorySchema,
} from "@/lib/validations/category";
import { validateWithJoi } from "@/lib/utils/validation";
import { Prisma } from "@prisma/client";

type CategoryWithExpenseCount = Prisma.CategoryGetPayload<{
  include: {
    _count: {
      select: {
        expenses: true;
      };
    };
  };
}>;

export async function createCategory(formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        error: { _form: ["You must be logged in to create categories"] },
      };
    }

    const data = {
      name: formData.get("name") as string,
      color: (formData.get("color") as string) || "#3B82F6",
      icon: (formData.get("icon") as string) || null,
      budget: formData.get("budget")
        ? parseFloat(formData.get("budget") as string)
        : null,
    };

    const validation = validateWithJoi(createCategorySchema, data);

    if (!validation.success) {
      return { error: validation.errors };
    }

    const existingCategory = await prisma.category.findUnique({
      where: {
        userId_name: {
          userId: session.user.id,
          name: data.name,
        },
      },
    });

    if (existingCategory) {
      return {
        error: { name: ["A category with this name already exists"] },
      };
    }

    const category = await prisma.category.create({
      data: {
        name: validation.data.name,
        color: validation.data.color,
        icon: validation.data.icon,
        budget: validation.data.budget,
        userId: session.user.id,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/categories");

    return { success: true, data: category };
  } catch (error) {
    console.error("Create category error:", error);
    return {
      error: { _form: ["Failed to create category. Please try again."] },
    };
  }
}

export async function getCategories() {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const categories = await prisma.category.findMany({
      where: {
        userId: session.user.id,
      },
      orderBy: {
        name: "asc",
      },
      include: {
        _count: {
          select: {
            expenses: true,
          },
        },
      },
    });

    return categories;
  } catch (error) {
    console.error("Get categories error:", error);
    throw error;
  }
}

export async function getCategory(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const category = await prisma.category.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        expenses: {
          orderBy: {
            date: "desc",
          },
          take: 10,
        },
        _count: {
          select: {
            expenses: true,
          },
        },
      },
    });

    if (!category) {
      throw new Error("Category not found");
    }

    return category;
  } catch (error) {
    console.error("Get category error:", error);
    throw error;
  }
}

export async function updateCategory(id: string, formData: FormData) {
  try {
    const session = await auth();
    if (!session?.user) {
      return {
        error: { _form: ["You must be logged in to update categories"] },
      };
    }

    const data: Record<string, unknown> = {};

    if (formData.has("name")) {
      data.name = formData.get("name") as string;
    }
    if (formData.has("color")) {
      data.color = formData.get("color") as string;
    }
    if (formData.has("icon")) {
      data.icon = (formData.get("icon") as string) || null;
    }
    if (formData.has("budget")) {
      const budgetValue = formData.get("budget") as string;
      data.budget = budgetValue ? parseFloat(budgetValue) : null;
    }

    const validation = validateWithJoi(updateCategorySchema, data);
    if (!validation.success) {
      return { error: validation.errors };
    }

    const existingCategory = await prisma.category.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    });

    if (!existingCategory) {
      return { error: { _form: ["Category not found"] } };
    }

    if (
      validation.data.name &&
      validation.data.name !== existingCategory.name
    ) {
      const duplicateName = await prisma.category.findUnique({
        where: {
          userId_name: {
            userId: session.user.id,
            name: validation.data.name,
          },
        },
      });

      if (duplicateName) {
        return {
          error: { name: ["A category with this name already exists"] },
        };
      }
    }

    const category = await prisma.category.update({
      where: {
        id,
      },
      data: validation.data,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/categories");

    return { success: true, data: category };
  } catch (error) {
    console.error("Update category error:", error);
    return {
      error: { _form: ["Failed to update category. Please try again."] },
    };
  }
}

export async function deleteCategory(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { error: "You must be logged in to delete categories" };
    }

    const category = await prisma.category.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        _count: {
          select: {
            expenses: true,
          },
        },
      },
    });

    if (!category) {
      return { error: "Category not found" };
    }

    // Check if category has expenses
    if (category._count.expenses > 0) {
      return {
        error: `Cannot delete category with ${category._count.expenses} expense(s). Please delete or reassign the expenses first.`,
      };
    }

    await prisma.category.delete({
      where: {
        id,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/categories");

    return { success: true };
  } catch (error) {
    console.error("Delete category error:", error);
    return { error: "Failed to delete category. Please try again." };
  }
}

export async function bulkDeleteCategories(ids: string[]) {
  try {
    const session = await auth();
    if (!session?.user) {
      return { error: "You must be logged in to delete categories" };
    }

    const categories = (await prisma.category.findMany({
      where: {
        id: { in: ids },
        userId: session.user.id,
      },
      include: {
        _count: {
          select: {
            expenses: true,
          },
        },
      },
    })) as CategoryWithExpenseCount[];

    const categoriesWithExpenses = categories.filter(
      (c) => c._count.expenses > 0,
    );
    if (categoriesWithExpenses.length > 0) {
      return {
        error: `Cannot delete ${categoriesWithExpenses.length} categor${categoriesWithExpenses.length === 1 ? "y" : "ies"} with expenses`,
      };
    }

    const result = await prisma.category.deleteMany({
      where: {
        id: { in: ids },
        userId: session.user.id,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/categories");

    return { success: true, count: result.count };
  } catch (error) {
    console.error("Bulk delete categories error:", error);
    return { error: "Failed to delete categories. Please try again." };
  }
}

export async function getCategoryStats(id: string) {
  try {
    const session = await auth();
    if (!session?.user) {
      throw new Error("Unauthorized");
    }

    const category = await prisma.category.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      include: {
        expenses: {
          select: {
            amount: true,
            date: true,
          },
        },
      },
    });

    if (!category) {
      throw new Error("Category not found");
    }

    const totalSpent = category.expenses.reduce(
      (sum, expense) => sum + Number(expense.amount),
      0,
    );

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlySpent = category.expenses
      .filter((expense) => expense.date >= startOfMonth)
      .reduce((sum, expense) => sum + Number(expense.amount), 0);

    const budgetRemaining = category.budget
      ? Number(category.budget) - monthlySpent
      : null;

    const budgetPercentage = category.budget
      ? (monthlySpent / Number(category.budget)) * 100
      : null;

    return {
      totalSpent,
      monthlySpent,
      budgetRemaining,
      budgetPercentage,
      expenseCount: category.expenses.length,
      budget: category.budget ? Number(category.budget) : null,
    };
  } catch (error) {
    console.error("Get category stats error:", error);
    throw error;
  }
}
