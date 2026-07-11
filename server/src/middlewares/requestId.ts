import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

// Correlation / request-id middleware (SOC 2 traceability). Honour an inbound
// `x-request-id` (so a trace survives across service hops) or mint a fresh UUID,
// expose it on `req.id` for downstream logging, and echo it back on the response
// so clients and gateways can correlate their own logs.
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const incoming = req.headers['x-request-id'];
  const id = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();

  req.id = id;
  res.setHeader('x-request-id', id);

  next();
};
