<script lang="ts">
	/**
	 * TEST-ONLY host for guest-cart-checkout-controller.test.ts — not imported
	 * by app code. The controller calls `createMutation` at init, which needs
	 * component-init context (QueryClientProvider via Svelte context) — same
	 * pattern as `SeatHoldControllerTestHost`.
	 */
	import {
		createGuestCartCheckoutController,
		type GuestCartCheckoutDeps
	} from './guest-cart-checkout-controller.svelte';

	interface Props {
		deps: GuestCartCheckoutDeps;
		onReady: (controller: ReturnType<typeof createGuestCartCheckoutController>) => void;
	}

	const { deps, onReady }: Props = $props();

	onReady(createGuestCartCheckoutController(deps));
</script>
