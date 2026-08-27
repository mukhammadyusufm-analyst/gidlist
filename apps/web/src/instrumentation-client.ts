import { config } from 'zod';

/**
 * Runs before the application becomes interactive in the browser.
 *
 * Zod decides whether to JIT-compile a schema **when the schema is
 * constructed**, not when it is used:
 *
 *   o = !c.jitless,
 *   u = o && Z.value      // Z.value runs Function("") to probe for eval
 *
 * So the setting has to be in place before the first `z.object()` anywhere in
 * the bundle. Setting it inside a module and importing that module first does
 * not guarantee it: the browser evaluates chunks in an order the bundler
 * chooses, and a schema in another chunk can be constructed before ours runs.
 * That is why the earlier attempt — configuring it in `lib/env.ts` and in
 * `@app/core` — shipped and still left the probe firing.
 *
 * This file is the one place Next guarantees runs first on the client, which is
 * the property the fix actually needed.
 *
 * @see packages/core/src/zod-config.ts for why the probe matters at all.
 */
try {
  config({ jitless: true });
} catch {
  // Never let instrumentation break the app it is instrumenting. If this fails,
  // the only consequence is a console warning from the blocked probe, which
  // Zod already handles by falling back to interpreting schemas.
}
