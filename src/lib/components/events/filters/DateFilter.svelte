<script lang="ts">
	import { Calendar } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		includePast: boolean;
		onTogglePast: (value: boolean) => void;
		class?: string;
	}

	let { includePast = false, onTogglePast, class: className }: Props = $props();

	function handleToggle(): void {
		onTogglePast(!includePast);
	}
</script>

<div class={cn('space-y-3', className)}>
	<div class="flex items-center gap-2">
		<Calendar class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
		<h3 class="text-sm font-medium">Date</h3>
	</div>

	<div class="space-y-2">
		<label class="flex items-center gap-2 text-sm">
			<input
				type="checkbox"
				checked={includePast}
				onchange={handleToggle}
				class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
			/>
			<span>Include past events</span>
		</label>

		<p class="text-xs text-muted-foreground">
			{includePast ? 'Showing all events' : 'Showing upcoming events only'}
		</p>
	</div>
</div>
