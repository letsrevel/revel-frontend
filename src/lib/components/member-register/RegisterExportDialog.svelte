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
	import ExportButton from '$lib/components/common/ExportButton.svelte';
	import CalendarDayPicker from './CalendarDayPicker.svelte';
	import { formatCalendarDay, isCalendarDay } from '$lib/member-register/calendar-day';
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

	$effect(() => {
		if (open) untrack(() => (day = initialDay ?? ''));
	});

	// The file's own summary row is English-only server-side; this line only
	// tells staff what they are about to download.
	const summary = $derived.by(() => {
		if (!isCalendarDay(day)) return m['memberRegister.exportAll']();
		const formatted = formatCalendarDay(day);
		return timezone
			? m['memberRegister.exportMembersOn']({ day: formatted, timezone })
			: m['memberRegister.exportMembersOnOrgTz']({ day: formatted });
	});

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

		<p class="text-sm font-medium" data-testid="export-summary">{summary}</p>

		<div class="flex justify-end">
			<ExportButton
				label={m['memberRegister.exportButton']()}
				{accessToken}
				onExport={() => startRegisterExport(slug, accessToken, isCalendarDay(day) ? day : null)}
				describeError={(error) =>
					error instanceof RegisterApiError ? describeRegisterError(error, 'export').message : null}
			/>
		</div>
	</DialogContent>
</Dialog>
