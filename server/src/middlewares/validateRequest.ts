import { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodEffects, ZodTypeAny } from 'zod';

export type ValidationSchema = AnyZodObject | ZodEffects<ZodTypeAny, unknown, unknown>;

export type RequestValidationSchema = {
  body?: ValidationSchema;
  query?: ValidationSchema;
  params?: ValidationSchema;
};

export const validateRequest = (schema: RequestValidationSchema) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const result: Record<string, unknown> = {};

      if (schema.body) {
        result.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        result.query = await schema.query.parseAsync(req.query);
      }
      if (schema.params) {
        result.params = await schema.params.parseAsync(req.params);
      }

      // Replace validated values on the request
      Object.assign(req, result);
      next();
    } catch (error) {
      next(error);
    }
  };
};

export const validateBody = (schema: ValidationSchema) => validateRequest({ body: schema });
