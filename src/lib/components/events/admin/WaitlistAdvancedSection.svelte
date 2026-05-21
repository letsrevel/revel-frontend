<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { Button } from '$lib/components/ui/button';
	import {
		Tooltip,
		TooltipContent,
		TooltipProvider,
		TooltipTrigger
	} from '$lib/components/ui/tooltip';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import WaitlistSettingsModal from '$lib/components/events/waitlist/WaitlistSettingsModal.svelte';
	import type {
		EventCreateSchema,
		WaitlistSettingsUpdateSchema
	} from '$lib/api/generated/types.gen';

	type WaitlistFormShape = Partial<EventCreateSchema> & {
		id?: string;
		seats_held?: number;
		waitlist_time_window?: string | null;
		waitlist_batch_size?: number | null;
		waitlist_cutoff_date?: string | null;
		waitlist_lottery_mode?: boolean | null;
	};

	interface Props {
		formData: WaitlistFormShape;
		isEditMode?: boolean;
		confirmCloseOpen: boolean;
		onConfirmClose: () => void;
		onCancelClose: () => void;
		onUpdate: (data: Partial<EventCreateSchema>) => void;
	}

	const { formData, isEditMode, confirmCloseOpen, onConfirmClose, onCancelClose, onUpdate }: Props =
		$props();

	let modalOpen = $state(false);

	function handleSave(values: WaitlistSettingsUpdateSchema): void {
		// WaitlistSettingsUpdateSchema allows `waitlist_open: null`; EventCreateSchema
		// only accepts boolean | undefined. Coerce null → undefined to satisfy the
		// onUpdate contract; the modal only sets boolean values anyway.
		const { waitlist_open, ...rest } = values;
		onUpdate({ ...rest, waitlist_open: waitlist_open ?? undefined });
	}
</script>

{#if formData.waitlist_open}
	<Button type="button" variant="outline" size="sm" onclick={() => (modalOpen = true)}>
		{m['waitlistSettings.openButton']()}
	</Button>
{:else}
	<TooltipProvider>
		<Tooltip>
			<TooltipTrigger>
				{#snippet child({ props })}
					<span {...props} class="inline-block">
						<Button type="button" variant="outline" size="sm" disabled>
							{m['waitlistSettings.openButton']()}
						</Button>
					</span>
				{/snippet}
			</TooltipTrigger>
			<TooltipContent>
				<p class="max-w-xs text-sm">{m['waitlistSettings.closedTooltip']()}</p>
			</TooltipContent>
		</Tooltip>
	</TooltipProvider>
{/if}

{#if isEditMode && formData.id}
	<WaitlistSettingsModal
		bind:open={modalOpen}
		onOpenChange={(v) => (modalOpen = v)}
		mode="edit"
		eventId={formData.id}
		initialValues={{
			waitlist_open: formData.waitlist_open ?? false,
			waitlist_time_window: formData.waitlist_time_window ?? null,
			waitlist_batch_size: formData.waitlist_batch_size ?? 0,
			waitlist_cutoff_date: formData.waitlist_cutoff_date ?? null,
			waitlist_lottery_mode: formData.waitlist_lottery_mode ?? false
		}}
	/>
{:else}
	<WaitlistSettingsModal
		bind:open={modalOpen}
		onOpenChange={(v) => (modalOpen = v)}
		mode="create"
		initialValues={{
			waitlist_open: formData.waitlist_open ?? false,
			waitlist_time_window: formData.waitlist_time_window ?? null,
			waitlist_batch_size: formData.waitlist_batch_size ?? 0,
			waitlist_cutoff_date: formData.waitlist_cutoff_date ?? null,
			waitlist_lottery_mode: formData.waitlist_lottery_mode ?? false
		}}
		onSave={handleSave}
	/>
{/if}

<ConfirmDialog
	isOpen={confirmCloseOpen}
	title={m['waitlistSettings.closeConfirm.title']()}
	message={m['waitlistSettings.closeConfirm.body']({
		count: (formData.seats_held ?? 0).toString()
	})}
	variant="warning"
	onConfirm={onConfirmClose}
	onCancel={onCancelClose}
/>
