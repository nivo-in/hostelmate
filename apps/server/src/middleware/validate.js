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
