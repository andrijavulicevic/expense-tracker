import Joi from "joi";

export const registerSchema = Joi.object({
  name: Joi.string().min(2).max(50).required().messages({
    "string.min": "Name must be at least 2 characters",
    "string.max": "Name must not exceed 50 characters",
    "any.required": "Name is required",
  }),
  email: Joi.string().email().required().messages({
    "string.email": "Invalid email address",
    "any.required": "Email is required",
  }),
  password: Joi.string().min(6).max(100).required().messages({
    "string.min": "Password must be at least 6 characters",
    "string.max": "Password must not exceed 100 characters",
    "any.required": "Password is required",
  }),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
}).unknown(true);
