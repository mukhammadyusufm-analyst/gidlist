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
 */
config({ jitless: true });
