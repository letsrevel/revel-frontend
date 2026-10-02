<script lang="ts">
	import type { Snippet } from 'svelte';
	import { AlertTriangle, Info, Ban } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';

	/**
	 * One compliance message (#1001): icon + text, never colour alone.
	 *
	 * - `info`: non-blocking notices and "works differently here" hints.
	 * - `warning`: an upcoming restriction (Spain's 2027 invoicing block).
	 * - `blocked`: something is unavailable; pair it with the disabled control
	 *   through `id` + `aria-describedby`.
	 *
	 * Body copy is `text-foreground` on a soft tint (audited in
	 * scripts/audit-brand-themes.py); only the tint and the icon carry the tone.
	 * Banners use `role="status"` per the issue; a refused write uses an
	 * inline `role="alert"` at the call site instead.
	 */
	interface Props {
		tone?: 'info' | 'warning' | 'blocked';
		id?: string;
		role?: 'status' | 'note' | null;
		class?: string;
		testId?: string;
		children: Snippet;
	}

	const {
		tone = 'info',
		id,
		role = 'status',
		class: className,
		testId,
		children
	}: Props = $props();

	const TONE_CLASSES = {
		info: 'border-info/40 bg-info/10',
		warning: 'border-highlight/40 bg-highlight/20',
		blocked: 'border-destructive/40 bg-destructive/10'
	} as const;

	const Icon = $derived(tone === 'warning' ? AlertTriangle : tone === 'blocked' ? Ban : Info);
</script>

<div
	{id}
	role={role ?? undefined}
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
