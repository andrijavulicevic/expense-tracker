import Joi from "joi";

export const createCategorySchema = Joi.object({
  name: Joi.string().min(2).max(50).required().messages({
    "string.min": "Category name must be at least 2 characters",
    "string.max": "Category name must not exceed 50 characters",
    "any.required": "Category name is required",
  }),
  color: Joi.string()
    .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .default("#3B82F6")
    .messages({
      "string.pattern.base": "Color must be a valid hex color (e.g., #FF0000)",
    }),
  icon: Joi.string().max(10).optional().allow(null, "").messages({
    "string.max": "Icon must not exceed 10 characters",
  }),
  budget: Joi.number().positive().precision(2).optional().allow(null).messages({
    "number.positive": "Budget must be positive",
  }),
});

export const updateCategorySchema = Joi.object({
  name: Joi.string().min(2).max(50).optional().messages({
    "string.min": "Category name must be at least 2 characters",
    "string.max": "Category name must not exceed 50 characters",
  }),
  color: Joi.string()
    .pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)
    .optional()
    .messages({
      "string.pattern.base": "Color must be a valid hex color (e.g., #FF0000)",
    }),
  icon: Joi.string().max(10).optional().allow(null, ""),
  budget: Joi.number().positive().precision(2).optional().allow(null),
});
