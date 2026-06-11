import { cn } from "@/lib/utils/cn";

/**
 * Shimmering placeholder block. Compose these to mirror a panel's real
 * layout while its data is loading, so pages never flash empty.
 *
 * All three portals (student / teacher / admin) render on dark scopes, so a
 * translucent white wash reads correctly everywhere. Pass `className` to size
 * it (h-*, w-*, rounded-*) and override the tint if needed.
 */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-md bg-white/10", className)}
      style={style}
    />
  );
}

/** A stack of text-line skeletons. `lines` controls how many; the last line
 *  is shortened so it reads like a paragraph. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")}
        />
      ))}
    </div>
  );
}
