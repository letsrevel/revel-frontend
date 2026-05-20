<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle
	} from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import DurationInput from '$lib/components/forms/DurationInput.svelte';
	import type {
		WaitlistSettingsSchema,
		WaitlistSettingsUpdateSchema
	} from '$lib/api/generated/types.gen';
	import {
		createUpdateWaitlistSettingsMutationOptions,
		createWaitlistSettingsQueryOptions
	} from '$lib/api/queries/waitlist-offers';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';
	import { Loader2 } from 'lucide-svelte';

	interface Props {
		open: boolean;
		onOpenChange: (v: boolean) => void;
		mode: 'create' | 'edit';
		eventId?: string;
		initialValues?: Partial<WaitlistSettingsSchema>;
		onSave?: (values: WaitlistSettingsUpdateSchema) => void;
	}

	let { open = $bindable(), onOpenChange, mode, eventId, initialValues, onSave }: Props = $props();

	// Convert ISO 8601 duration like "PT24H", "P3D", "PT45M" into total minutes for
	// DurationInput's number storage. Returns null on empty / unparseable.
	function isoToMinutes(iso: string | null | undefined): number | null {
		if (!iso) return null;
		const re = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;
		const match = re.exec(iso);
		if (!match) return null;
		const [, d, h, mm, s] = match;
		const days = d ? parseInt(d, 10) : 0;
		const hours = h ? parseInt(h, 10) : 0;
		const minutes = mm ? parseInt(mm, 10) : 0;
		const seconds = s ? parseInt(s, 10) : 0;
		const totalMinutes = days * 1440 + hours * 60 + minutes + Math.round(seconds / 60);
		return totalMinutes > 0 ? totalMinutes : null;
	}

	function minutesToIso(value: number | null): string | null {
		if (value == null || value <= 0) return null;
		const days = Math.floor(value / 1440);
		const remainder = value - days * 1440;
		const hours = Math.floor(remainder / 60);
		const minutes = remainder - hours * 60;
		let out = 'P';
		if (days > 0) out += `${days}D`;
		if (hours > 0 || minutes > 0) {
			out += 'T';
			if (hours > 0) out += `${hours}H`;
			if (minutes > 0) out += `${minutes}M`;
		}
		return out === 'P' ? null : out;
	}

	// datetime-local <input> consumes/produces "YYYY-MM-DDTHH:mm" strings; we
	// round-trip with the backend's ISO timestamp.
	function isoDateTimeToLocalInput(iso: string | null | undefined): string {
		if (!iso) return '';
		const d = new Date(iso);
		if (isNaN(d.getTime())) return '';
		const pad = (n: number) => n.toString().padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	function localInputToIso(local: string): string | null {
		if (!local) return null;
		const d = new Date(local);
		return isNaN(d.getTime()) ? null : d.toISOString();
	}

	let timeWindowMinutes = $state<number | null>(
		isoToMinutes(initialValues?.waitlist_time_window ?? null)
	);
	let batchSize = $state<number>(initialValues?.waitlist_batch_size ?? 0);
	let cutoffLocal = $state<string>(isoDateTimeToLocalInput(initialValues?.waitlist_cutoff_date));
	let lotteryMode = $state<boolean>(initialValues?.waitlist_lottery_mode ?? false);

	let fieldErrors = $state<Record<string, string>>({});

	const queryClient = useQueryClient();

	const updateMutation = createMutation(
		createUpdateWaitlistSettingsMutationOptions(
			eventId ?? '',
			() => authStore.accessToken,
			queryClient
		)
	);

	const settingsOptionsBase = createWaitlistSettingsQueryOptions(
		eventId ?? '',
		() => authStore.accessToken
	);
	const settingsQuery = createQuery(() => ({
		...settingsOptionsBase(),
		enabled: mode === 'edit' && !!eventId && open
	}));

	// Hydrate form fields from the server when the modal opens in edit mode, so
	// the user sees the persisted values instead of `initialValues` defaults
	// (EventDetailSchema doesn't expose the advanced waitlist fields).
	let hasHydrated = $state(false);
	$effect(() => {
		if (!open) {
			hasHydrated = false;
			return;
		}
		if (mode !== 'edit') return;
		if (hasHydrated) return;
		const data = settingsQuery.data;
		if (!data) return;
		timeWindowMinutes = isoToMinutes(data.waitlist_time_window ?? null);
		batchSize = data.waitlist_batch_size ?? 0;
		cutoffLocal = isoDateTimeToLocalInput(data.waitlist_cutoff_date);
		lotteryMode = data.waitlist_lottery_mode ?? false;
		hasHydrated = true;
	});

	function buildPayload(): WaitlistSettingsUpdateSchema {
		return {
			waitlist_time_window: minutesToIso(timeWindowMinutes),
			waitlist_batch_size: Number.isFinite(batchSize) ? Math.max(0, Math.floor(batchSize)) : 0,
			waitlist_cutoff_date: localInputToIso(cutoffLocal),
			waitlist_lottery_mode: lotteryMode
		};
	}

	function parseFieldErrors(error: unknown): Record<string, string> {
		if (error && typeof error === 'object' && 'detail' in error) {
			const detail = (error as { detail?: unknown }).detail;
			if (Array.isArray(detail)) {
				const out: Record<string, string> = {};
				for (const item of detail) {
					if (item && typeof item === 'object' && 'loc' in item && 'msg' in item) {
						const loc = (item as { loc?: unknown[] }).loc;
						const msg = (item as { msg?: unknown }).msg;
						if (Array.isArray(loc) && loc.length > 0 && typeof msg === 'string') {
							const field = String(loc[loc.length - 1]);
							out[field] = msg;
						}
					}
				}
				return out;
			}
		}
		return {};
	}

	async function handleSave() {
		fieldErrors = {};
		const payload = buildPayload();

		if (mode === 'create') {
			onSave?.(payload);
			onOpenChange(false);
			return;
		}

		if (!eventId) {
			toast.error('Missing event id');
			return;
		}

		updateMutation.mutate(payload, {
			onSuccess: () => {
				toast.success(m['waitlistSettings.saved']());
				onOpenChange(false);
			},
			onError: (err) => {
				const parsed = parseFieldErrors(err);
				if (Object.keys(parsed).length > 0) {
					fieldErrors = parsed;
				} else {
					toast.error(err instanceof Error ? err.message : 'Failed to update settings');
				}
			}
		});
	}

	function handleCancel() {
		onOpenChange(false);
	}
</script>

<Dialog bind:open onOpenChange={(v) => onOpenChange(v)}>
	<DialogContent class="max-h-[90vh] max-w-lg overflow-y-auto">
		<DialogHeader>
			<DialogTitle>{m['waitlistSettings.title']()}</DialogTitle>
			<DialogDescription>{m['waitlistSettings.description']()}</DialogDescription>
		</DialogHeader>

		<div class="space-y-4 py-2">
			<div class="space-y-1.5">
				<DurationInput
					bind:value={timeWindowMinutes}
					storageUnit="minutes"
					defaultUnit="hours"
					label={m['waitlistSettings.timeWindow.label']()}
					helpText={m['waitlistSettings.timeWindow.helper']()}
					emptyValue={null}
					emptyLabel="—"
					min={0}
				/>
				{#if fieldErrors.waitlist_time_window}
					<p class="text-xs text-destructive">{fieldErrors.waitlist_time_window}</p>
				{/if}
			</div>

			<div class="space-y-1.5">
				<Label for="waitlist-batch-size">{m['waitlistSettings.batchSize.label']()}</Label>
				<Input id="waitlist-batch-size" type="number" min="0" step="1" bind:value={batchSize} />
				<p class="text-xs text-muted-foreground">{m['waitlistSettings.batchSize.helper']()}</p>
				{#if fieldErrors.waitlist_batch_size}
					<p class="text-xs text-destructive">{fieldErrors.waitlist_batch_size}</p>
				{/if}
			</div>

			<div class="space-y-1.5">
				<Label for="waitlist-cutoff-date">{m['waitlistSettings.cutoffDate.label']()}</Label>
				<Input id="waitlist-cutoff-date" type="datetime-local" bind:value={cutoffLocal} />
				<p class="text-xs text-muted-foreground">{m['waitlistSettings.cutoffDate.helper']()}</p>
				{#if fieldErrors.waitlist_cutoff_date}
					<p class="text-xs text-destructive">{fieldErrors.waitlist_cutoff_date}</p>
				{/if}
			</div>

			<div class="space-y-1.5">
				<div class="flex items-center gap-2">
					<Checkbox
						id="waitlist-lottery-mode"
						checked={lotteryMode}
						onCheckedChange={(checked) => {
							lotteryMode = checked === true;
						}}
					/>
					<Label for="waitlist-lottery-mode" class="cursor-pointer text-sm font-medium">
						{m['waitlistSettings.lotteryMode.label']()}
					</Label>
				</div>
				<p class="text-xs text-muted-foreground">{m['waitlistSettings.lotteryMode.helper']()}</p>
				{#if fieldErrors.waitlist_lottery_mode}
					<p class="text-xs text-destructive">{fieldErrors.waitlist_lottery_mode}</p>
				{/if}
			</div>
		</div>

		<DialogFooter>
			<Button variant="ghost" onclick={handleCancel} disabled={updateMutation.isPending}>
				Cancel
			</Button>
			<Button onclick={handleSave} disabled={mode === 'edit' && updateMutation.isPending}>
				{#if mode === 'edit' && updateMutation.isPending}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
				{/if}
				{m['waitlistSettings.save']()}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
