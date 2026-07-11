export const MESSAGES = {
  // Generic
  SUCCESS: 'Operation completed successfully.',
  CREATED: 'Resource created successfully.',
  UPDATED: 'Resource updated successfully.',
  DELETED: 'Resource deleted successfully.',
  NOT_FOUND: 'Resource not found.',
  INTERNAL_SERVER_ERROR: 'Internal server error.',
  UNAUTHORIZED: 'Unauthorized access.',
  FORBIDDEN: 'Access forbidden.',
  BAD_REQUEST: 'Bad request.',
  TOO_MANY_REQUESTS: 'Too many requests. Please try again later.',

  // Auth
  REGISTER_SUCCESS: 'Account created successfully.',
  LOGIN_SUCCESS: 'Logged in successfully.',
  LOGOUT_SUCCESS: 'Logged out successfully.',
  TOKEN_REFRESH_SUCCESS: 'Token refreshed successfully.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists.',
  USER_NOT_FOUND: 'User not found.',
  INVALID_TOKEN: 'Invalid or expired token.',
  REFRESH_TOKEN_REQUIRED: 'Refresh token is required.',

  // Validation
  VALIDATION_ERROR: 'Validation error.',

  // Uploads
  UPLOAD_SUCCESS: 'Image uploaded successfully.',
  IMAGEKIT_NOT_CONFIGURED: 'Image uploads are not configured on this server.',
  NO_FILE_UPLOADED: 'No image file was provided. Attach a file in the "image" field.',
  IMAGE_TOO_LARGE: 'Image exceeds the maximum allowed size.',
  IMAGE_INVALID_TYPE: 'Only JPEG, PNG, and HEIC images are accepted.',
  UPLOAD_FAILED: 'The image could not be uploaded. Please try again.',
} as const;

export type MessageKey = keyof typeof MESSAGES;
