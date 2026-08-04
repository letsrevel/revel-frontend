import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge, taught about this project's custom `shadow-*` values.
 *
 * `shadow-poster` / `shadow-poster-lg` are custom entries in
 * tailwind.config.ts's `boxShadow` scale. tailwind-merge only knows the stock
 * scale, so out of the box it treated `shadow-poster` as an unrelated class
 * and kept BOTH sides of a conflict: `cn('shadow-poster', 'shadow-none')`
 * emitted `"shadow-poster shadow-none"`, and stylesheet order decided the
 * winner instead of the caller.
 *
 * That became load-bearing on this branch, where `ui/card` and
 * `ui/dialog-content` carry `shadow-poster` by DEFAULT: every call site
 * passing `shadow-none`, `shadow-sm` or `hover:shadow-lg` through `class` is
 * now overriding a base shadow rather than adding the only one.
 */
const twMerge = extendTailwindMerge({
	extend: { classGroups: { shadow: [{ shadow: ['poster', 'poster-lg'] }] } }
});

/**
 * Utility function to merge Tailwind CSS classes
 * Combines clsx and tailwind-merge for optimal class handling
 */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}
