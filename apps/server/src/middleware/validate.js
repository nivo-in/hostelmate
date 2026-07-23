/**
 * Express middleware to validate request bodies against a Zod schema.
 * Replaces req.body with the parsed/coerced validated data from schema.safeParse.
 * Returns HTTP 400 with a detailed error payload if validation fails.
 *
 * @param {import('zod').ZodSchema} schema - Zod validation schema
 * @returns {import('express').RequestHandler}
 */
export const validate = (schema) => (req, res, next) => {
  let result;
  try {
    result = schema.safeParse(req.body);
  } catch (err) {
    return next(err);
  }

  if (!result.success) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
    });
  }

  req.body = result.data;
  next();
};
