import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiError, ErrorResponse } from '../utils/ApiError';
import { HTTP_STATUS } from '../constants/httpStatus';
import { MESSAGES } from '../constants/messages';
import logger from '../utils/logger';
import { appConfig } from '../config/app.config';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  let statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR;
  let message: string = MESSAGES.INTERNAL_SERVER_ERROR;
  let errors: Record<string, string[]> | undefined;
  let isOperational = false;

  if (err instanceof ApiError) {
    statusCode = err.statusCode;
    message = err.message;
    errors = err.errors;
    isOperational = err.isOperational;
  } else if (err instanceof ZodError) {
    statusCode = HTTP_STATUS.UNPROCESSABLE_ENTITY;
    message = MESSAGES.VALIDATION_ERROR;
    errors = err.flatten().fieldErrors as Record<string, string[]>;
    isOperational = true;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = HTTP_STATUS.UNAUTHORIZED;
    message = MESSAGES.UNAUTHORIZED;
    isOperational = true;
  } else if (err.name === 'SyntaxError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = MESSAGES.BAD_REQUEST;
    isOperational = true;
  }

  if (!isOperational) {
    logger.error('Unexpected error:', { error: err.message, stack: err.stack });
  } else {
    logger.warn('Operational error:', { statusCode, message, errors });
  }

  const response: ErrorResponse = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  if (appConfig.isDev && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};
