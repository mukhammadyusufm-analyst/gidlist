/**
 * Filter values shared by the browser and the server.
 *
 * Deliberately not in `queries.ts`, which is `server-only`: the column filters
 * are a Client Component, and importing a *value* from a server-only module
 * fails the build. Types are fine there — they are erased — which is why
 * `ComplianceRow` still lives beside the query that produces it.
 */

/**
 * "Not filled in by anybody", as a URL parameter value.
 *
 * A sentinel rather than an empty string, because an empty parameter cannot be
 * told apart from the parameter being absent — and "nobody filled this in" is
 * the opposite of "no filter": it is every missed and every upcoming record,
 * which is exactly the set somebody chasing outstanding work wants.
 *
 * Uppercase and not a valid email address, so it can never collide with a real
 * value in the same field.
 */
export const FILLED_BY_NOBODY = 'NONE';
