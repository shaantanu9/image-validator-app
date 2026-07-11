#!/usr/bin/env node
/**
 * Free one or more TCP ports by killing whatever is listening on them.
 *
 * Usage: node scripts/free-port.mjs 5002 3000
 *
 * Wired into the `predev` / `predev:mongo` scripts so a stale server from a
 * previous run never blocks `pnpm dev` with EADDRINUSE — the busy port is
 * killed and reused automatically. Unix-only (macOS / Linux CI); relies on lsof.
 */
import { execSync } from 'node:child_process';

const ports = process.argv.slice(2).filter(Boolean);

for (const port of ports) {
  let pids = [];
  try {
    pids = execSync(`lsof -ti tcp:${port} -sTCP:LISTEN`, {
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .toString()
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    // lsof exits non-zero when nothing is listening — nothing to free.
    continue;
  }

  for (const pid of pids) {
    try {
      process.kill(Number(pid), 'SIGKILL');
      console.log(`Freed port ${port} (killed pid ${pid})`);
    } catch {
      // Process already gone or not ours — ignore.
    }
  }
}
