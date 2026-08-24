import { cn } from '@/lib/utils';

/**
 * A horizontal progress bar.
 *
 * `aria-*` attributes rather than a bare styled div: someone using a screen
 * reader on a checklist needs to know how far through it they are, and a
 * coloured rectangle tells them nothing.
 */
export function ProgressBar({
  value,
  total,
  label,
  className,
  tone = 'primary',
}: {
  value: number;
  total: number;
  label?: string;
  className?: string;
  tone?: 'primary' | 'success';
}) {
  const percent = total === 0 ? 0 : Math.round((value / total) * 100);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={value}
      aria-label={label}
      className={cn(
        'h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface)]',
        className,
      )}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-300 ease-out',
          tone === 'success' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-primary)]',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/**
 * A compact circular gauge, for the fill screen's sticky header.
 *
 * Drawn as SVG rather than with a conic gradient so the track and the arc keep
 * identical thickness at any size, and so the whole thing scales cleanly on a
 * high-density phone screen.
 */
export function ProgressRing({
  value,
  total,
  size = 44,
}: {
  value: number;
  total: number;
  size?: number;
}) {
  const percent = total === 0 ? 0 : value / total;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const complete = total > 0 && value >= total;

  return (
    <span className="relative inline-flex shrink-0 items-center justify-center">
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-[var(--color-surface)]"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent)}
          className={cn(
            'transition-[stroke-dashoffset] duration-300 ease-out',
            complete ? 'stroke-[var(--color-success)]' : 'stroke-[var(--color-primary)]',
          )}
        />
      </svg>
      <span className="absolute text-[0.65rem] font-semibold tabular-nums">
        {Math.round(percent * 100)}
      </span>
    </span>
  );
}
