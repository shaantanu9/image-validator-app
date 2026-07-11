import { HTTP_STATUS, HttpStatusCode } from '../constants/httpStatus';

export interface ErrorResponse {
  success: false;
  message: string;
  errors?: Record<string, string[]>;
  stack?: string;
}

export class ApiError extends Error {
  public readonly statusCode: HttpStatusCode;
  public readonly isOperational: boolean;
  public readonly errors?: Record<string, string[]>;

  constructor(
    statusCode: HttpStatusCode,
    message: string,
    isOperational = true,
    errors?: Record<string, string[]>,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static badRequest(message: string, errors?: Record<string, string[]>): ApiError {
    return new ApiError(HTTP_STATUS.BAD_REQUEST, message, true, errors);
  }

  static unauthorized(message: string): ApiError {
    return new ApiError(HTTP_STATUS.UNAUTHORIZED, message);
  }

  static notFound(message: string): ApiError {
    return new ApiError(HTTP_STATUS.NOT_FOUND, message);
  }

  static conflict(message: string): ApiError {
    return new ApiError(HTTP_STATUS.CONFLICT, message);
  }

  static payloadTooLarge(message: string): ApiError {
    return new ApiError(HTTP_STATUS.PAYLOAD_TOO_LARGE, message);
  }

  static unsupportedMediaType(message: string): ApiError {
    return new ApiError(HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE, message);
  }

  static internal(message: string): ApiError {
    return new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, message, false);
  }

  static serviceUnavailable(message: string): ApiError {
    return new ApiError(HTTP_STATUS.SERVICE_UNAVAILABLE, message);
  }
}
