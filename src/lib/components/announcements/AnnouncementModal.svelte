<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type {
		AnnouncementSchema,
		EventInListSchema,
		MembershipTierSchema
	} from '$lib/api/generated/types.gen';
	import {
		organizationadminannouncementsCreateAnnouncement,
		organizationadminannouncementsUpdateAnnouncement,
		organizationadminannouncementsSendAnnouncement
	} from '$lib/api/generated/sdk.gen';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Input } from '$lib/components/ui/input';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import MarkdownEditor from '$lib/components/forms/MarkdownEditor.svelte';
	import { Loader2, ChevronDown, ChevronUp, Users, UserCog, Calendar, Layers } from 'lucide-svelte';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { authStore } from '$lib/stores/auth.svelte';
	import { toast } from 'svelte-sonner';
	import { cn } from '$lib/utils/cn';

	type TargetType = 'all_members' | 'staff_only' | 'event' | 'tiers';

	interface Props {
		announcement: AnnouncementSchema | null;
		open: boolean;
		organizationSlug: string;
		preSelectedEventId?: string;
		events?: EventInListSchema[];
		eventsLoading?: boolean;
		includePastEvents?: boolean;
		tiers?: MembershipTierSchema[];
		onClose: () => void;
		onSuccess: () => void;
		onIncludePastChange?: (includePast: boolean) => void;
	}

	let {
		announcement,
		open,
		organizationSlug,
		preSelectedEventId,
		events = [],
		eventsLoading = false,
		includePastEvents = false,
		tiers = [],
		onClose,
		onSuccess,
		onIncludePastChange
	}: Props = $props();

	const queryClient = useQueryClient();

	// Form state
	let title = $state('');
	let body = $state('');
	let targetType = $state<TargetType>('all_members');
	let selectedEventId = $state<string | null>(null);
	let selectedTierIds = $state<string[]>([]);
	let pastVisibility = $state(true);
	let showAdvanced = $state(false);
	let errors = $state<{ title?: string; body?: string; target?: string }>({});

	// Derived
	let isEditing = $derived(!!announcement);
	let accessToken = $derived(authStore.accessToken);

	// Sync form with announcement prop (for editing)
	$effect(() => {
		if (open) {
			if (announcement) {
				title = announcement.title;
				body = announcement.body ?? '';
				pastVisibility = announcement.past_visibility ?? true;

				// Determine target type from announcement
				if (announcement.event_id) {
					targetType = 'event';
					selectedEventId = announcement.event_id;
				} else if (announcement.target_staff_only) {
					targetType = 'staff_only';
				} else if (announcement.target_tiers && announcement.target_tiers.length > 0) {
					targetType = 'tiers';
					selectedTierIds = announcement.target_tiers.map((t) => t.id);
					showAdvanced = true;
				} else {
					targetType = 'all_members';
				}
			} else {
				// Reset for create mode
				title = '';
				body = '';
				targetType = preSelectedEventId ? 'event' : 'all_members';
				selectedEventId = preSelectedEventId || null;
				selectedTierIds = [];
				pastVisibility = true;
				showAdvanced = false;
			}
			errors = {};
		}
	});

	// Create mutation
	const createMut = createMutation(() => ({
		mutationFn: async (data: {
			title: string;
			body: string;
			event_id?: string | null;
			target_all_members?: boolean;
			target_tier_ids?: string[];
			target_staff_only?: boolean;
			past_visibility?: boolean;
		}) => {
			const response = await organizationadminannouncementsCreateAnnouncement({
				path: { slug: organizationSlug },
				body: data,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw response.error;
			return response.data;
		},
		onSuccess: () => {
			toast.success(m['announcements.toast.created']());
			queryClient.invalidateQueries({ queryKey: ['announcements', organizationSlug] });
			onSuccess();
		},
		onError: () => {
			toast.error(m['announcements.toast.error']());
		}
	}));

	// Update mutation
	const updateMut = createMutation(() => ({
		mutationFn: async (data: {
			title?: string | null;
			body?: string | null;
			event_id?: string | null;
			target_all_members?: boolean | null;
			target_tier_ids?: string[] | null;
			target_staff_only?: boolean | null;
			past_visibility?: boolean | null;
		}) => {
			if (!announcement?.id) throw new Error('No announcement ID');
			const response = await organizationadminannouncementsUpdateAnnouncement({
				path: { slug: organizationSlug, announcement_id: announcement.id },
				body: data,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw response.error;
			return response.data;
		},
		onSuccess: () => {
			toast.success(m['announcements.toast.updated']());
			queryClient.invalidateQueries({ queryKey: ['announcements', organizationSlug] });
			onSuccess();
		},
		onError: () => {
			toast.error(m['announcements.toast.error']());
		}
	}));

	// Send mutation
	const sendMut = createMutation(() => ({
		mutationFn: async (announcementId: string) => {
			const response = await organizationadminannouncementsSendAnnouncement({
				path: { slug: organizationSlug, announcement_id: announcementId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw response.error;
			return response.data;
		},
		onSuccess: () => {
			toast.success(m['announcements.toast.sent']());
			queryClient.invalidateQueries({ queryKey: ['announcements', organizationSlug] });
			onSuccess();
		},
		onError: () => {
			toast.error(m['announcements.toast.error']());
		}
	}));

	let isSaving = $derived(createMut.isPending || updateMut.isPending);
	let isSending = $derived(sendMut.isPending);

	// Validation
	function validate(): boolean {
		errors = {};

		if (!title.trim()) {
			errors.title = m['announcements.validation.titleRequired']();
			return false;
		}

		if (!body.trim()) {
			errors.body = m['announcements.validation.bodyRequired']();
			return false;
		}

		if (targetType === 'event' && !selectedEventId) {
			errors.target = m['announcements.validation.eventRequired']();
			return false;
		}

		if (targetType === 'tiers' && selectedTierIds.length === 0) {
			errors.target = m['announcements.validation.tiersRequired']();
			return false;
		}

		return true;
	}

	function getFormData() {
		return {
			title: title.trim(),
			body: body.trim(),
			event_id: targetType === 'event' ? selectedEventId : null,
			target_all_members: targetType === 'all_members',
			target_tier_ids: targetType === 'tiers' ? selectedTierIds : [],
			target_staff_only: targetType === 'staff_only',
			past_visibility: pastVisibility
		};
	}

	function handleSaveDraft() {
		if (!validate()) return;

		const data = getFormData();

		if (isEditing) {
			updateMut.mutate(data);
		} else {
			createMut.mutate(data);
		}
	}

	async function handleSend() {
		if (!validate()) return;

		const data = getFormData();

		if (isEditing) {
			// For existing announcements, update first then send
			updateMut.mutate(data, {
				onSuccess: (updatedAnnouncement) => {
					if (updatedAnnouncement?.id) {
						sendMut.mutate(updatedAnnouncement.id);
					}
				}
			});
		} else {
			// For new announcements, create first then send
			createMut.mutate(data, {
				onSuccess: (createdAnnouncement) => {
					if (createdAnnouncement?.id) {
						sendMut.mutate(createdAnnouncement.id);
					}
				}
			});
		}
	}

	function handleSubmit() {
		// Default form submit saves as draft
		handleSaveDraft();
	}

	function handleTargetChange(newTarget: TargetType) {
		targetType = newTarget;
		errors.target = undefined;
	}

	function toggleTier(tierId: string) {
		if (selectedTierIds.includes(tierId)) {
			selectedTierIds = selectedTierIds.filter((id) => id !== tierId);
		} else {
			selectedTierIds = [...selectedTierIds, tierId];
		}
	}

	// Target options
	const targetOptions: Array<{
		value: TargetType;
		label: string;
		description: string;
		icon: typeof Users;
		advanced?: boolean;
	}> = [
		{
			value: 'all_members',
			label: m['announcements.form.target.allMembers'](),
			description: m['announcements.form.target.allMembersDesc'](),
			icon: Users
		},
		{
			value: 'staff_only',
			label: m['announcements.form.target.staffOnly'](),
			description: m['announcements.form.target.staffOnlyDesc'](),
			icon: UserCog
		},
		{
			value: 'event',
			label: m['announcements.form.target.eventAttendees'](),
			description: m['announcements.form.target.eventAttendeesDesc'](),
			icon: Calendar
		},
		{
			value: 'tiers',
			label: m['announcements.form.target.specificTiers'](),
			description: m['announcements.form.target.specificTiersDesc'](),
			icon: Layers,
			advanced: true
		}
	];

	// Filter options based on advanced toggle
	let visibleOptions = $derived(
		showAdvanced ? targetOptions : targetOptions.filter((o) => !o.advanced)
	);
</script>

<Dialog
	{open}
	onOpenChange={(isOpen) => {
		if (!isOpen) onClose();
	}}
>
	<DialogContent class="max-h-[90vh] max-w-2xl overflow-y-auto">
		<DialogHeader>
			<DialogTitle>
				{isEditing ? m['announcements.edit']() : m['announcements.new']()}
			</DialogTitle>
		</DialogHeader>

		<form
			onsubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
			class="space-y-6 py-4"
		>
			<!-- Title -->
			<div class="space-y-2">
				<Label for="announcement-title">
					{m['announcements.form.title']()}
					<span class="text-destructive">*</span>
				</Label>
				<Input
					id="announcement-title"
					type="text"
					bind:value={title}
					placeholder={m['announcements.form.titlePlaceholder']()}
					disabled={isSaving}
					maxlength={150}
					aria-invalid={!!errors.title}
					aria-describedby={errors.title ? 'title-error' : undefined}
					class={errors.title ? 'border-destructive' : ''}
				/>
				{#if errors.title}
					<p id="title-error" class="text-sm text-destructive">
						{errors.title}
					</p>
				{/if}
			</div>

			<!-- Body -->
			<div class="space-y-2">
				<MarkdownEditor
					bind:value={body}
					label={m['announcements.form.body']()}
					placeholder={m['announcements.form.bodyPlaceholder']()}
					rows={8}
					disabled={isSaving}
					required
					error={errors.body}
				/>
			</div>

			<!-- Target Selection -->
			<div class="space-y-3">
				<Label>{m['announcements.form.target']()} <span class="text-destructive">*</span></Label>

				<div class="grid gap-2">
					{#each visibleOptions as option (option.value)}
						<button
							type="button"
							onclick={() => handleTargetChange(option.value)}
							class={cn(
								'flex items-start gap-3 rounded-lg border p-3 text-left transition-colors',
								targetType === option.value
									? 'border-primary bg-primary/5'
									: 'border-border hover:border-primary/50'
							)}
							disabled={isSaving}
						>
							<div
								class={cn(
									'flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
									targetType === option.value ? 'bg-primary text-primary-foreground' : 'bg-muted'
								)}
							>
								<option.icon class="h-4 w-4" />
							</div>
							<div class="flex-1">
								<div class="font-medium">{option.label}</div>
								<div class="text-sm text-muted-foreground">{option.description}</div>
							</div>
						</button>
					{/each}
				</div>

				<!-- Advanced targeting toggle -->
				{#if !showAdvanced && tiers.length > 0}
					<button
						type="button"
						onclick={() => (showAdvanced = true)}
						class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
					>
						<ChevronDown class="h-4 w-4" />
						{m['announcements.form.advancedTargeting']()}
					</button>
				{:else if showAdvanced}
					<button
						type="button"
						onclick={() => {
							showAdvanced = false;
							if (targetType === 'tiers') {
								targetType = 'all_members';
							}
						}}
						class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
					>
						<ChevronUp class="h-4 w-4" />
						{m['announcements.form.advancedTargeting']()}
					</button>
				{/if}

				<!-- Event selector -->
				{#if targetType === 'event'}
					<div class="ml-11 space-y-2">
						<Label for="event-select">{m['announcements.form.selectEvent']()}</Label>
						{#if eventsLoading}
							<div class="flex items-center gap-2 text-sm text-muted-foreground">
								<Loader2 class="h-4 w-4 animate-spin" />
								{m['announcements.form.loadingEvents']()}
							</div>
						{:else if events.length === 0}
							<div class="rounded-md border border-dashed p-4 text-center">
								<p class="text-sm font-medium text-muted-foreground">
									{m['announcements.form.noEvents']()}
								</p>
								<p class="mt-1 text-xs text-muted-foreground">
									{m['announcements.form.noEventsDescription']()}
								</p>
							</div>
						{:else}
							<select
								id="event-select"
								value={selectedEventId ?? ''}
								onchange={(e) => {
									const value = e.currentTarget.value;
									selectedEventId = value === '' ? null : value;
								}}
								class="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								disabled={isSaving}
							>
								<option value="">{m['announcements.form.selectEventPlaceholder']()}</option>
								{#each events as event (event.id)}
									<option value={event.id}>{event.name}</option>
								{/each}
							</select>
						{/if}
						<!-- Include past events checkbox -->
						<div class="flex items-center gap-2">
							<Checkbox
								id="include-past-events"
								checked={includePastEvents}
								onCheckedChange={(checked) => {
									if (onIncludePastChange) {
										onIncludePastChange(checked === true);
									}
								}}
								disabled={isSaving || eventsLoading}
							/>
							<Label for="include-past-events" class="cursor-pointer text-sm font-normal">
								{m['announcements.form.includePastEvents']()}
							</Label>
						</div>
					</div>
				{/if}

				<!-- Tier selector -->
				{#if targetType === 'tiers'}
					<div class="ml-11 space-y-2">
						<Label>{m['announcements.form.selectTiers']()}</Label>
						<div class="space-y-2 rounded-md border p-3">
							{#each tiers.filter((t) => t.id) as tier (tier.id)}
								<div class="flex items-center gap-2">
									<Checkbox
										id="tier-{tier.id}"
										checked={selectedTierIds.includes(tier.id!)}
										onCheckedChange={() => toggleTier(tier.id!)}
										disabled={isSaving}
									/>
									<Label for="tier-{tier.id}" class="cursor-pointer font-normal">
										{tier.name}
									</Label>
								</div>
							{:else}
								<p class="text-sm text-muted-foreground">
									{m['announcements.form.selectTiersPlaceholder']()}
								</p>
							{/each}
						</div>
					</div>
				{/if}

				{#if errors.target}
					<p class="text-sm text-destructive">{errors.target}</p>
				{/if}
			</div>

			<!-- Past Visibility -->
			<div class="flex items-start gap-3 rounded-lg border p-3">
				<Checkbox
					id="past-visibility"
					bind:checked={pastVisibility}
					disabled={isSaving}
					class="mt-0.5"
				/>
				<div class="flex-1">
					<Label for="past-visibility" class="cursor-pointer font-medium">
						{m['announcements.form.pastVisibility']()}
					</Label>
					<p class="text-sm text-muted-foreground">
						{m['announcements.form.pastVisibilityDesc']()}
					</p>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex justify-end gap-2 pt-4">
				<Button type="button" variant="outline" onclick={onClose} disabled={isSaving || isSending}>
					{m['announcements.cancel']()}
				</Button>
				<Button type="submit" variant="secondary" disabled={isSaving || isSending}>
					{#if isSaving}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					{isEditing ? m['announcements.updateDraft']() : m['announcements.saveDraft']()}
				</Button>
				<Button type="button" onclick={handleSend} disabled={isSaving || isSending}>
					{#if isSending}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
					{/if}
					{m['announcements.send']()}
				</Button>
			</div>
		</form>
	</DialogContent>
</Dialog>
