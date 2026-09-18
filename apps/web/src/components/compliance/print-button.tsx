'use client';

import { Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';

/** Opens the browser's print dialog, where "Save as PDF" is one of the printers. */
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" size="sm" onClick={() => window.print()}>
      <Printer aria-hidden="true" />
      {label}
    </Button>
  );
}
