/**
 * E2E for `gbrain connect`'s D4 raw-bearer smoke probe (connect-probe.ts).
 *
 * Spins up a real `gbrain serve --http` against a hermetic PGLite brain (no
 * Postgres / Docker), mints a legacy bearer token via `gbrain auth create`,
 * then drives the real MCP SDK probe against `/mcp`:
 *   - real token  → ok, returns get_brain_identity payload
 *   - wrong token → not ok, reason 'auth'
 *   - unreachable → not ok, reason 'unreachable' | 'timeout'
 *
 * This is the integration coverage the unit tests (injected deps) can't give:
 * the actual StreamableHTTP initialize handshake + tools/call over bearer auth.
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { spawn, execFileSync, type ChildProcess } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { probeBrainIdentity } from '../../src/core/connect-probe.ts';

const PORT = 19735; // avoid the production 3131 + the oauth E2E's 19131
const BASE = `http://127.0.0.1:${PORT}`;
const MCP_URL = `${BASE}/mcp`;

describe('connect bearer probe E2E (PGLite + real serve --http)', () => {
  let home: string;
  let server: ChildProcess | null = null;
  let token = '';
  let serverReady = false;

  beforeAll(async () => {
    home = mkdtempSync(join(tmpdir(), 'gbrain-connect-e2e-'));
    const env = { ...process.env, GBRAIN_HOME: home };

    execFileSync('bun', ['run', 'src/cli.ts', 'init', '--pglite', '--no-embedding', '--non-interactive'], {
      cwd: process.cwd(), env, stdio: 'ignore',
    });
    const authOut = execFileSync('bun', ['run', 'src/cli.ts', 'auth', 'create', 'e2e-connect'], {
      cwd: process.cwd(), env, encoding: 'utf8',
    });
    token = (authOut.match(/gbrain_[a-f0-9]{64}/) ?? [''])[0];
    if (!token) throw new Error(`auth create did not yield a token:\n${authOut}`);

    server = spawn('bun', [
      'run', 'src/cli.ts', 'serve', '--http',
      '--bind', '127.0.0.1', '--port', String(PORT),
      '--public-url', BASE,
    ], { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'] });
    let serr = '';
    server.stderr?.on('data', (d: Buffer) => { serr += d.toString(); });

    for (let i = 0; i < 60; i++) {
      try {
        const res = await fetch(`${BASE}/health`);
        if (res.ok) { serverReady = true; break; }
      } catch { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!serverReady) throw new Error(`serve --http did not become ready:\n${serr}`);
  }, 60_000);

  afterAll(() => {
    if (server) { try { server.kill('SIGTERM'); } catch { /* best-effort */ } }
    if (home) { try { rmSync(home, { recursive: true, force: true }); } catch { /* best-effort */ } }
  });

  test('real bearer token round-trips get_brain_identity', async () => {
    expect(serverReady).toBe(true);
    const r = await probeBrainIdentity(MCP_URL, token, { timeoutMs: 15_000 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      // get_brain_identity returns the version/engine counter packet.
      expect(r.identity).toMatch(/version/);
      expect(r.identity).toMatch(/pglite/);
    }
  }, 30_000);

  test('wrong token classifies as auth', async () => {
    expect(serverReady).toBe(true);
    const r = await probeBrainIdentity(MCP_URL, 'gbrain_deadbeef', { timeoutMs: 15_000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('auth');
  }, 30_000);

  test('unreachable host classifies as unreachable or timeout', async () => {
    // 127.0.0.1:1 is reserved/closed — connection refused or fast timeout.
    const r = await probeBrainIdentity('http://127.0.0.1:1/mcp', token, { timeoutMs: 4_000 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(['unreachable', 'timeout']).toContain(r.reason);
  }, 15_000);
});
