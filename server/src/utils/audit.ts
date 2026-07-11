import logger from './logger';

// Canonical set of security-relevant events we emit to the audit trail.
// Kept as a const object so call sites reference stable, typo-proof names
// (SOC 2 CC7.x — security event logging & monitoring).
export const AuditEvent = {
  AUTH_LOGIN_SUCCESS: 'AUTH_LOGIN_SUCCESS',
  AUTH_LOGIN_FAILURE: 'AUTH_LOGIN_FAILURE',
  AUTH_REGISTER: 'AUTH_REGISTER',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  AUTH_TOKEN_REFRESH: 'AUTH_TOKEN_REFRESH',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
} as const;

export type AuditEventType = (typeof AuditEvent)[keyof typeof AuditEvent];

export interface AuditMeta {
  actorId?: string;
  targetId?: string;
  ip?: string;
  requestId?: string;
  outcome?: 'success' | 'failure';
  [key: string]: unknown;
}

// Emit one structured, stable-shaped line per audited event. The `audit: true`
// flag makes these trivially filterable in a log aggregator.
export const audit = (event: AuditEventType, meta: AuditMeta = {}): void => {
  logger.info('audit', {
    audit: true,
    event,
    timestamp: new Date().toISOString(),
    ...meta,
  });
};
