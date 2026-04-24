<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { AlertTriangle, CalendarClock, Loader2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import { organizationadminrecurringeventsUpdateRecurrence } from '$lib/api/generated/sdk.gen';
	import type {
		EventSeriesRecurrenceDetailSchema,
		EventSeriesRecurrenceUpdateSchema,
		RecurrenceRuleUpdateSchema
	} from '$lib/api/generated/types.gen';
	import { invalidateSeries } from '$lib/queries/event-series';
	import { mutualExclusionGuard } from '$lib/utils/recurrence';
	import type { RecurrenceRuleCreate } from '$lib/types/recurrence';
	import RecurrencePicker from './RecurrencePicker.svelte';

	interface Props {
		open: boolean;
		series: EventSeriesRecurrenceDetailSchema;
		organizationSlug: string;
		accessToken: string | null;
		onClose: () => void;
	}

	// eslint-disable-next-line prefer-const -- `open` is bindable so the whole destructure must use `let`.
	let { open = $bindable(), series, organizationSlug, accessToken, onClose }: Props = $props();

	const queryClient = useQueryClient();

	// Narrow flow: form → confirm. Confirm only appears when a recurrence field
	// actually changed — pure settings edits (auto_publish / generation window)
	// don't affect already-scheduled dates and skip the warning step.
	type Step = 'form' | 'confirm';
	let step = $state<Step>('form');

	// RecurrencePicker consumes a `RecurrenceRuleCreate`-shaped object. Seed it
	// from the series' current rule — `dtstart` stays pinned (the picker keeps
	// it read-only via the `dtstartReadOnly` prop).
	function ruleFromSeries(): Partial<RecurrenceRuleCreate> {
		const r = series.recurrence_rule;
		if (!r) return {};
		return {
			frequency: r.frequency,
			interval: r.interval,
			weekdays: r.weekdays,
			monthly_type: r.monthly_type ?? undefined,
			day_of_month: r.day_of_month ?? undefined,
			nth_weekday: r.nth_weekday ?? undefined,
			weekday: r.weekday ?? undefined,
			dtstart: r.dtstart,
			until: r.until ?? null,
			count: r.count ?? null,
			timezone: r.timezone
		};
	}

	// Initialize to neutral defaults; the open effect below seeds from `series`
	// so Svelte's static analysis doesn't flag a prop-captured-in-state warning.
	let rule = $state<Partial<RecurrenceRuleCreate>>({});
	let autoPublish = $state<boolean>(false);
	let generationWindowWeeks = $state<number>(8);

	let validationErrors = $state<Record<string, string>>({});
	let errorBanner = $state<string | null>(null);

	// Re-seed every time the dialog opens. We always diff against the current
	// `series` prop (the server-authoritative snapshot the dashboard holds) so
	// concurrent edits don't leak across opens.
	$effect(() => {
		if (!open) return;
		rule = ruleFromSeries();
		autoPublish = series.auto_publish;
		generationWindowWeeks = series.generation_window_weeks;
		step = 'form';
		validationErrors = {};
		errorBanner = null;
	});

	function handleRecurrenceChange(next: Partial<RecurrenceRuleCreate>): void {
		rule = next;
	}

	function handleWindowInput(event: Event): void {
		const raw = (event.target as HTMLInputElement).value;
		const n = Number(raw);
		if (Number.isFinite(n)) {
			generationWindowWeeks = Math.max(1, Math.min(52, Math.floor(n)));
		}
	}

	// Dirty diff — field-level compare against the current server snapshot.
	// `EventSeriesRecurrenceUpdateSchema` treats every field as optional; we
	// only include fields the user actually changed so the backend doesn't
	// rewrite values that didn't move.
	const recurrenceDiff = $derived.by<RecurrenceRuleUpdateSchema>(() => {
		const r: RecurrenceRuleUpdateSchema = {};
		const orig = series.recurrence_rule;
		if (!orig) return r;

		if (rule.frequency && rule.frequency !== orig.frequency) r.frequency = rule.frequency;

		const nextInterval = rule.interval ?? 1;
		if (nextInterval !== orig.interval) r.interval = nextInterval;

		const nextWeekdays = [...(rule.weekdays ?? [])].sort((a, b) => a - b);
		const origWeekdays = [...(orig.weekdays ?? [])].sort((a, b) => a - b);
		const weekdaysChanged =
			nextWeekdays.length !== origWeekdays.length ||
			nextWeekdays.some((w, i) => w !== origWeekdays[i]);
		if (weekdaysChanged) r.weekdays = nextWeekdays;

		const nextMonthlyType = rule.monthly_type ?? null;
		const origMonthlyType = orig.monthly_type ?? null;
		if (nextMonthlyType !== origMonthlyType) r.monthly_type = nextMonthlyType;

		const nextDom = rule.day_of_month ?? null;
		const origDom = orig.day_of_month ?? null;
		if (nextDom !== origDom) r.day_of_month = nextDom;

		const nextNth = rule.nth_weekday ?? null;
		const origNth = orig.nth_weekday ?? null;
		if (nextNth !== origNth) r.nth_weekday = nextNth;

		const nextWd = rule.weekday ?? null;
		const origWd = orig.weekday ?? null;
		if (nextWd !== origWd) r.weekday = nextWd;

		const nextUntil = rule.until ?? null;
		const origUntil = orig.until ?? null;
		if (nextUntil !== origUntil) r.until = nextUntil;

		const nextCount = rule.count ?? null;
		const origCount = orig.count ?? null;
		if (nextCount !== origCount) r.count = nextCount;

		return r;
	});

	const recurrenceChanged = $derived(Object.keys(recurrenceDiff).length > 0);
	const autoPublishChanged = $derived(autoPublish !== series.auto_publish);
	const windowChanged = $derived(generationWindowWeeks !== series.generation_window_weeks);
	const hasChanges = $derived(recurrenceChanged || autoPublishChanged || windowChanged);

	const diff = $derived.by<EventSeriesRecurrenceUpdateSchema>(() => {
		const body: EventSeriesRecurrenceUpdateSchema = {};
		if (recurrenceChanged) body.recurrence = recurrenceDiff;
		if (autoPublishChanged) body.auto_publish = autoPublish;
		if (windowChanged) body.generation_window_weeks = generationWindowWeeks;
		return body;
	});

	// Pre-submit validation — mirrors the wizard's rules so the user never sees
	// a 422 for a preventable error. Boundary mutex + per-frequency field
	// requirements are the only constraints beyond schema-level types.
	function validateRecurrence(): boolean {
		const errors: Record<string, string> = {};
		if (rule.frequency === 'weekly') {
			if (!rule.weekdays || rule.weekdays.length === 0) {
				errors.weekdays = m['recurringEvents.picker.validation.weekdaysRequired']();
			}
		}
		if (rule.frequency === 'monthly') {
			if (rule.monthly_type === 'day') {
				const dom = rule.day_of_month;
				if (!dom || dom < 1 || dom > 31) {
					errors.day_of_month = m['recurringEvents.picker.validation.dayOfMonthRequired']();
				}
			} else if (rule.monthly_type === 'weekday') {
				const nth = rule.nth_weekday;
				const wd = rule.weekday;
				const validNth = nth === 1 || nth === 2 || nth === 3 || nth === 4 || nth === -1;
				const validWd = typeof wd === 'number' && wd >= 0 && wd <= 6;
				if (!validNth || !validWd) {
					errors.nth_weekday = m['recurringEvents.picker.validation.nthWeekdayRequired']();
				}
			}
		}
		const guard = mutualExclusionGuard({
			until: rule.until ?? null,
			count: rule.count ?? null
		});
		if (!guard.ok) {
			if (guard.reason === 'both_set') {
				errors.boundary = m['recurringEvents.picker.validation.boundaryMutex']();
			} else if (guard.reason === 'count_invalid') {
				errors.count = m['recurringEvents.picker.validation.countMin']();
			} else if (guard.reason === 'until_invalid') {
				errors.until = m['recurringEvents.picker.validation.untilAfterStart']();
			}
		}
		if (rule.until && rule.dtstart) {
			if (new Date(rule.until) <= new Date(rule.dtstart)) {
				errors.until = m['recurringEvents.picker.validation.untilAfterStart']();
			}
		}
		validationErrors = errors;
		return Object.keys(errors).length === 0;
	}

	const updateMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken) throw new Error('Not authenticated');
			const response = await organizationadminrecurringeventsUpdateRecurrence({
				path: { slug: organizationSlug, series_id: series.id },
				body: diff,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				const payload = response.error as Record<string, unknown>;
				throw new Error(extractErrorMessage(payload));
			}
			return response.data;
		},
		onSuccess: async () => {
			await invalidateSeries(queryClient, organizationSlug, series.id);
			toast.success(m['recurringEvents.recurrenceDialog.savedToast']());
			onClose();
		},
		onError: (err: Error) => {
			errorBanner = err.message || m['recurringEvents.recurrenceDialog.errorToast']();
			toast.error(errorBanner);
		}
	}));

	function extractErrorMessage(payload: Record<string, unknown>): string {
		if (typeof payload.detail === 'string') return payload.detail;
		if (payload.errors && typeof payload.errors === 'object' && !Array.isArray(payload.errors)) {
			const first = Object.values(payload.errors as Record<string, unknown>)[0];
			if (typeof first === 'string') return first;
			if (Array.isArray(first) && typeof first[0] === 'string') return first[0];
		}
		return m['recurringEvents.recurrenceDialog.errorToast']();
	}

	function handleContinue(): void {
		errorBanner = null;
		if (!hasChanges) {
			toast.info(m['recurringEvents.recurrenceDialog.noChangesToast']());
			return;
		}
		if (!validateRecurrence()) {
			errorBanner = m['recurringEvents.error.422Generic']();
			return;
		}
		// Only cadence changes need the verbatim "already scheduled dates stay"
		// warning. Pure settings edits skip straight to the PATCH.
		if (recurrenceChanged) {
			step = 'confirm';
		} else {
			updateMutation.mutate();
		}
	}

	function handleBack(): void {
		step = 'form';
	}

	function handleSave(): void {
		errorBanner = null;
		updateMutation.mutate();
	}

	function handleClose(): void {
		if (updateMutation.isPending) return;
		onClose();
	}

	const dialogTitle = $derived(
		step === 'confirm'
			? m['recurringEvents.recurrenceDialog.confirmHeading']()
			: m['recurringEvents.recurrenceDialog.title']()
	);

	const continueLabel = $derived(
		recurrenceChanged
			? m['recurringEvents.recurrenceDialog.buttons.review']()
			: m['recurringEvents.recurrenceDialog.buttons.save']()
	);
</script>

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
	<DialogContent
		class="max-h-[90vh] max-w-2xl overflow-y-auto"
		data-testid="recurrence-edit-dialog"
	>
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<CalendarClock class="h-5 w-5" aria-hidden="true" />
				{dialogTitle}
			</DialogTitle>
		</DialogHeader>

		{#if step === 'form'}
			<p class="mt-2 text-sm text-muted-foreground">
				{m['recurringEvents.recurrenceDialog.description']()}
			</p>

			<div class="mt-6 space-y-8">
				<section class="space-y-4">
					<h3 class="text-sm font-semibold">
						{m['recurringEvents.recurrenceDialog.sections.recurrence']()}
					</h3>
					<RecurrencePicker
						{rule}
						onChange={handleRecurrenceChange}
						dtstartReadOnly={true}
						{validationErrors}
					/>
				</section>

				<section class="space-y-4 border-t border-border pt-6">
					<h3 class="text-sm font-semibold">
						{m['recurringEvents.recurrenceDialog.sections.settings']()}
					</h3>

					<label
						class="flex cursor-pointer items-start gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
					>
						<input
							type="checkbox"
							bind:checked={autoPublish}
							disabled={updateMutation.isPending}
							class="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring"
							data-testid="recurrence-edit-auto-publish"
						/>
						<div class="flex-1 space-y-1">
							<div class="text-sm font-medium">
								{m['recurringEvents.wizard.autoPublishLabel']()}
							</div>
							<p class="text-xs text-muted-foreground">
								{autoPublish
									? m['recurringEvents.wizard.autoPublishOnHelper']()
									: m['recurringEvents.wizard.autoPublishOffHelper']()}
							</p>
						</div>
					</label>

					<div class="space-y-2">
						<Label for="recurrence-edit-window">
							{m['recurringEvents.wizard.generationWindowLabel']()}
						</Label>
						<Input
							id="recurrence-edit-window"
							type="number"
							min={1}
							max={52}
							value={generationWindowWeeks}
							oninput={handleWindowInput}
							disabled={updateMutation.isPending}
							class="w-32"
							data-testid="recurrence-edit-window"
						/>
						<p class="text-xs text-muted-foreground">
							{m['recurringEvents.wizard.generationWindowHelper']({
								weeks: generationWindowWeeks
							})}
						</p>
					</div>
				</section>
			</div>

			{#if errorBanner}
				<div
					class="mt-4 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
					role="alert"
					data-testid="recurrence-edit-error"
				>
					{errorBanner}
				</div>
			{/if}

			<div
				class="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end"
			>
				<Button
					type="button"
					variant="outline"
					onclick={handleClose}
					disabled={updateMutation.isPending}
					data-testid="recurrence-edit-cancel"
				>
					{m['recurringEvents.recurrenceDialog.buttons.cancel']()}
				</Button>
				<Button
					type="button"
					onclick={handleContinue}
					disabled={!hasChanges || updateMutation.isPending}
					data-testid="recurrence-edit-continue"
				>
					{#if updateMutation.isPending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
						{m['recurringEvents.recurrenceDialog.buttons.saving']()}
					{:else}
						{continueLabel}
					{/if}
				</Button>
			</div>
		{:else}
			<div
				class="border-warning/50 bg-warning/10 mt-4 flex items-start gap-3 rounded-md border p-4 text-sm"
				data-testid="recurrence-edit-confirm-banner"
			>
				<AlertTriangle
					class="text-warning-foreground mt-0.5 h-5 w-5 flex-shrink-0"
					aria-hidden="true"
				/>
				<p class="flex-1">
					{m['recurringEvents.recurrenceDialog.cadenceChangeConfirm']()}
				</p>
			</div>

			{#if errorBanner}
				<div
					class="mt-4 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
					role="alert"
					data-testid="recurrence-edit-error"
				>
					{errorBanner}
				</div>
			{/if}

			<div
				class="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end"
			>
				<Button
					type="button"
					variant="outline"
					onclick={handleBack}
					disabled={updateMutation.isPending}
					data-testid="recurrence-edit-back"
				>
					{m['recurringEvents.recurrenceDialog.buttons.back']()}
				</Button>
				<Button
					type="button"
					onclick={handleSave}
					disabled={updateMutation.isPending}
					data-testid="recurrence-edit-save"
				>
					{#if updateMutation.isPending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
						{m['recurringEvents.recurrenceDialog.buttons.saving']()}
					{:else}
						{m['recurringEvents.recurrenceDialog.buttons.confirm']()}
					{/if}
				</Button>
			</div>
		{/if}
	</DialogContent>
</Dialog>
