<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import {
		notificationpreferenceUpdatePreferences,
		notificationpreferenceUnsubscribe,
		telegramGetLinkStatus
	} from '$lib/api';
	import { untrack } from 'svelte';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Card from '$lib/components/ui/card';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { Input } from '$lib/components/ui/input';
	import { Separator } from '$lib/components/ui/separator';
	import { Loader2, Bell, BellOff, Mail, MessageSquare, Clock } from '@lucide/svelte';
	import NotificationTypeSettingsForm from './NotificationTypeSettings.svelte';
	import type {
		NotificationPreferenceSchema,
		NotificationTypeSettings,
		UpdateNotificationPreferenceSchema
	} from '$lib/api/generated/types.gen.js';
	import { backendMessage } from '$lib/utils/api-error-detail';

	// Extract a human-readable message from an unknown API error shape.
	// `backendMessage` probes detail (string OR the 422 list) → errors → message;
	// `String(error.detail)` used to render `[object Object]` on a 422.
	function extractErrorMessage(error: unknown): string {
		return backendMessage(error) ?? 'Failed to update preferences';
	}

	interface Props {
		preferences: NotificationPreferenceSchema | null;
		/** Unsubscribe mode passes the token the request was submitted with. */
		onSave?: (preferences?: NotificationPreferenceSchema, submittedToken?: string) => void;
		disabled?: boolean;
		authToken?: string;
		unsubscribeToken?: string; // Token for unsubscribe mode (unauthenticated)
		/** Unsubscribe mode: the backend rejected the link (expired, revoked, stale email). */
		onInvalidToken?: (submittedToken: string) => void;
	}

	const {
		preferences,
		onSave,
		disabled = false,
		authToken,
		unsubscribeToken,
		onInvalidToken
	}: Props = $props();

	// Determine if we're in unsubscribe mode
	const isUnsubscribeMode = $derived(!!unsubscribeToken);

	// The API returns digest_send_time as Django "HH:MM:SS"; the form, the
	// validation regex, and the payload all use "HH:MM" — normalise every read
	// of the preference or Save starts out disabled with "Invalid time format"
	// until the time is retyped (#889). Only well-formed values are truncated;
	// anything else passes through unchanged so validation still rejects it.
	function toHHMM(time: string): string {
		return /^\d{2}:\d{2}(:\d{2})?$/.test(time) ? time.slice(0, 5) : time;
	}

	const queryClient = useQueryClient();

	// Query for Telegram connection status (only in authenticated mode)
	const telegramStatusQuery = createQuery(() => ({
		queryKey: ['telegram', 'status'],
		queryFn: async () => {
			const result = await telegramGetLinkStatus({
				headers: { Authorization: `Bearer ${authToken}` }
			});
			return result.data;
		},
		enabled: !!authToken && !isUnsubscribeMode,
		staleTime: 5 * 60 * 1000, // Cache for 5 minutes
		retry: 1
	}));

	type Channel = 'in_app' | 'email' | 'telegram';
	interface Draft {
		silence: boolean;
		reminders: boolean;
		channels: Channel[];
		frequency: string;
		sendTime: string;
		typeSettings: Record<string, NotificationTypeSettings>;
	}

	function toDraft(prefs: NotificationPreferenceSchema | null): Draft {
		return {
			silence: prefs?.silence_all_notifications ?? false,
			reminders: prefs?.event_reminders_enabled ?? true,
			channels: prefs?.enabled_channels ?? ['in_app', 'email'],
			frequency: prefs?.digest_frequency ?? 'immediate',
			sendTime: toHHMM(prefs?.digest_send_time ?? '09:00'),
			typeSettings: prefs?.notification_type_settings ?? {}
		};
	}

	// The saved state the draft is diffed against. Seeded from the prop ONCE
	// (untrack: the form owns it from here); a caller that swaps in different
	// preferences remounts the form with {#key} instead of the old prop-sync
	// $effect (#985). A successful save moves the baseline to the server's
	// answer, so the next save diffs against what is actually stored.
	// $state.raw: the baseline is only ever replaced, never mutated in place.
	const initialDraft = toDraft(untrack(() => preferences));
	let baseline = $state.raw<Draft>(initialDraft);

	// Editable draft. Arrays/objects are copied so edits (the per-type settings
	// child mutates through its binding) can never leak into the baseline.
	let silenceAll = $state(initialDraft.silence);
	let eventReminders = $state(initialDraft.reminders);
	let enabledChannels = $state<Channel[]>([...initialDraft.channels]);
	let digestFrequency = $state<string>(initialDraft.frequency);
	let digestSendTime = $state<string>(initialDraft.sendTime);
	let notificationTypeSettings = $state<Record<string, NotificationTypeSettings>>(
		structuredClone(initialDraft.typeSettings)
	);

	// Serialised current draft: lets a save tell whether the user kept editing
	// while it was in flight.
	function draftSignature(): string {
		return JSON.stringify([
			silenceAll,
			eventReminders,
			enabledChannels,
			digestFrequency,
			digestSendTime,
			notificationTypeSettings
		]);
	}

	function loadDraft(draft: Draft) {
		silenceAll = draft.silence;
		eventReminders = draft.reminders;
		enabledChannels = [...draft.channels];
		digestFrequency = draft.frequency;
		digestSendTime = draft.sendTime;
		notificationTypeSettings = structuredClone(draft.typeSettings);
	}

	// Derived state
	const isFormDisabled = $derived(disabled || silenceAll);
	const showTimePicker = $derived(digestFrequency === 'daily' || digestFrequency === 'weekly');
	const isTelegramConnected = $derived(telegramStatusQuery.data?.connected ?? false);

	// Something to save iff the change-only payload is non-empty (authenticated
	// mode; unsubscribe mode always submits).
	const hasChanges = $derived(Object.keys(buildPayload()).length > 0);

	// Validation
	const validationError = $derived.by(() => {
		if (!silenceAll && enabledChannels.length === 0) {
			return m['notificationPreferences.selectAtLeastOneChannel']();
		}
		if (showTimePicker && !/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(digestSendTime)) {
			return m['notificationPreferences.invalidTimeFormat']();
		}
		return null;
	});

	// Statuses the unsubscribe endpoint uses for a link it won't honour: 400
	// (expired, malformed, or the account's email changed since it was issued),
	// 401 (revoked), 404 (account gone). The page swaps to its invalid-link state.
	const INVALID_TOKEN_STATUSES = new Set([400, 401, 404]);

	class InvalidUnsubscribeTokenError extends Error {}

	// Update preferences mutation
	const updateMutation = createMutation(() => ({
		// `token` is captured at submit time: the page can swap to another link
		// while this request is in flight, and must tell whose result this is.
		mutationFn: async ({
			payload,
			token
		}: {
			payload: UpdateNotificationPreferenceSchema;
			token?: string;
			/** draftSignature() at submit time */
			submittedDraft: string;
		}) => {
			// Use different endpoint based on mode
			if (token) {
				// Unsubscribe mode: use unsubscribe endpoint with token
				const response = await notificationpreferenceUnsubscribe({
					body: {
						token,
						preferences: payload
					}
				});

				if (response.error) {
					const message = extractErrorMessage(response.error);
					if (INVALID_TOKEN_STATUSES.has(response.response?.status ?? 0)) {
						throw new InvalidUnsubscribeTokenError(message);
					}
					throw new Error(message);
				}

				return response.data;
			} else {
				// Authenticated mode: use regular update endpoint
				const response = await notificationpreferenceUpdatePreferences({
					body: payload,
					headers: { Authorization: `Bearer ${authToken}` }
				});

				// Check for errors in response
				if (response.error) {
					throw new Error(extractErrorMessage(response.error));
				}

				return response.data;
			}
		},
		onSuccess: (data, { token, submittedDraft }) => {
			if (!isUnsubscribeMode) {
				baseline = toDraft(data as NotificationPreferenceSchema);
				// Adopt the server's normalised values only if the user didn't edit
				// while the request was in flight; otherwise keep their edits, which
				// now diff against the new baseline.
				if (draftSignature() === submittedDraft) loadDraft(baseline);
				queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
				// Unsubscribe mode skips the toast: its page swaps to a success
				// screen, and both at once doubled the announcement.
				toast.success(m['notificationPreferences.saveSuccess']());
			}
			onSave?.(data as NotificationPreferenceSchema, token);
		},
		onError: (error: Error, { token }) => {
			if (error instanceof InvalidUnsubscribeTokenError && onInvalidToken && token) {
				onInvalidToken(token);
				return;
			}
			toast.error(m['notificationPreferences.saveFailed']({ error: error.message }));
			console.error('Failed to update notification preferences:', error);
		}
	}));

	// Channel toggle handlers
	function toggleChannel(channel: Channel) {
		if (enabledChannels.includes(channel)) {
			enabledChannels = enabledChannels.filter((c) => c !== channel);
		} else {
			enabledChannels = [...enabledChannels, channel];
		}
	}

	function isChannelEnabled(channel: Channel): boolean {
		return enabledChannels.includes(channel);
	}

	// Build the request body. Only changed fields go out: re-sending
	// notification_type_settings unchanged re-pinned stale per-type channels and
	// kept email off after it was switched back on (#982). The unsubscribe
	// endpoint gets the global switches (silence + channels) always, since its
	// "reference" is a page default rather than the user's real settings, and
	// never per-type settings.
	function buildPayload(): UpdateNotificationPreferenceSchema {
		const payload: UpdateNotificationPreferenceSchema = {};
		const ref = baseline;
		const channelsChanged =
			JSON.stringify([...enabledChannels].sort()) !== JSON.stringify([...ref.channels].sort());

		if (isUnsubscribeMode || silenceAll !== ref.silence) {
			payload.silence_all_notifications = silenceAll;
		}
		if (isUnsubscribeMode || channelsChanged) {
			payload.enabled_channels = enabledChannels;
		}
		if (eventReminders !== ref.reminders) {
			payload.event_reminders_enabled = eventReminders;
		}
		if (isUnsubscribeMode) return payload;

		if (digestFrequency !== ref.frequency) {
			payload.digest_frequency = digestFrequency;
		}
		// The time only matters for daily/weekly; send it when it changed or when
		// switching into a schedule that uses it.
		if (showTimePicker && (digestSendTime !== ref.sendTime || digestFrequency !== ref.frequency)) {
			payload.digest_send_time = digestSendTime;
		}
		if (JSON.stringify(notificationTypeSettings) !== JSON.stringify(ref.typeSettings)) {
			payload.notification_type_settings = notificationTypeSettings;
		}
		return payload;
	}

	// Save handler
	function handleSave() {
		if (validationError) {
			toast.error(validationError);
			return;
		}

		updateMutation.mutate({
			payload: buildPayload(),
			token: isUnsubscribeMode ? unsubscribeToken : undefined,
			submittedDraft: draftSignature()
		});
	}

	// Reset handler: back to the last saved state
	function handleReset() {
		loadDraft(baseline);
	}
</script>

<div class="space-y-6">
	<!-- Master Controls Section -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				{#if silenceAll}
					<BellOff class="h-5 w-5" aria-hidden="true" />
				{:else}
					<Bell class="h-5 w-5" aria-hidden="true" />
				{/if}
				{m['notificationPreferences.masterControls']()}
			</Card.Title>
			<Card.Description>
				{m['accountSettingsPage.notificationsDescription']()}
			</Card.Description>
		</Card.Header>
		<Card.Content class="space-y-4">
			<!-- Silence All -->
			<div class="flex items-start justify-between space-x-4">
				<div class="flex-1 space-y-1">
					<Label for="silence-all" class="text-base font-medium"
						>{m['notificationPreferences.silenceAll']()}</Label
					>
					<p class="text-sm text-muted-foreground">
						{m['notificationPreferences.silenceAllDescription']()}
					</p>
				</div>
				<Checkbox
					id="silence-all"
					checked={silenceAll}
					onCheckedChange={(checked) => {
						silenceAll = checked === true;
					}}
					{disabled}
					aria-describedby="silence-all-description"
				/>
			</div>

			<Separator />

			<!-- Event Reminders -->
			<div class="flex items-start justify-between space-x-4">
				<div class="flex-1 space-y-1">
					<Label for="event-reminders" class="text-base font-medium"
						>{m['notificationPreferences.eventReminders']()}</Label
					>
					<p class="text-sm text-muted-foreground">
						{m['notificationPreferences.eventRemindersDescription']()}
					</p>
				</div>
				<Checkbox
					id="event-reminders"
					checked={eventReminders}
					onCheckedChange={(checked) => {
						eventReminders = checked === true;
					}}
					disabled={isFormDisabled}
					aria-describedby="event-reminders-description"
				/>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Notification Channels Section -->
	<Card.Root>
		<Card.Header>
			<Card.Title class="flex items-center gap-2">
				<MessageSquare class="h-5 w-5" aria-hidden="true" />
				{m['notificationPreferences.notificationChannels']()}
			</Card.Title>
			<Card.Description>{m['accountSettingsPage.notificationsDescription']()}</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="space-y-4">
				<!-- In-App Channel -->
				<div class="flex items-start justify-between space-x-4">
					<div class="flex items-start gap-3">
						<Bell
							class="mt-1 h-5 w-5 {isChannelEnabled('in_app')
								? 'text-primary'
								: 'text-muted-foreground'}"
							aria-hidden="true"
						/>
						<div class="space-y-1">
							<Label for="channel-in-app" class="text-base font-medium"
								>{m['notificationPreferences.channelInApp']()}</Label
							>
							<p class="text-sm text-muted-foreground">
								{m['notificationPreferences.channelInAppDescription']()}
							</p>
						</div>
					</div>
					<Checkbox
						id="channel-in-app"
						checked={isChannelEnabled('in_app')}
						onCheckedChange={() => toggleChannel('in_app')}
						disabled={isFormDisabled}
						aria-label={m['notificationPreferences.channelInApp']()}
					/>
				</div>

				<Separator />

				<!-- Email Channel -->
				<div class="flex items-start justify-between space-x-4">
					<div class="flex items-start gap-3">
						<Mail
							class="mt-1 h-5 w-5 {isChannelEnabled('email')
								? 'text-primary'
								: 'text-muted-foreground'}"
							aria-hidden="true"
						/>
						<div class="space-y-1">
							<Label for="channel-email" class="text-base font-medium"
								>{m['notificationPreferences.channelEmail']()}</Label
							>
							<p class="text-sm text-muted-foreground">
								{m['notificationPreferences.channelEmailDescription']()}
							</p>
						</div>
					</div>
					<Checkbox
						id="channel-email"
						checked={isChannelEnabled('email')}
						onCheckedChange={() => toggleChannel('email')}
						disabled={isFormDisabled}
						aria-label={m['notificationPreferences.channelEmail']()}
					/>
				</div>

				<Separator />

				<!-- Telegram Channel -->
				<div class="flex items-start justify-between space-x-4">
					<div class="flex flex-1 items-start gap-3">
						<MessageSquare
							class="mt-1 h-5 w-5 {isChannelEnabled('telegram')
								? 'text-primary'
								: 'text-muted-foreground'}"
							aria-hidden="true"
						/>
						<div class="flex-1 space-y-1">
							<Label for="channel-telegram" class="text-base font-medium"
								>{m['notificationPreferences.channelTelegram']()}</Label
							>
							<p class="text-sm text-muted-foreground">
								{m['notificationPreferences.channelTelegramDescription']()}
							</p>
							{#if !isUnsubscribeMode && !isTelegramConnected}
								<div class="mt-2 rounded-md bg-muted p-2">
									<p class="text-xs text-muted-foreground">
										{m['notificationPreferences.telegramNotConnected']()}
										<a
											href={resolve('/(auth)/account/profile', {})}
											class="font-medium text-primary underline-offset-4 hover:underline"
										>
											{m['notificationPreferences.connectTelegram']()}
										</a>
									</p>
								</div>
							{/if}
						</div>
					</div>
					<Checkbox
						id="channel-telegram"
						checked={isChannelEnabled('telegram')}
						onCheckedChange={() => toggleChannel('telegram')}
						disabled={isFormDisabled || (!isUnsubscribeMode && !isTelegramConnected)}
						aria-label={m['notificationPreferences.channelTelegram']()}
						aria-describedby={!isUnsubscribeMode && !isTelegramConnected
							? 'telegram-not-connected'
							: undefined}
					/>
				</div>

				{#if validationError && !silenceAll && enabledChannels.length === 0}
					<p class="text-sm text-destructive" role="alert">
						{validationError}
					</p>
				{/if}
			</div>
		</Card.Content>
	</Card.Root>

	{#if !isUnsubscribeMode}
		<!-- Digest Settings Section -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Clock class="h-5 w-5" aria-hidden="true" />
					{m['notificationPreferences.digestSettings']()}
				</Card.Title>
				<Card.Description
					>{m['notificationPreferences.digestFrequencyDescription']()}</Card.Description
				>
			</Card.Header>
			<Card.Content class="space-y-4">
				<!-- Digest Frequency -->
				<div class="space-y-3">
					<Label>{m['notificationPreferences.digestFrequency']()}</Label>
					<RadioGroup.Root
						value={digestFrequency}
						onValueChange={(value) => {
							if (value) {
								digestFrequency = value;
							}
						}}
						disabled={isFormDisabled}
					>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="immediate" id="freq-immediate" />
							<Label for="freq-immediate" class="font-normal"
								>{m['notificationPreferences.digestFrequencyImmediate']()}</Label
							>
						</div>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="hourly" id="freq-hourly" />
							<Label for="freq-hourly" class="font-normal"
								>{m['notificationPreferences.digestFrequencyHourly']()}</Label
							>
						</div>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="daily" id="freq-daily" />
							<Label for="freq-daily" class="font-normal"
								>{m['notificationPreferences.digestFrequencyDaily']()}</Label
							>
						</div>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="weekly" id="freq-weekly" />
							<Label for="freq-weekly" class="font-normal"
								>{m['notificationPreferences.digestFrequencyWeekly']()}</Label
							>
						</div>
					</RadioGroup.Root>
					<p class="text-xs text-muted-foreground">
						{m['notificationPreferences.digestFrequencyDescription']()}
					</p>
				</div>

				<!-- Digest Send Time (only for daily/weekly) -->
				{#if showTimePicker}
					<div class="space-y-2">
						<Label for="digest-time">{m['notificationPreferences.sendTime']()}</Label>
						<Input
							id="digest-time"
							type="time"
							bind:value={digestSendTime}
							disabled={isFormDisabled}
							placeholder="09:00"
							class="w-full"
							aria-describedby="digest-time-help"
						/>
						<p id="digest-time-help" class="text-xs text-muted-foreground">
							{m['notificationPreferences.sendTimeDescription']()}
						</p>
						{#if validationError && validationError.includes('time')}
							<p class="text-sm text-destructive" role="alert">
								{validationError}
							</p>
						{/if}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<!-- Advanced Settings Section (Collapsible) -->
		<NotificationTypeSettingsForm
			bind:notificationTypeSettings
			{enabledChannels}
			{isFormDisabled}
			{isTelegramConnected}
			{authToken}
		/>
	{/if}

	<!-- Action Buttons -->
	<div class="flex flex-col gap-3 sm:flex-row sm:justify-end">
		<Button
			type="button"
			variant="outline"
			onclick={handleReset}
			disabled={(!hasChanges && !isUnsubscribeMode) || disabled || updateMutation.isPending}
			class="w-full sm:w-auto"
		>
			{m['notificationPreferences.cancel']()}
		</Button>
		<Button
			type="button"
			onclick={handleSave}
			disabled={(!hasChanges && !isUnsubscribeMode) ||
				disabled ||
				updateMutation.isPending ||
				!!validationError}
			class="w-full sm:w-auto"
		>
			{#if updateMutation.isPending}
				<Loader2 class="animate-spin" aria-hidden="true" />
				{m['notificationPreferences.saving']()}
			{:else}
				{m['notificationPreferences.saveChanges']()}
			{/if}
		</Button>
	</div>
</div>
