<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		eventpublicattendanceBookmarkEvent,
		eventpublicattendanceUnbookmarkEvent
	} from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';
	import { Bookmark } from 'lucide-svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		eventId: string;
		isBookmarked: boolean;
		variant?: 'float' | 'header';
		class?: string;
	}

	let { eventId, isBookmarked, variant = 'float', class: className }: Props = $props();

	const queryClient = useQueryClient();
	const isAuthenticated = $derived(!!authStore.accessToken);

	// Local optimistic state — the icon flips instantly on click.
	// Intentionally seeded once from the prop; the component owns the toggle from here on.
	// svelte-ignore state_referenced_locally
	let bookmarked = $state(isBookmarked);

	// The target state is passed as the mutation variable so the request does not
	// depend on the reactive `bookmarked` value, which onMutate flips optimistically
	// *before* mutationFn runs.
	const mutation = createMutation(() => ({
		mutationFn: async (next: boolean) => {
			if (next) {
				await eventpublicattendanceBookmarkEvent({ path: { event_id: eventId } });
			} else {
				await eventpublicattendanceUnbookmarkEvent({ path: { event_id: eventId } });
			}
		},
		onMutate: (next: boolean) => {
			const previous = bookmarked;
			bookmarked = next;
			return { previous };
		},
		onError: (_err: unknown, _next: boolean, context: { previous: boolean } | undefined) => {
			if (context) bookmarked = context.previous;
			toast.error(m['bookmark.error']());
		},
		onSuccess: () => {
			// Keep the dashboard "Bookmarked" facet truthful.
			queryClient.invalidateQueries({ queryKey: ['dashboard-your-events'] });
		}
	}));

	function handleClick(event: MouseEvent) {
		// The card wraps content in a stretched <a>; never navigate on toggle.
		event.preventDefault();
		event.stopPropagation();
		mutation.mutate(!bookmarked);
	}

	const sizeClasses = $derived(variant === 'header' ? 'h-11 w-11' : 'h-9 w-9');
</script>

{#if isAuthenticated}
	<button
		type="button"
		onclick={handleClick}
		aria-pressed={bookmarked}
		aria-label={bookmarked ? m['bookmark.remove']() : m['bookmark.add']()}
		class={cn(
			'inline-flex items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm transition-all hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/50',
			sizeClasses,
			className
		)}
	>
		<Bookmark class={cn('h-5 w-5', bookmarked && 'fill-current')} aria-hidden="true" />
	</button>
{/if}
