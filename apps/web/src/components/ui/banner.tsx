import { bannerPresetGradient, isBannerPreset, parseBannerValue } from '@app/core/appearance';

/**
 * A wide header image — either an uploaded file or one of the built-in
 * gradients.
 *
 * Both live in the same column, distinguished by a `preset:` prefix, so a row
 * can never be in the contradictory state of having both.
 *
 * `aspect-[3/1]` is fixed so the layout does not jump when an uploaded image
 * loads. How the image sits inside that strip is the author's choice, stored
 * with the URL — see `parseBannerValue`. Before that existed every image was
 * centre-cropped, which put the subject of a tall photograph off-screen.
 */
export function Banner({ value, alt = '' }: { value: string | null; alt?: string }) {
  if (!value) return null;

  const shell = 'aspect-[3/1] w-full overflow-hidden rounded-xl border border-[var(--color-border)]';

  if (isBannerPreset(value)) {
    const gradient = bannerPresetGradient(value);
    // An unknown preset key — from an older build, or hand-edited data — renders
    // nothing rather than an empty bordered box.
    if (!gradient) return null;
    return <div className={shell} style={{ backgroundImage: gradient }} role="presentation" />;
  }

  const { src, framing } = parseBannerValue(value);

  return (
    <div className={shell}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="size-full"
        style={{
          objectFit: framing.fit,
          // Ignored by the browser under `contain`, where nothing is cropped.
          objectPosition: `${framing.focusX}% ${framing.focusY}%`,
        }}
      />
    </div>
  );
}
