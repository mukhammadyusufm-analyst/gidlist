import { config } from 'zod';

/**
 * Turn off Zod's JIT schema compilation.
 *
 * Zod probes for JIT support by calling `Function("")` inside a try/catch. Under
 * the Content Security Policy in `proxy.ts` that call is refused, Zod catches
 * the error and falls back to interpreting schemas — so nothing breaks. But the
 * browser reports every blocked eval to the console, and a console with a
 * standing CSP violation in it is one nobody reads. The next real violation
 * would arrive unnoticed, which is the thing worth avoiding.
 *
 * Zod's own documentation names this case: "Disable JIT schema compilation.
 * Useful in environments that disallow `eval`." So this is the supported answer
 * rather than a workaround, and it is preferable to the alternative — adding
 * `'unsafe-eval'` to the policy, which would weaken it for every script in the
 * app to quiet one library's feature detection.
 *
 * The cost is that validation runs interpreted rather than compiled. These
 * schemas check a handful of form fields; the difference is not measurable here.
 *
 * Imported for its side effect, first, before any schema is built.
 *
 * SERVER ONLY, now — and deliberately.
 *
 * There used to be a companion, `apps/web/src/instrumentation-client.ts`, doing
 * the same thing in the browser, because Zod reads the setting when a schema is
 * *constructed* and the bundler picks the chunk order. It was removed once the
 * client bundle was measured: importing `config` from `zod` pulled the whole
 * library into a chunk that Next put in the first load of all 26 routes — 224 KB
 * on every page — to guard a probe that could no longer fire, because no schema
 * is constructed in the browser at all. Every schema in this app is used by a
 * server action or server code. That was verified by searching the built client
 * chunks for the schemas' own error strings: none of them appear.
 *
 * If that ever stops being true, the symptom is a standing CSP eval violation in
 * the browser console. The fix is to bring the client instrumentation back —
 * ideally without importing all of Zod for one call. The check that proves which
 * case you are in:
 *
 *   grep -rl "Enter a valid email address." apps/web/.next/static
 */
config({ jitless: true });
