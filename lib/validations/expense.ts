import Joi from "joi";

export const createExpenseSchema = Joi.object({
  amount: Joi.number().positive().precision(2).required().messages({
    "number.base": "Amount must be a number",
    "number.positive": "Amount must be positive",
    "any.required": "Amount is required",
  }),
  description: Joi.string().min(1).max(255).required().messages({
    "string.min": "Description cannot be empty",
    "string.max": "Description must not exceed 255 characters",
    "any.required": "Description is required",
  }),
  categoryId: Joi.string().uuid().required().messages({
    "string.uuid": "Invalid category ID",
    "any.required": "Category is required",
  }),
  date: Joi.date().max("now").required().messages({
    "date.base": "Invalid date",
    "date.max": "Date cannot be in the future",
    "any.required": "Date is required",
  }),
  receiptUrl: Joi.string().uri().optional().allow(null, "").messages({
    "string.uri": "Invalid receipt URL",
  }),
});

export const updateExpenseSchema = Joi.object({
  amount: Joi.number().positive().precision(2).optional().messages({
    "number.base": "Amount must be a number",
    "number.positive": "Amount must be positive",
    "number.precision": "Amount can have at most 2 decimal places",
  }),
  description: Joi.string().min(1).max(255).optional().messages({
    "string.min": "Description cannot be empty",
    "string.max": "Description must not exceed 255 characters",
  }),
  categoryId: Joi.string().optional(),
  date: Joi.date().max("now").optional().messages({
    "date.base": "Invalid date",
    "date.max": "Date cannot be in the future",
  }),
  receiptUrl: Joi.string().uri().optional().allow(null, ""),
});
