<script lang="ts">
	import type { Snippet } from 'svelte';
	import { AlertTriangle, Info, Ban, CheckCircle } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';

	/**
	 * One compliance message (#1001): icon + text, never colour alone.
	 *
	 * - `info`: non-blocking notices and "works differently here" hints.
	 * - `warning`: an upcoming restriction (Spain's 2027 invoicing block).
	 * - `success`: a positive state (e.g. a ticket that is good to check in).
	 * - `blocked`: something is unavailable; pair it with the disabled control
	 *   through `id` + `aria-describedby`.
	 *
	 * Body copy is `text-foreground` on a soft tint (audited in
	 * scripts/audit-brand-themes.py); only the tint and the icon carry the tone.
	 * Banners use `role="status"` per the issue; a refused write uses an
	 * inline `role="alert"` at the call site instead.
	 */
	interface Props {
		tone?: 'info' | 'success' | 'warning' | 'blocked';
		id?: string;
		role?: 'status' | 'note' | 'alert' | null;
		/** Accessible name, for a `note` whose visible title is inside the children. */
		label?: string;
		class?: string;
		testId?: string;
		children: Snippet;
	}

	const {
		tone = 'info',
		id,
		role = 'status',
		label,
		class: className,
		testId,
		children
	}: Props = $props();

	const TONE_CLASSES = {
		info: 'border-info/40 bg-info/10',
		success: 'border-success/40 bg-success/10',
		warning: 'border-highlight/40 bg-highlight/20',
		blocked: 'border-destructive/40 bg-destructive/10'
	} as const;

	const Icon = $derived(
		tone === 'warning'
			? AlertTriangle
			: tone === 'blocked'
				? Ban
				: tone === 'success'
					? CheckCircle
					: Info
	);
</script>

<div
	{id}
	role={role ?? undefined}
	aria-label={label}
	data-testid={testId}
	data-tone={tone}
	class={cn(
		'flex items-start gap-2 rounded-md border p-3 text-sm text-foreground',
		TONE_CLASSES[tone],
		className
	)}
>
	<Icon class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
	<div class="min-w-0 flex-1 space-y-1">
		{@render children()}
	</div>
</div>
