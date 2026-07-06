<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		eventpublicattendanceBookmarkEvent,
		eventpublicattendanceUnbookmarkEvent
	} from '$lib/api/generated/sdk.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { Bookmark } from '@lucide/svelte';
	import { cn } from '$lib/utils/cn';

	interface Props {
		eventId: string;
		isBookmarked: boolean;
		/** `float` overlays a cover image (translucent); `inline` is a button on a light surface. */
		variant?: 'float' | 'inline';
		/** When true the control renders only while bookmarked (a removable indicator, e.g. on cards). */
		onlyWhenBookmarked?: boolean;
		class?: string;
	}

	const {
		eventId,
		isBookmarked,
		variant = 'float',
		onlyWhenBookmarked = false,
		class: className
	}: Props = $props();

	const queryClient = useQueryClient();
	const isAuthenticated = $derived(!!authStore.accessToken);

	// Local optimistic state — the icon flips instantly on click.
	// Intentionally seeded once from the prop; the component owns the toggle from here on.
	// svelte-ignore state_referenced_locally
	let bookmarked = $state(isBookmarked);
	// True while a toggle request is in flight (blocks re-entry, disables the button).
	let pending = $state(false);

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
			pending = true;
			const previous = bookmarked;
			bookmarked = next;
			return { previous };
		},
		onError: (_err: unknown, _next: boolean, context: { previous: boolean } | undefined) => {
			if (context) bookmarked = context.previous;
			toast.error(m['bookmark.error']());
		},
		onSuccess: (_data: void, next: boolean) => {
			toast.success(next ? m['bookmark.added']() : m['bookmark.removed']());
			// Keep every view of this event truthful: the dashboard "Bookmarked" facet
			// query, plus any server-loaded `is_bookmarked` (e.g. the event detail page)
			// and other mounted instances of the same event.
			queryClient.invalidateQueries({ queryKey: ['dashboard-your-events'] });
			invalidateAll();
		},
		onSettled: () => {
			pending = false;
		}
	}));

	function handleClick(event: MouseEvent) {
		// The card wraps content in a stretched <a>; never navigate on toggle.
		event.preventDefault();
		event.stopPropagation();
		// Block re-entry so rapid clicks can't queue conflicting requests that
		// resolve out of order and leave the UI inconsistent with the server.
		if (pending) return;
		mutation.mutate(!bookmarked);
	}

	const label = $derived(bookmarked ? m['bookmark.remove']() : m['bookmark.add']());

	const buttonClasses = $derived(
		cn(
			'inline-flex h-9 w-9 items-center justify-center transition-all focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60',
			variant === 'float' &&
				'rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/65 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black/50',
			variant === 'inline' &&
				'rounded-md border bg-background hover:bg-accent focus-visible:ring-ring',
			variant === 'inline' &&
				(bookmarked ? 'text-primary' : 'text-muted-foreground hover:text-foreground'),
			className
		)
	);
</script>

<!-- Stay mounted while a toggle is in flight (`pending`) so onSuccess/onSettled fire
     even when `onlyWhenBookmarked` would otherwise unmount on the optimistic flip. -->
{#if isAuthenticated && (!onlyWhenBookmarked || bookmarked || pending)}
	<button
		type="button"
		onclick={handleClick}
		disabled={pending}
		aria-busy={pending}
		aria-pressed={bookmarked}
		aria-label={label}
		title={label}
		class={buttonClasses}
	>
		<Bookmark class={cn('h-5 w-5', bookmarked && 'fill-current')} aria-hidden="true" />
	</button>
{/if}
