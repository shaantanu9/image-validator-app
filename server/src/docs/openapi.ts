import { appConfig } from '../config/app.config';

/**
 * Hand-written OpenAPI 3.0 spec for the API. Served as interactive docs at
 * `/docs` and as raw JSON at `/openapi.json`. The contract is identical for the
 * server variants, so this file is shared verbatim.
 */
const bearerAuth = [{ bearerAuth: [] }];

const userSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', example: '550e8400-e29b-41d4-a716-446655440000' },
    email: { type: 'string', format: 'email', example: 'user@example.com' },
    name: { type: 'string', nullable: true, example: 'Jane Doe' },
  },
};

const errorResponse = {
  description: 'Error',
  content: {
    'application/json': {
      schema: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
        },
      },
    },
  },
};

const authResult = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    message: { type: 'string' },
    data: {
      type: 'object',
      properties: {
        user: userSchema,
        tokens: {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
          },
        },
      },
    },
  },
};

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Image Validator API',
    version: '1.0.0',
    description:
      'Image Validator API. JWT access/refresh auth. Every account is a plain user: ' +
      'authenticated routes act only on the caller’s own record, taken from the ' +
      'verified token — there is no user directory and no privileged role.',
  },
  servers: [{ url: appConfig.apiPrefix, description: 'API v1' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  tags: [
    { name: 'Auth', description: 'Registration, login, token refresh, logout, own account' },
    { name: 'Uploads', description: 'Server-side image upload to ImageKit' },
  ],
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new user',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string', example: 'SecureP@ssw0rd1' },
                  name: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Created',
            content: { 'application/json': { schema: authResult } },
          },
          '409': errorResponse,
          '422': errorResponse,
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Log in',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'OK', content: { 'application/json': { schema: authResult } } },
          '401': errorResponse,
        },
      },
    },
    '/auth/refresh-token': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate refresh token and issue a new access token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['refreshToken'],
                properties: { refreshToken: { type: 'string' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    message: { type: 'string' },
                    data: {
                      type: 'object',
                      properties: {
                        accessToken: { type: 'string' },
                        refreshToken: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          '401': errorResponse,
        },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Log out (revoke refresh token)',
        security: bearerAuth,
        responses: { '200': { description: 'OK' }, '401': errorResponse },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'Get the current authenticated user',
        security: bearerAuth,
        responses: { '200': { description: 'OK' }, '401': errorResponse },
      },
      patch: {
        tags: ['Auth'],
        summary: 'Update the current user’s own name',
        description:
          'Acts on the caller’s own record only — the id comes from the verified ' +
          'token, never from the request. There is no way to update another account.',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: { name: { type: 'string', minLength: 2, example: 'Jane Doe' } },
              },
            },
          },
        },
        responses: {
          '200': { description: 'OK' },
          '401': errorResponse,
          '422': errorResponse,
        },
      },
      delete: {
        tags: ['Auth'],
        summary: 'Delete the current user’s own account',
        security: bearerAuth,
        responses: { '204': { description: 'Deleted' }, '401': errorResponse },
      },
    },
    '/uploads/image': {
      post: {
        tags: ['Uploads'],
        summary: 'Upload an image (multipart) to ImageKit via the server',
        description:
          'Send multipart/form-data with an "image" field. The server validates the ' +
          'real bytes (magic-byte sniff, size limit) and uploads to ImageKit — the ' +
          'private key never leaves the server. Returns 503 when ImageKit is not configured.',
        security: bearerAuth,
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  image: { type: 'string', format: 'binary' },
                },
                required: ['image'],
              },
            },
          },
        },
        responses: {
          '201': { description: 'Uploaded — returns { url, fileId, name, thumbnailUrl }' },
          '400': errorResponse,
          '401': errorResponse,
          '413': errorResponse,
          '415': errorResponse,
          '429': errorResponse,
          '503': errorResponse,
        },
      },
    },
  },
} as const;
