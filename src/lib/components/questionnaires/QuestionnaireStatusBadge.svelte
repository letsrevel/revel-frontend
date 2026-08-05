<script lang="ts">
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import type { Tone } from '$lib/components/common/tones';
	import type { QuestionnaireStatus } from '$lib/api/generated/types.gen';

	interface Props {
		status: QuestionnaireStatus;
		/**
		 * Already-translated label — i18n stays at the call site. `QuestionnaireCard`
		 * and `QuestionnaireStatusBar` each carry their own pre-existing i18n keys
		 * for the same three states (different namespaces, same English text), so
		 * this mapper stays label-agnostic rather than picking one and silently
		 * changing the other caller's translated string.
		 */
		label: string;
		size?: 'sm' | 'md' | 'lg';
		class?: string;
	}
	const { status, label, size = 'sm', class: className }: Props = $props();

	/**
	 * Domain→tone mapper (rebrand): replaces two independent hand-picked
	 * amber/blue `Badge` implementations (`QuestionnaireCard`, `QuestionnaireStatusBar`)
	 * with one shared, audited `StatusBadge` token mapping. `published` earns
	 * `success` (live), `ready` is `info` (staged, awaiting publish), `draft` is
	 * `warning` (not yet usable).
	 */
	const TONE_MAP: Record<QuestionnaireStatus, Tone> = {
		draft: 'warning',
		ready: 'info',
		published: 'success'
	};
	const tone = $derived(TONE_MAP[status]);
</script>

<StatusBadge {tone} {label} {size} class={className} />
