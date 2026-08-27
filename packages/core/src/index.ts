/**
 * Shared domain layer.
 *
 * Everything in here is plain TypeScript with no React, no Next.js and no
 * React Native imports, so the web app and the mobile app can both depend on
 * it. Business rules live here exactly once — a rule like "a parent item
 * completes when all its children complete" must not be reimplemented per
 * platform, or the two clients will eventually disagree.
 */

// First, and imported for its side effect: it configures Zod before any schema
// below is constructed. See the file for why.
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
export * from './theme';
