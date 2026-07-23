<script lang="ts">
	/**
	 * TEST-ONLY host for seat-hold-controller.test.ts — not imported by app code.
	 *
	 * SeatHoldController calls `createQuery` in its constructor, which requires
	 * component-init context (QueryClientProvider via Svelte context). This host
	 * instantiates the controller during init and hands it to the test through
	 * `onReady`, mirroring the `onController` convention of the real consumers
	 * (SeatAssignmentSection / GuestTicketSeatSection).
	 */
	import {
		SeatHoldController,
		type SeatHoldControllerOptions
	} from './seat-hold-controller.svelte';

	interface Props {
		options: SeatHoldControllerOptions;
		onReady: (controller: SeatHoldController) => void;
	}

	const { options, onReady }: Props = $props();

	onReady(new SeatHoldController(options));
</script>
