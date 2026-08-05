import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { validationResult } from 'express-validator';
import { sendError } from '../utils/response';

/**
 * Turn express-validator results into a 400.
 *
 * Routes declared validation chains but nothing ever inspected the outcome, so
 * every one of those rules was silently discarded — invalid emails, short
 * passwords and over-long names all reached the controllers. Any route using
 * express-validator chains must place this immediately after them.
 */
export const runValidation = (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result.array().map((err) => ({
    field: err.type === 'field' ? err.path : undefined,
    message: err.msg,
  }));

  return sendError(res, 'VALIDATION_ERROR', 'Invalid request data', 400, details);
};

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return sendError(
        res,
        'VALIDATION_ERROR',
        'Invalid request data',
        400,
        details
      );
    }

    next();
  };
};
