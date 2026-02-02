import Joi from "joi";

export function validateWithJoi<T>(
  schema: Joi.ObjectSchema<T>,
  data: unknown,
): {
  success: boolean;
  data?: T;
  errors?: Record<string, string[]>;
} {
  const { error, value } = schema.validate(data, { abortEarly: false });

  if (error) {
    const fieldErrors: Record<string, string[]> = {};

    error.details.forEach((detail) => {
      const field = detail.path[0] as string;
      if (!fieldErrors[field]) {
        fieldErrors[field] = [];
      }
      fieldErrors[field].push(detail.message);
    });

    return { success: false, errors: fieldErrors };
  }

  return { success: true, data: value };
}
