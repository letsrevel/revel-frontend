<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { cn } from '$lib/utils/cn';

	interface Props {
		expiresAt: string | null | undefined;
		compact?: boolean;
		class?: string;
	}

	const { expiresAt, compact = false, class: className }: Props = $props();

	const targetMs = $derived(expiresAt ? Date.parse(expiresAt) : NaN);
	let now = $state(Date.now());

	const remainingMs = $derived(Number.isFinite(targetMs) ? targetMs - now : -1);
	const expired = $derived(remainingMs <= 0);
	const lessThan24h = $derived(!expired && remainingMs < 24 * 60 * 60 * 1000);

	// 1s ticks when <24h remaining (HH:MM:SS needs second-level updates); 60s
	// otherwise to keep the timer cheap during long offers.
	$effect(() => {
		if (!Number.isFinite(targetMs) || expired) return;
		const intervalMs = lessThan24h ? 1000 : 60_000;
		const id = setInterval(() => {
			now = Date.now();
		}, intervalMs);
		return () => clearInterval(id);
	});

	function pad(n: number): string {
		return n.toString().padStart(2, '0');
	}

	const displayText = $derived.by(() => {
		if (!Number.isFinite(targetMs)) return '';
		if (expired) return m['countdown.expired']();

		const totalSeconds = Math.floor(remainingMs / 1000);
		const days = Math.floor(totalSeconds / 86400);
		const hours = Math.floor((totalSeconds % 86400) / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		if (lessThan24h) {
			return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
		}

		const parts: string[] = [];
		if (days > 0) parts.push(m['countdown.units.days']({ n: days }));
		if (hours > 0) parts.push(m['countdown.units.hours']({ n: hours }));
		if (days === 0 && minutes > 0) parts.push(m['countdown.units.minutes']({ n: minutes }));
		const duration = parts.join(' ');
		return compact ? duration : m['countdown.expiresIn']({ duration });
	});

	const isMono = $derived(lessThan24h && !expired);
</script>

<span
	role="timer"
	aria-live="off"
	aria-atomic="true"
	class={cn(isMono && 'font-mono tabular-nums', expired && 'text-muted-foreground', className)}
>
	{displayText}
</span>
