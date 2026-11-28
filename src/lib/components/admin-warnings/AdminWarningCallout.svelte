<script lang="ts">
	import { X } from '@lucide/svelte';
	import * as m from '$lib/paraglide/messages.js';
	import ComplianceCallout from '$lib/components/compliance/ComplianceCallout.svelte';
	import type { AdminWarning } from '$lib/utils/admin-warnings/types';

	/**
	 * One admin setting warning (#1314). Warn = amber + AlertTriangle; Info =
	 * info tint + Info icon. `role={null}`: the parent `AdminWarningList` owns the
	 * only live region, so callouts never nest one.
	 */
	interface Props {
		warning: AdminWarning;
		/** Unique id for the message, used by the dismiss button's aria-describedby. */
		messageId: string;
		/** Present only for a dismissible (Info, saved entity) warning. */
		onDismiss?: () => void;
	}

	const { warning, messageId, onDismiss }: Props = $props();

	const CONTROL_CLASS =
		'rounded-sm font-medium underline underline-offset-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

	function focusTarget(event: MouseEvent, target: string): void {
		const el = document.getElementById(target);
		if (!el) return; // The link still scrolls to the hash.
		event.preventDefault();
		el.scrollIntoView({ block: 'center' });
		el.focus({ preventScroll: true });
	}
</script>

<ComplianceCallout
	tone={warning.level === 'warn' ? 'warning' : 'info'}
	role={null}
	testId="admin-warning"
>
	<div class="flex items-start gap-2" data-warning-id={warning.id}>
		<div class="min-w-0 flex-1 space-y-1">
			<p class="font-semibold">{warning.title()}</p>
			<p id={messageId}>{warning.message()}</p>
			{#if (warning.fixTarget && warning.fixLabel) || (warning.fixHref && warning.fixLabel) || warning.action}
				<div class="flex flex-wrap gap-x-4 gap-y-1 pt-1">
					{#if warning.fixTarget && warning.fixLabel}
						{@const target = warning.fixTarget}
						<a
							href="#{target}"
							class={CONTROL_CLASS}
							data-admin-warning-control
							onclick={(e) => focusTarget(e, target)}>{warning.fixLabel()}</a
						>
					{/if}
					{#if warning.fixHref && warning.fixLabel}
						<!-- eslint-disable svelte/no-navigation-without-resolve -- the caller builds fixHref with resolve() -->
						<a href={warning.fixHref} class={CONTROL_CLASS} data-admin-warning-control
							>{warning.fixLabel()}</a
						>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{/if}
					{#if warning.action}
						{@const action = warning.action}
						<button
							type="button"
							class={CONTROL_CLASS}
							data-admin-warning-control
							aria-label={action.srContext
								? `${action.label()} (${action.srContext()})`
								: undefined}
							onclick={() => action.run()}>{action.label()}</button
						>
					{/if}
				</div>
			{/if}
		</div>
		{#if onDismiss}
			<button
				type="button"
				class="-my-2 -mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				aria-label={m['adminWarnings.dismiss']({ title: warning.title() })}
				aria-describedby={messageId}
				data-admin-warning-control
				data-admin-warning-dismiss
				onclick={onDismiss}
			>
				<X class="h-4 w-4" aria-hidden="true" />
			</button>
		{/if}
	</div>
</ComplianceCallout>
