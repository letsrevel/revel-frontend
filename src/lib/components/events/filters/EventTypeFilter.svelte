<script lang="ts">
	import type { EventFilters } from '$lib/utils/filters';
	import { Eye } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		eventType?: EventFilters['eventType'];
		onChangeEventType: (type: EventFilters['eventType']) => void;
		class?: string;
	}

	let { eventType, onChangeEventType, class: className }: Props = $props();

	const options: Array<{ value: EventFilters['eventType']; label: string; description: string }> = [
		{ value: undefined, label: 'All Events', description: 'Show all event types' },
		{ value: 'public', label: 'Public', description: 'Open to everyone' },
		{ value: 'private', label: 'Private', description: 'Invitation only' },
		{ value: 'members-only', label: 'Members Only', description: 'For members of the organization' }
	];

	function handleChange(value: EventFilters['eventType']): void {
		onChangeEventType(value);
	}
</script>

<div class={cn('space-y-3', className)}>
	<div class="flex items-center gap-2">
		<Eye class="h-4 w-4 text-muted-foreground" aria-hidden="true" />
		<h3 class="text-sm font-medium">Event Type</h3>
	</div>

	<div class="space-y-2" role="radiogroup" aria-label="Event type filter">
		{#each options as option (option.label)}
			<label class="flex cursor-pointer items-start gap-3 rounded-md p-2 transition-colors hover:bg-accent">
				<input
					type="radio"
					name="event-type"
					value={option.value || ''}
					checked={eventType === option.value}
					onchange={() => handleChange(option.value)}
					class="mt-0.5 h-4 w-4 rounded-full border-gray-300 text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
				/>
				<div class="flex-1">
					<div class="text-sm font-medium">{option.label}</div>
					<div class="text-xs text-muted-foreground">{option.description}</div>
				</div>
			</label>
		{/each}
	</div>
</div>
