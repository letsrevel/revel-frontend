<script lang="ts">
	/**
	 * Renderless cart-lifetime seat-hold host (#853 PR 3). Mounted on the event
	 * page inside the authed block, alongside (not inside) the summary bar /
	 * checkout sheet — one `CartSeatGroupHolds` child per seated cart group
	 * owns and registers that group's `SeatHoldController`.
	 *
	 * Also owns the single event-wide expiry sweep: `registry.expiresAt`
	 * mirrors `availability.my_holds_expire_at`, which is per event+identity
	 * (not per tier) — once it passes, every held seat is already gone
	 * server-side, so this reconciles local state to match: a harmless
	 * `releaseAll()` on each registered controller (cache patch + refetch),
	 * plus clearing `seatIds` on every `user_choice` group (the seats a
	 * best_available group "holds" pre-confirm don't exist yet — Task 8).
	 */
	import type { EventCart } from './cart.svelte';
	import type { CartSeatHoldRegistry } from './cart-seat-registry.svelte';
	import CartSeatGroupHolds from './CartSeatGroupHolds.svelte';
	import { toast } from 'svelte-sonner';
	import * as m from '$lib/paraglide/messages.js';

	interface Props {
		cart: EventCart;
		registry: CartSeatHoldRegistry;
		eventId: string;
	}

	const { cart, registry, eventId }: Props = $props();

	const seatedGroups = $derived([...cart.userChoiceGroups, ...cart.bestAvailableGroups]);

	// Fires once per expiry deadline: guards against the effect re-running
	// (e.g. a controller's availability refetch lands) while the same
	// deadline is still the active one, and resets the moment a NEW (later)
	// deadline appears so a future expiry can fire again.
	let handledExpiresAt: string | null = null;

	function handleExpiry(expiresAt: string): void {
		if (handledExpiresAt === expiresAt) return;
		handledExpiresAt = expiresAt;
		for (const group of seatedGroups) {
			const controller = registry.get(group.tier.id);
			if (controller) void controller.releaseAll();
		}
		for (const group of cart.userChoiceGroups) {
			cart.setSeatIds(group.tier, []);
		}
		toast.error(m['cart.holdsExpired']());
	}

	$effect(() => {
		const expiresAt = registry.expiresAt;
		if (!expiresAt) return;
		const targetMs = Date.parse(expiresAt);
		if (!Number.isFinite(targetMs)) return;
		const msRemaining = targetMs - Date.now();
		if (msRemaining <= 0) {
			handleExpiry(expiresAt);
			return;
		}
		const id = setTimeout(() => handleExpiry(expiresAt), msRemaining);
		return () => clearTimeout(id);
	});
</script>

{#each seatedGroups as group (group.tier.id)}
	<CartSeatGroupHolds {cart} {registry} {eventId} {group} />
{/each}
