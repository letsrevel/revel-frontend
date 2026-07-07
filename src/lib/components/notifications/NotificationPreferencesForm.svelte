<script lang="ts">
	import { resolve } from '$app/paths';
	import * as m from '$lib/paraglide/messages.js';
	import {
		notificationpreferenceUpdatePreferences,
		notificationpreferenceUnsubscribe,
		telegramGetLinkStatus
	} from '$lib/api';
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

	// Extract a human-readable message from an unknown API error shape
	function extractErrorMessage(error: unknown): string {
		if (error && typeof error === 'object') {
			if ('detail' in error && error.detail) return String(error.detail);
			if ('message' in error && error.message) return String(error.message);
		}
		return 'Failed to update preferences';
	}

	interface Props {
		preferences: NotificationPreferenceSchema | null;
		onSave?: (preferences?: NotificationPreferenceSchema) => void;
		disabled?: boolean;
		authToken?: string;
		unsubscribeToken?: string; // Token for unsubscribe mode (unauthenticated)
	}

	const { preferences, onSave, disabled = false, authToken, unsubscribeToken }: Props = $props();

	// Determine if we're in unsubscribe mode
	const isUnsubscribeMode = $derived(!!unsubscribeToken);

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

	// Local state - initialize from preferences prop
	let silenceAll = $state(preferences?.silence_all_notifications ?? false);
	let eventReminders = $state(preferences?.event_reminders_enabled ?? true);
	let enabledChannels = $state<Array<'in_app' | 'email' | 'telegram'>>(
		preferences?.enabled_channels ?? ['in_app', 'email']
	);
	let digestFrequency = $state<string>(preferences?.digest_frequency ?? 'immediate');
	let digestSendTime = $state<string>(preferences?.digest_send_time ?? '09:00');
	let notificationTypeSettings = $state<Record<string, NotificationTypeSettings>>(
		preferences?.notification_type_settings ?? {}
	);

	// Sync local state when preferences prop changes
	$effect(() => {
		if (preferences) {
			silenceAll = preferences.silence_all_notifications ?? false;
			eventReminders = preferences.event_reminders_enabled ?? true;
			enabledChannels = preferences.enabled_channels ?? ['in_app', 'email'];
			digestFrequency = preferences.digest_frequency ?? 'immediate';
			digestSendTime = preferences.digest_send_time ?? '09:00';
			notificationTypeSettings = preferences.notification_type_settings ?? {};
		}
	});

	// Derived state
	const hasChanges = $derived.by(() => {
		// Default values to compare against if preferences is null
		const defaultSilenceAll = false;
		const defaultEventReminders = true;
		const defaultEnabledChannels = ['in_app', 'email'];
		const defaultDigestFrequency = 'immediate';
		const defaultDigestSendTime = '09:00';
		const defaultNotificationTypeSettings = {};

		// Compare against preferences if available, otherwise against defaults
		const refSilenceAll = preferences?.silence_all_notifications ?? defaultSilenceAll;
		const refEventReminders = preferences?.event_reminders_enabled ?? defaultEventReminders;
		const refEnabledChannels = preferences?.enabled_channels ?? defaultEnabledChannels;
		const refDigestFrequency = preferences?.digest_frequency ?? defaultDigestFrequency;
		const refDigestSendTime = preferences?.digest_send_time ?? defaultDigestSendTime;
		const refNotificationTypeSettings =
			preferences?.notification_type_settings ?? defaultNotificationTypeSettings;

		return (
			silenceAll !== refSilenceAll ||
			eventReminders !== refEventReminders ||
			JSON.stringify([...enabledChannels].sort()) !==
				JSON.stringify([...refEnabledChannels].sort()) ||
			digestFrequency !== refDigestFrequency ||
			digestSendTime !== refDigestSendTime ||
			JSON.stringify(notificationTypeSettings) !== JSON.stringify(refNotificationTypeSettings)
		);
	});

	const isFormDisabled = $derived(disabled || silenceAll);
	const showTimePicker = $derived(digestFrequency === 'daily' || digestFrequency === 'weekly');
	const isTelegramConnected = $derived(telegramStatusQuery.data?.connected ?? false);

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

	// Update preferences mutation
	const updateMutation = createMutation(() => ({
		mutationFn: async (data: {
			silence_all_notifications?: boolean;
			event_reminders_enabled?: boolean;
			enabled_channels?: Array<'in_app' | 'email' | 'telegram'>;
			digest_frequency?: string;
			digest_send_time?: string;
			notification_type_settings?: Record<string, NotificationTypeSettings>;
		}) => {
			// In unsubscribe mode, send all fields explicitly (even false values)
			// In authenticated mode, only send fields that are explicitly set (PATCH requirement)
			const payload: UpdateNotificationPreferenceSchema = {};

			if (isUnsubscribeMode) {
				// Send all fields explicitly in unsubscribe mode
				payload.silence_all_notifications = data.silence_all_notifications ?? false;
				payload.event_reminders_enabled = data.event_reminders_enabled ?? false;
				payload.enabled_channels = data.enabled_channels ?? [];
				payload.digest_frequency = data.digest_frequency ?? 'immediate';
				payload.digest_send_time = data.digest_send_time ?? '09:00';
				payload.notification_type_settings = data.notification_type_settings ?? {};
			} else {
				// Only send changed fields in authenticated mode
				if (data.silence_all_notifications !== undefined) {
					payload.silence_all_notifications = data.silence_all_notifications;
				}
				if (data.event_reminders_enabled !== undefined) {
					payload.event_reminders_enabled = data.event_reminders_enabled;
				}
				if (data.enabled_channels !== undefined) {
					payload.enabled_channels = data.enabled_channels;
				}
				if (data.digest_frequency !== undefined) {
					payload.digest_frequency = data.digest_frequency;
				}
				if (data.digest_send_time !== undefined) {
					payload.digest_send_time = data.digest_send_time;
				}
				if (data.notification_type_settings !== undefined) {
					payload.notification_type_settings = data.notification_type_settings;
				}
			}

			// Use different endpoint based on mode
			if (isUnsubscribeMode && unsubscribeToken) {
				// Unsubscribe mode: use unsubscribe endpoint with token
				const response = await notificationpreferenceUnsubscribe({
					body: {
						token: unsubscribeToken,
						preferences: payload
					}
				});

				// Check for errors in response
				if (response.error) {
					throw new Error(extractErrorMessage(response.error));
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
		onSuccess: (data) => {
			if (!isUnsubscribeMode) {
				queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
			}
			toast.success(m['notificationPreferences.saveSuccess']());
			onSave?.(data as NotificationPreferenceSchema);
		},
		onError: (error: Error) => {
			toast.error(m['notificationPreferences.saveFailed']({ error: error.message }));
			console.error('Failed to update notification preferences:', error);
		}
	}));

	// Channel toggle handlers
	function toggleChannel(channel: 'in_app' | 'email' | 'telegram') {
		if (enabledChannels.includes(channel)) {
			enabledChannels = enabledChannels.filter((c) => c !== channel);
		} else {
			enabledChannels = [...enabledChannels, channel];
		}
	}

	function isChannelEnabled(channel: 'in_app' | 'email' | 'telegram'): boolean {
		return enabledChannels.includes(channel);
	}

	// Save handler
	function handleSave() {
		if (validationError) {
			toast.error(validationError);
			return;
		}

		updateMutation.mutate({
			silence_all_notifications: silenceAll,
			event_reminders_enabled: eventReminders,
			enabled_channels: enabledChannels,
			digest_frequency: digestFrequency,
			digest_send_time: showTimePicker ? digestSendTime : undefined,
			notification_type_settings:
				Object.keys(notificationTypeSettings).length > 0 ? notificationTypeSettings : undefined
		});
	}

	// Reset handler
	function handleReset() {
		// Reset to preferences if available, otherwise to defaults
		silenceAll = preferences?.silence_all_notifications ?? false;
		eventReminders = preferences?.event_reminders_enabled ?? true;
		enabledChannels = preferences?.enabled_channels ?? ['in_app', 'email'];
		digestFrequency = preferences?.digest_frequency ?? 'immediate';
		digestSendTime = preferences?.digest_send_time ?? '09:00';
		notificationTypeSettings = preferences?.notification_type_settings ?? {};
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
				<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
				{m['notificationPreferences.saving']()}
			{:else}
				{m['notificationPreferences.saveChanges']()}
			{/if}
		</Button>
	</div>
</div>
