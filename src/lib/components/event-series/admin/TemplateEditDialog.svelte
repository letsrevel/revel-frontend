<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { Dialog, DialogContent, DialogHeader, DialogTitle } from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import { AlertTriangle, FileText, Loader2 } from 'lucide-svelte';
	import { toast } from 'svelte-sonner';
	import {
		eventpublicdetailsGetEvent,
		organizationadminrecurringeventsUpdateTemplate
	} from '$lib/api/generated/sdk.gen';
	import type {
		EventDetailSchema,
		EventSeriesRecurrenceDetailSchema,
		EventType,
		PropagateScope,
		ResourceVisibility,
		TemplateEditSchema,
		Visibility
	} from '$lib/api/generated/types.gen';
	import { invalidateSeries } from '$lib/queries/event-series';
	import { formatEventDate } from '$lib/utils/date';
	import TemplateLockedFields from './TemplateLockedFields.svelte';

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

	const templateId = $derived(series.template_event?.id ?? null);

	// Narrow flow: form → propagation picker. Submit fires from the picker.
	type Step = 'form' | 'propagate';
	let step = $state<Step>('form');
	let propagateScope = $state<PropagateScope>('future_unmodified');

	// Editable form state. Initial values get seeded from the full event once
	// the lazy query resolves (see the effect below).
	let name = $state<string>('');
	let description = $state<string>('');
	let invitationMessage = $state<string>('');
	let eventType = $state<EventType>('public');
	let visibility = $state<Visibility>('public');
	let address = $state<string>('');
	let addressVisibility = $state<ResourceVisibility>('public');
	let maxAttendees = $state<string>('');
	let maxTicketsPerUser = $state<string>('');
	// Grouped boolean flags. A single reactive object lets us drive the toggle
	// rows off a small config array below rather than duplicating identical
	// markup per field.
	const flags = $state<{
		requires_ticket: boolean;
		waitlist_open: boolean;
		requires_full_profile: boolean;
		potluck_open: boolean;
		accept_invitation_requests: boolean;
		public_pronoun_distribution: boolean;
		can_attend_without_login: boolean;
	}>({
		requires_ticket: false,
		waitlist_open: false,
		requires_full_profile: false,
		potluck_open: false,
		accept_invitation_requests: false,
		public_pronoun_distribution: false,
		can_attend_without_login: false
	});
	type FlagKey = keyof typeof flags;

	// Original snapshot for dirty-tracking. The backend rejects unknown fields
	// (`additionalProperties=false`) — sending only changed fields is the
	// cheapest way to respect that contract.
	let original = $state<EventDetailSchema | null>(null);

	let errorBanner = $state<string | null>(null);

	// Lazy fetch: only runs while the dialog is open and the series has a
	// template_event. MinimalEventSchema on the admin detail only carries
	// id/name/start/end; the TemplateEditSchema surface needs visibility,
	// capacity, toggles, etc., which only EventDetailSchema provides.
	const templateQuery = createQuery<EventDetailSchema>(() => ({
		queryKey: ['event-detail', templateId],
		queryFn: async () => {
			if (!templateId) throw new Error('No template event on this series');
			const response = await eventpublicdetailsGetEvent({
				path: { event_id: templateId },
				headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
			});
			if (response.error || !response.data) throw new Error('Failed to load template');
			return response.data;
		},
		enabled: open && !!templateId
	}));

	// Seed form state the first time the template loads (or when the template
	// id changes under a re-open). We never overwrite in-flight edits — the
	// guard keys off the id to avoid clobbering the user's typing if the query
	// refetches on background invalidation.
	$effect(() => {
		if (!open) return;
		const t = templateQuery.data;
		if (!t) return;
		if (original?.id === t.id) return;
		name = t.name;
		description = t.description ?? '';
		invitationMessage = t.invitation_message ?? '';
		eventType = t.event_type;
		visibility = t.visibility;
		address = t.address ?? '';
		addressVisibility = t.address_visibility ?? 'public';
		maxAttendees = typeof t.max_attendees === 'number' ? String(t.max_attendees) : '';
		maxTicketsPerUser =
			typeof t.max_tickets_per_user === 'number' ? String(t.max_tickets_per_user) : '';
		flags.requires_ticket = !!t.requires_ticket;
		flags.waitlist_open = !!t.waitlist_open;
		flags.requires_full_profile = !!t.requires_full_profile;
		flags.potluck_open = !!t.potluck_open;
		flags.accept_invitation_requests = !!t.accept_invitation_requests;
		flags.public_pronoun_distribution = !!t.public_pronoun_distribution;
		flags.can_attend_without_login = !!t.can_attend_without_login;
		original = t;
	});

	// Reset step + snapshot when the dialog closes. Re-opening re-fetches and
	// re-seeds so stale edits never leak between opens.
	$effect(() => {
		if (open) return;
		step = 'form';
		propagateScope = 'future_unmodified';
		original = null;
		errorBanner = null;
	});

	// Derived dirty-tracking. Only changed fields are included in the payload —
	// respects `additionalProperties=false` and keeps propagation traffic
	// scoped to what actually changed.
	const diff = $derived.by<TemplateEditSchema>(() => {
		const d: TemplateEditSchema = {};
		if (!original) return d;
		const descriptionVal = description.trim() || null;
		const invitationVal = invitationMessage.trim() || null;
		const addressVal = address.trim() || null;
		const maxAttendeesNum = maxAttendees.trim() === '' ? null : Number(maxAttendees);
		const maxTicketsNum = maxTicketsPerUser.trim() === '' ? null : Number(maxTicketsPerUser);

		if (name.trim() !== original.name) d.name = name.trim();
		if (descriptionVal !== (original.description ?? null)) d.description = descriptionVal;
		if (invitationVal !== (original.invitation_message ?? null))
			d.invitation_message = invitationVal;
		if (eventType !== original.event_type) d.event_type = eventType;
		if (visibility !== original.visibility) d.visibility = visibility;
		if (addressVal !== (original.address ?? null)) d.address = addressVal;
		if (addressVisibility !== (original.address_visibility ?? 'public'))
			d.address_visibility = addressVisibility;

		const origMax = typeof original.max_attendees === 'number' ? original.max_attendees : null;
		if (maxAttendeesNum !== origMax) d.max_attendees = maxAttendeesNum;
		const origMaxT =
			typeof original.max_tickets_per_user === 'number' ? original.max_tickets_per_user : null;
		if (maxTicketsNum !== origMaxT) d.max_tickets_per_user = maxTicketsNum;

		if (flags.requires_ticket !== !!original.requires_ticket)
			d.requires_ticket = flags.requires_ticket;
		if (flags.waitlist_open !== !!original.waitlist_open) d.waitlist_open = flags.waitlist_open;
		if (flags.requires_full_profile !== !!original.requires_full_profile)
			d.requires_full_profile = flags.requires_full_profile;
		if (flags.potluck_open !== !!original.potluck_open) d.potluck_open = flags.potluck_open;
		if (flags.accept_invitation_requests !== !!original.accept_invitation_requests)
			d.accept_invitation_requests = flags.accept_invitation_requests;
		if (flags.public_pronoun_distribution !== !!original.public_pronoun_distribution)
			d.public_pronoun_distribution = flags.public_pronoun_distribution;
		if (flags.can_attend_without_login !== !!original.can_attend_without_login)
			d.can_attend_without_login = flags.can_attend_without_login;

		return d;
	});

	// Config-driven toggle rows — replaces the near-identical markup blocks
	// that otherwise ran up against the file-length gate. Each entry pairs a
	// form field with the i18n key of its label and its Playwright testid.
	const capacityToggles: { key: FlagKey; label: string; testid: string }[] = [
		{
			key: 'requires_ticket',
			label: m['recurringEvents.templateDialog.toggles.requiresTicket'](),
			testid: 'template-edit-requires-ticket'
		},
		{
			key: 'waitlist_open',
			label: m['recurringEvents.templateDialog.toggles.waitlistOpen'](),
			testid: 'template-edit-waitlist-open'
		}
	];
	type PropagateOption = {
		scope: PropagateScope;
		title: string;
		body: string;
		testid: string;
		destructive: boolean;
		recommended: boolean;
	};
	const propagateOptions: PropagateOption[] = [
		{
			scope: 'none',
			title: m['recurringEvents.templateDialog.propagate.none.title'](),
			body: m['recurringEvents.templateDialog.propagate.none.body'](),
			testid: 'template-edit-propagate-none',
			destructive: false,
			recommended: false
		},
		{
			scope: 'future_unmodified',
			title: m['recurringEvents.templateDialog.propagate.futureUnmodified.title'](),
			body: m['recurringEvents.templateDialog.propagate.futureUnmodified.body'](),
			testid: 'template-edit-propagate-future-unmodified',
			destructive: false,
			recommended: true
		},
		{
			scope: 'all_future',
			title: m['recurringEvents.templateDialog.propagate.allFuture.title'](),
			body: m['recurringEvents.templateDialog.propagate.allFuture.body'](),
			testid: 'template-edit-propagate-all-future',
			destructive: true,
			recommended: false
		}
	];

	const attendanceToggles: { key: FlagKey; label: string; testid: string }[] = [
		{
			key: 'requires_full_profile',
			label: m['recurringEvents.templateDialog.toggles.requiresFullProfile'](),
			testid: 'template-edit-requires-full-profile'
		},
		{
			key: 'potluck_open',
			label: m['recurringEvents.templateDialog.toggles.potluckOpen'](),
			testid: 'template-edit-potluck-open'
		},
		{
			key: 'accept_invitation_requests',
			label: m['recurringEvents.templateDialog.toggles.acceptInvitationRequests'](),
			testid: 'template-edit-accept-invitation-requests'
		},
		{
			key: 'public_pronoun_distribution',
			label: m['recurringEvents.templateDialog.toggles.publicPronounDistribution'](),
			testid: 'template-edit-public-pronoun-distribution'
		},
		{
			key: 'can_attend_without_login',
			label: m['recurringEvents.templateDialog.toggles.canAttendWithoutLogin'](),
			testid: 'template-edit-can-attend-without-login'
		}
	];

	const hasChanges = $derived(Object.keys(diff).length > 0);

	// --- Mutation ---

	const updateMutation = createMutation(() => ({
		mutationFn: async () => {
			if (!accessToken) throw new Error('Not authenticated');
			const response = await organizationadminrecurringeventsUpdateTemplate({
				path: { slug: organizationSlug, series_id: series.id },
				query: { propagate: propagateScope },
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
			if (templateId) {
				await queryClient.invalidateQueries({ queryKey: ['event-detail', templateId] });
			}
			toast.success(m['recurringEvents.templateDialog.savedToast']());
			onClose();
		},
		onError: (err: Error) => {
			errorBanner = err.message || m['recurringEvents.templateDialog.errorToast']();
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
		return m['recurringEvents.templateDialog.errorToast']();
	}

	// --- Handlers ---

	function handleContinue(): void {
		errorBanner = null;
		if (!hasChanges) {
			toast.info(m['recurringEvents.templateDialog.noChangesToast']());
			return;
		}
		step = 'propagate';
	}

	function handleBackToForm(): void {
		step = 'form';
	}

	function handleApply(): void {
		errorBanner = null;
		updateMutation.mutate();
	}

	function handleClose(): void {
		if (updateMutation.isPending) return;
		onClose();
	}

	// --- Derived display strings ---

	const startDisplay = $derived(original ? formatEventDate(original.start) : '—');
	const endDisplay = $derived(original ? formatEventDate(original.end) : '—');
	const rsvpBeforeDisplay = $derived(
		original?.rsvp_before ? formatEventDate(original.rsvp_before) : '—'
	);
	const applyBeforeDisplay = $derived(
		original?.apply_before ? formatEventDate(original.apply_before) : '—'
	);
	const isLoading = $derived(open && !!templateId && !original && templateQuery.isLoading);
	const loadFailed = $derived(
		open && !!templateId && !original && !templateQuery.isLoading && templateQuery.isError
	);
	const dialogTitle = $derived(
		step === 'propagate'
			? m['recurringEvents.templateDialog.propagate.heading']()
			: m['recurringEvents.templateDialog.title']()
	);
</script>

{#snippet toggleRow(t: { key: FlagKey; label: string; testid: string })}
	<label
		class="flex cursor-pointer items-center gap-3 rounded-md border border-input p-3 transition-colors hover:bg-accent"
	>
		<input
			type="checkbox"
			bind:checked={flags[t.key]}
			disabled={updateMutation.isPending}
			class="h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-ring"
			data-testid={t.testid}
		/>
		<div class="flex-1 text-sm font-medium">{t.label}</div>
	</label>
{/snippet}

{#snippet propagateCard(opt: PropagateOption)}
	{@const selected = propagateScope === opt.scope}
	<label
		class="flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors {opt.destructive
			? 'hover:bg-destructive/5'
			: 'hover:bg-accent'} {selected
			? opt.destructive
				? 'border-destructive ring-2 ring-destructive ring-offset-2'
				: 'border-primary ring-2 ring-ring ring-offset-2'
			: opt.destructive
				? 'border-destructive/40'
				: 'border-input'}"
	>
		<input
			type="radio"
			name="propagate-scope"
			value={opt.scope}
			bind:group={propagateScope}
			disabled={updateMutation.isPending}
			class="mt-1 h-4 w-4 {opt.destructive
				? 'text-destructive focus:ring-destructive'
				: 'text-primary focus:ring-ring'} focus:ring-2"
			data-testid={opt.testid}
		/>
		<div class="flex-1 space-y-1">
			<div
				class="flex items-center gap-2 text-sm font-medium {opt.destructive
					? 'text-destructive'
					: ''}"
			>
				{#if opt.destructive}
					<AlertTriangle class="h-4 w-4" aria-hidden="true" />
				{/if}
				{opt.title}
				{#if opt.recommended}
					<span
						class="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary"
					>
						{m['recurringEvents.templateDialog.propagate.futureUnmodified.recommendedBadge']()}
					</span>
				{/if}
			</div>
			<p class="text-xs text-muted-foreground">{opt.body}</p>
		</div>
	</label>
{/snippet}

{#snippet errorBox()}
	{#if errorBanner}
		<div
			class="mt-4 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
			role="alert"
			data-testid="template-edit-error"
		>
			{errorBanner}
		</div>
	{/if}
{/snippet}

<Dialog bind:open onOpenChange={(isOpen) => !isOpen && handleClose()}>
	<DialogContent class="max-h-[90vh] max-w-2xl overflow-y-auto" data-testid="template-edit-dialog">
		<DialogHeader>
			<DialogTitle class="flex items-center gap-2">
				<FileText class="h-5 w-5" aria-hidden="true" />
				{dialogTitle}
			</DialogTitle>
		</DialogHeader>

		{#if isLoading}
			<div
				class="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground"
				data-testid="template-edit-loading"
			>
				<Loader2 class="h-4 w-4 animate-spin" aria-hidden="true" />
				{m['recurringEvents.templateDialog.loading']()}
			</div>
		{:else if loadFailed}
			<div
				class="mt-4 flex items-start gap-3 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive"
				role="alert"
				data-testid="template-edit-load-error"
			>
				<AlertTriangle class="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
				<p>{m['recurringEvents.templateDialog.loadError']()}</p>
			</div>
			<div class="mt-4 flex justify-end">
				<Button type="button" variant="outline" onclick={handleClose}>
					{m['recurringEvents.templateDialog.buttons.cancel']()}
				</Button>
			</div>
		{:else if original}
			{#if step === 'form'}
				<p class="mt-2 text-sm text-muted-foreground">
					{m['recurringEvents.templateDialog.description']()}
				</p>

				<div class="mt-6 space-y-8">
					<!-- Details -->
					<section class="space-y-4">
						<h3 class="text-sm font-semibold">
							{m['recurringEvents.templateDialog.sections.details']()}
						</h3>
						<div class="space-y-2">
							<Label for="template-name">
								{m['recurringEvents.templateDialog.fields.nameLabel']()}
							</Label>
							<Input
								id="template-name"
								type="text"
								bind:value={name}
								placeholder={m['recurringEvents.templateDialog.fields.namePlaceholder']()}
								maxlength={150}
								disabled={updateMutation.isPending}
								data-testid="template-edit-name"
							/>
						</div>
						<div class="space-y-2">
							<Label for="template-description">
								{m['recurringEvents.templateDialog.fields.descriptionLabel']()}
							</Label>
							<Textarea
								id="template-description"
								bind:value={description}
								placeholder={m['recurringEvents.templateDialog.fields.descriptionPlaceholder']()}
								rows={4}
								disabled={updateMutation.isPending}
								data-testid="template-edit-description"
							/>
						</div>
						<div class="space-y-2">
							<Label for="template-invitation-message">
								{m['recurringEvents.templateDialog.fields.invitationMessageLabel']()}
							</Label>
							<Textarea
								id="template-invitation-message"
								bind:value={invitationMessage}
								placeholder={m[
									'recurringEvents.templateDialog.fields.invitationMessagePlaceholder'
								]()}
								rows={3}
								disabled={updateMutation.isPending}
								data-testid="template-edit-invitation-message"
							/>
						</div>
					</section>

					<!-- Visibility & access -->
					<section class="space-y-4 border-t border-border pt-6">
						<h3 class="text-sm font-semibold">
							{m['recurringEvents.templateDialog.sections.visibility']()}
						</h3>
						<div class="space-y-2">
							<Label for="template-visibility">
								{m['recurringEvents.templateDialog.fields.visibilityLabel']()}
							</Label>
							<select
								id="template-visibility"
								bind:value={visibility}
								disabled={updateMutation.isPending}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								data-testid="template-edit-visibility"
							>
								<option value="public">{m['SFwESEssentialsStep.public']()}</option>
								<option value="unlisted">{m['SFwESEssentialsStep.unlisted']()}</option>
								<option value="private">{m['SFwESEssentialsStep.private']()}</option>
								<option value="members-only">{m['SFwESEssentialsStep.membersOnly']()}</option>
								<option value="staff-only">{m['SFwESEssentialsStep.staffOnly']()}</option>
							</select>
						</div>
						<div class="space-y-2">
							<Label for="template-event-type">
								{m['recurringEvents.templateDialog.fields.eventTypeLabel']()}
							</Label>
							<select
								id="template-event-type"
								bind:value={eventType}
								disabled={updateMutation.isPending}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								data-testid="template-edit-event-type"
							>
								<option value="public">{m['SFwESEssentialsStep.everyoneCanAttend']()}</option>
								<option value="private">{m['SFwESEssentialsStep.onlyInvitedPeople']()}</option>
								<option value="members-only"
									>{m['SFwESEssentialsStep.onlyOrganizationMembers']()}</option
								>
							</select>
						</div>
					</section>

					<!-- Location -->
					<section class="space-y-4 border-t border-border pt-6">
						<h3 class="text-sm font-semibold">
							{m['recurringEvents.templateDialog.sections.location']()}
						</h3>
						<div class="space-y-2">
							<Label for="template-address">
								{m['recurringEvents.templateDialog.fields.addressLabel']()}
							</Label>
							<Input
								id="template-address"
								type="text"
								bind:value={address}
								placeholder={m['recurringEvents.templateDialog.fields.addressPlaceholder']()}
								disabled={updateMutation.isPending}
								data-testid="template-edit-address"
							/>
							<p class="text-xs text-muted-foreground">
								{m['recurringEvents.templateDialog.fields.addressHelper']()}
							</p>
						</div>
						<div class="space-y-2">
							<Label for="template-address-visibility">
								{m['recurringEvents.templateDialog.fields.addressVisibilityLabel']()}
							</Label>
							<select
								id="template-address-visibility"
								bind:value={addressVisibility}
								disabled={updateMutation.isPending}
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								data-testid="template-edit-address-visibility"
							>
								<option value="public">{m['detailsStep.addressVisibilityPublic']()}</option>
								<option value="unlisted">{m['SFwESEssentialsStep.unlisted']()}</option>
								<option value="members-only"
									>{m['detailsStep.addressVisibilityMembersOnly']()}</option
								>
								<option value="attendees-only"
									>{m['detailsStep.addressVisibilityAttendeesOnly']()}</option
								>
								<option value="private">{m['detailsStep.addressVisibilityPrivate']()}</option>
								<option value="staff-only">{m['SFwESEssentialsStep.staffOnly']()}</option>
							</select>
						</div>
					</section>

					<!-- Capacity & tickets -->
					<section class="space-y-4 border-t border-border pt-6">
						<h3 class="text-sm font-semibold">
							{m['recurringEvents.templateDialog.sections.capacity']()}
						</h3>
						<div class="space-y-2">
							<Label for="template-max-attendees">
								{m['recurringEvents.templateDialog.fields.maxAttendeesLabel']()}
							</Label>
							<Input
								id="template-max-attendees"
								type="number"
								min="0"
								bind:value={maxAttendees}
								disabled={updateMutation.isPending}
								data-testid="template-edit-max-attendees"
							/>
							<p class="text-xs text-muted-foreground">
								{m['recurringEvents.templateDialog.fields.maxAttendeesHelper']()}
							</p>
						</div>
						<div class="space-y-2">
							<Label for="template-max-tickets-per-user">
								{m['recurringEvents.templateDialog.fields.maxTicketsPerUserLabel']()}
							</Label>
							<Input
								id="template-max-tickets-per-user"
								type="number"
								min="0"
								bind:value={maxTicketsPerUser}
								disabled={updateMutation.isPending}
								data-testid="template-edit-max-tickets-per-user"
							/>
							<p class="text-xs text-muted-foreground">
								{m['recurringEvents.templateDialog.fields.maxTicketsPerUserHelper']()}
							</p>
						</div>
						{#each capacityToggles as t (t.key)}
							{@render toggleRow(t)}
						{/each}
					</section>

					<!-- Attendance -->
					<section class="space-y-4 border-t border-border pt-6">
						<h3 class="text-sm font-semibold">
							{m['recurringEvents.templateDialog.sections.attendance']()}
						</h3>
						{#each attendanceToggles as t (t.key)}
							{@render toggleRow(t)}
						{/each}
					</section>

					<TemplateLockedFields
						{startDisplay}
						{endDisplay}
						{rsvpBeforeDisplay}
						{applyBeforeDisplay}
					/>
				</div>

				{@render errorBox()}

				<div
					class="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end"
				>
					<Button
						type="button"
						variant="outline"
						onclick={handleClose}
						disabled={updateMutation.isPending}
						data-testid="template-edit-cancel"
					>
						{m['recurringEvents.templateDialog.buttons.cancel']()}
					</Button>
					<Button
						type="button"
						onclick={handleContinue}
						disabled={!hasChanges || updateMutation.isPending}
						data-testid="template-edit-continue"
					>
						{m['recurringEvents.templateDialog.buttons.continueToPropagate']()}
					</Button>
				</div>
			{:else}
				<!-- Step 2: Propagation picker -->
				<p class="mt-2 text-sm text-muted-foreground">
					{m['recurringEvents.templateDialog.propagate.heading']()}
				</p>

				<div
					class="mt-6 space-y-3"
					role="radiogroup"
					aria-label={m['recurringEvents.templateDialog.propagate.heading']()}
				>
					{#each propagateOptions as opt (opt.scope)}
						{@render propagateCard(opt)}
					{/each}
				</div>

				{@render errorBox()}

				<div
					class="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end"
				>
					<Button
						type="button"
						variant="outline"
						onclick={handleBackToForm}
						disabled={updateMutation.isPending}
						data-testid="template-edit-back"
					>
						{m['recurringEvents.templateDialog.buttons.backToForm']()}
					</Button>
					<Button
						type="button"
						variant={propagateScope === 'all_future' ? 'destructive' : 'default'}
						onclick={handleApply}
						disabled={updateMutation.isPending}
						data-testid="template-edit-apply"
					>
						{#if updateMutation.isPending}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
							{m['recurringEvents.templateDialog.buttons.applying']()}
						{:else}
							{m['recurringEvents.templateDialog.buttons.apply']()}
						{/if}
					</Button>
				</div>
			{/if}
		{/if}
	</DialogContent>
</Dialog>
