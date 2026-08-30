/**
 * Shared domain layer.
 *
 * Everything in here is plain TypeScript with no React, no Next.js and no
 * React Native imports, so the web app and the mobile app can both depend on
 * it. Business rules live here exactly once — a rule like "a parent item
 * completes when all its children complete" must not be reimplemented per
 * platform, or the two clients will eventually disagree.
 */

/*
 * First, and imported for its side effect: it configures Zod before any schema
 * below is constructed. See the file for why.
 *
 * A CONSEQUENCE WORTH KNOWING, because it was measured costing real time. This
 * side-effect import runs whenever *anything* is imported from this barrel, and
 * it pulls Zod with it. A client component that wanted only `THEMES` — a frozen
 * array of three strings — therefore shipped Zod and every schema in this
 * package to the browser, roughly 288 KB of it, on every page that rendered
 * that component. Both the theme toggle and the translation provider live in
 * the dashboard layout, so it was on every page in the product.
 *
 * The fix is not here: it is the subpath exports in `package.json`. A browser
 * component imports `@app/core/theme` or `@app/core/dates` and never touches
 * this file. Server code keeps using the barrel, where the cost is irrelevant.
 *
 * So: if you are adding an import to a `'use client'` component, reach for the
 * subpath. The barrel is for the server.
 */
import './zod-config';

export * from './appearance';
export * from './auth';
export * from './boards';
export * from './checklists';
export * from './constants';
export * from './dates';
export * from './i18n';
export * from './media';
export * from './money';
export * from './schedules';
export * from './site-messages';
export * from './theme';
