/**
 * The product's strings, grouped by where the reader is standing.
 *
 * =============================================================================
 * WHY THIS EXISTS
 *
 * Admin → Translations listed ~500 strings as a flat alphabetical run of dotted
 * keys, so changing one word meant already knowing it was called
 * `auth.pitchTitle`. That is a reasonable thing to ask of whoever wrote the
 * code and an impossible one for anybody else — including the person who spots
 * a clumsy sentence on a screen and wants it fixed. He hit exactly that and
 * could not find the row.
 *
 * The marketing site solved this first: sections declared beside the catalogue
 * rather than inside the screen, keys claimed by prefix so new ones land
 * automatically, and a catch-all last so nothing becomes silently uneditable.
 * This is the same shape applied to the larger catalogue.
 *
 * =============================================================================
 * GROUPED BY PLACE, NOT BY MODULE — AND THEY ARE NOT THE SAME THING
 *
 * The code's namespaces describe how the app is built. Somebody editing wording
 * is thinking about where they saw the words: the sign-in screen, a space, the
 * thing they fill in on a phone. Mostly those agree, and where they do not, the
 * place wins:
 *
 *   `media.` is a namespace about uploads, but every one of those strings is
 *   read while setting up a space, so it sits under Spaces.
 *
 *   `invite.` and `members.` are separate namespaces and one experience — you
 *   invite somebody from the members screen and they accept from a banner.
 *
 *   `audit.` is a history nobody reads until something has gone wrong, which
 *   puts it with reports rather than with administration.
 *
 * The shared words go LAST, not first, though `common.` sorts to the top
 * alphabetically. Editing one of them changes a button that appears on twenty
 * screens, which is a bigger decision than editing a sentence on one — and a
 * list is read top-first, so the more consequential group should not be the one
 * that greets you.
 */

const SECTION_DEFINITIONS: { id: string; title: string; hint: string; prefixes: string[] }[] = [
  {
    id: 'auth',
    title: 'Signing in and joining',
    hint: 'Sign-in, sign-up, password reset, and accepting an invitation.',
    prefixes: ['auth.', 'invite.'],
  },
  {
    id: 'spaces',
    title: 'Spaces',
    hint: 'Creating a space, its members and roles, its logo and banner, and archiving it.',
    prefixes: ['space.', 'members.', 'media.', 'archive.', 'practice.'],
  },
  {
    id: 'checklists',
    title: 'Checklists',
    hint: 'Building a checklist, its items and their requirements, publishing and archiving.',
    prefixes: ['checklist.', 'checklistArchive.'],
  },
  {
    id: 'schedules',
    title: 'Scheduling',
    hint: 'When a checklist recurs, who it goes to, and the windows it must be done in.',
    prefixes: ['schedule.'],
  },
  {
    id: 'fill',
    title: 'Filling one in',
    hint: 'What somebody reads on a phone while doing the work, including with no signal.',
    prefixes: ['fill.', 'offline.'],
  },
  {
    id: 'reports',
    title: 'Reports and history',
    hint: 'Compliance figures, the submissions table, and the audit trail.',
    prefixes: ['compliance.', 'audit.'],
  },
  {
    id: 'account',
    title: 'Account and billing',
    hint: 'Profile, sign-in methods, appearance, plans and invoices.',
    prefixes: ['account.', 'billing.'],
  },
  {
    id: 'email',
    title: 'Emails we send',
    hint: 'Invitations and reports. These arrive outside the app, where nothing can be corrected.',
    prefixes: ['email.'],
  },
  {
    id: 'admin',
    title: 'Administration',
    hint: 'The admin area itself — seen only by people who hold a platform capability.',
    prefixes: ['admin.'],
  },
  {
    id: 'messages',
    title: 'Messages and errors',
    hint: 'What the product says when something is saved, refused or goes wrong — including refusals from the database and form validation.',
    prefixes: ['errors.', 'notices.'],
  },
  {
    id: 'shared',
    title: 'Words used everywhere',
    hint: 'Buttons, statuses and dates that appear across the whole product. Changing one changes many screens.',
    prefixes: ['common.', 'status.', 'date.', 'theme.'],
  },
];

export type StringSection = {
  id: string;
  title: string;
  hint: string;
  keys: string[];
};

/**
 * Every key, in sections.
 *
 * ENDS WITH A CATCH-ALL, which is the part that matters. A key added under a
 * namespace nobody has claimed appears under "Not yet grouped" rather than
 * vanishing from the editor — wording that exists in the product and cannot be
 * edited, with nothing to say why, is the worst outcome this screen can produce.
 */
export function stringSections(keys: string[]): StringSection[] {
  const remaining = new Set(keys);
  const sections: StringSection[] = [];

  for (const definition of SECTION_DEFINITIONS) {
    const claimed: string[] = [];

    for (const key of remaining) {
      if (definition.prefixes.some((prefix) => key.startsWith(prefix))) claimed.push(key);
    }

    for (const key of claimed) remaining.delete(key);

    if (claimed.length > 0) {
      sections.push({
        id: definition.id,
        title: definition.title,
        hint: definition.hint,
        // Alphabetical within a section, which is honest here in a way it was
        // not for the site: these keys have no page order to preserve, and a
        // section is small enough to scan.
        keys: claimed.sort(),
      });
    }
  }

  if (remaining.size > 0) {
    sections.push({
      id: 'ungrouped',
      title: 'Not yet grouped',
      hint: 'A namespace no section claims yet. Add it to sections.ts so it appears where people look.',
      keys: [...remaining].sort(),
    });
  }

  return sections;
}
