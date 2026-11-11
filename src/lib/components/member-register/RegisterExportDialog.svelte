<script lang="ts">
	import { untrack } from 'svelte';
	import * as m from '$lib/paraglide/messages.js';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import { Label } from '$lib/components/ui/label';
	import ExportButton from '$lib/components/common/ExportButton.svelte';
	import CalendarDayPicker from './CalendarDayPicker.svelte';
	import { isCalendarDay } from '$lib/member-register/calendar-day';
	import { RegisterApiError, startRegisterExport } from '$lib/member-register/api';
	import { describeRegisterError } from '$lib/member-register/errors';

	interface Props {
		open: boolean;
		slug: string;
		accessToken: string | null;
		timezone: string | null;
		/** Pre-selects the list's "members on date" day. */
		initialDay: string | null;
		onClose: () => void;
	}

	const { open, slug, accessToken, timezone, initialDay, onClose }: Props = $props();

	let day = $state('');
	let includeMerged = $state(false);

	$effect(() => {
		if (open)
			untrack(() => {
				day = initialDay ?? '';
				includeMerged = false;
			});
	});

	// With a day chosen, the picker's own readback ("Members on <day> (<tz>)") is the
	// one place that states the day and timezone; this line only covers the
	// no-day case so the download scope is never silent.
	const showAllNote = $derived(!isCalendarDay(day));
	// A day snapshot never contains merged entries, so the option does not apply.
	const dayChosen = $derived(isCalendarDay(day));

	function handleOpenChange(next: boolean) {
		if (!next) onClose();
	}
</script>

<Dialog {open} onOpenChange={handleOpenChange}>
	<DialogContent class="sm:max-w-md">
		<DialogHeader>
			<DialogTitle>{m['memberRegister.exportTitle']()}</DialogTitle>
			<DialogDescription>{m['memberRegister.exportDescription']()}</DialogDescription>
		</DialogHeader>

		<CalendarDayPicker
			id="register-export-day"
			label={m['memberRegister.exportDayLabel']()}
			value={day}
			{timezone}
			onChange={(next) => (day = next)}
		/>

		{#if showAllNote}
			<p class="text-sm font-medium" data-testid="export-summary">
				{m['memberRegister.exportAll']()}
			</p>
		{/if}

		<div class="space-y-1">
			<div class="flex items-center gap-2">
				<Checkbox
					id="register-export-merged"
					checked={includeMerged && !dayChosen}
					disabled={dayChosen}
					aria-describedby={dayChosen ? 'register-export-merged-hint' : undefined}
					onCheckedChange={(next) => (includeMerged = next === true)}
					data-testid="export-include-merged"
				/>
				<Label for="register-export-merged">{m['memberRegister.exportIncludeMerged']()}</Label>
			</div>
			{#if dayChosen}
				<p id="register-export-merged-hint" class="text-sm text-muted-foreground">
					{m['memberRegister.exportIncludeMergedHint']()}
				</p>
			{/if}
		</div>

		<div class="flex justify-end">
			<ExportButton
				label={m['memberRegister.exportButton']()}
				{accessToken}
				onExport={() =>
					startRegisterExport(
						slug,
						accessToken,
						isCalendarDay(day) ? day : null,
						includeMerged && !dayChosen
					)}
				describeError={(error) =>
					error instanceof RegisterApiError ? describeRegisterError(error, 'export').message : null}
			/>
		</div>
	</DialogContent>
</Dialog>
