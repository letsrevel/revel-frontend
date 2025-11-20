<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import {
		notificationpreferenceUpdatePreferences,
		notificationpreferenceGetAvailableNotificationTypes,
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
	import {
		Loader2,
		Bell,
		BellOff,
		Mail,
		MessageSquare,
		Clock,
		Users,
		Eye,
		ChevronDown,
		Settings
	} from 'lucide-svelte';
	import type {
		NotificationPreferenceSchema,
		NotificationTypeSettings
	} from '$lib/api/generated/types.gen.js';

	interface Props {
		preferences: NotificationPreferenceSchema | null;
		onSave?: (preferences?: NotificationPreferenceSchema) => void;
		disabled?: boolean;
		authToken?: string;
		unsubscribeToken?: string; // Token for unsubscribe mode (unauthenticated)
	}

	let { preferences, onSave, disabled = false, authToken, unsubscribeToken }: Props = $props();

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

	// Fetch available notification types (only in authenticated mode)
	let availableTypesQuery = createQuery(() => ({
		queryKey: ['notification-types'],
		queryFn: async () => {
			console.log('[NotificationPreferences] Fetching available notification types...');
			const response = await notificationpreferenceGetAvailableNotificationTypes({
				headers: { Authorization: `Bearer ${authToken}` }
			});
			console.log('[NotificationPreferences] Available notification types response:', {
				status: response.response?.status,
				data: response.data,
				error: response.error
			});
			return response;
		},
		enabled: !!authToken && !isUnsubscribeMode, // Don't fetch in unsubscribe mode
		staleTime: 5 * 60 * 1000, // Cache for 5 minutes
		retry: 1
	}));

	let availableTypes = $derived.by(() => {
		const fullData = availableTypesQuery.data;
		const data = fullData?.data;

		console.log('[NotificationPreferences] Deriving available types:', {
			queryStatus: availableTypesQuery.status,
			fullData,
			data,
			isArray: Array.isArray(data)
		});

		// The API returns Array<NotificationType> directly
		if (Array.isArray(data)) {
			console.log('[NotificationPreferences] Data is array, returning directly:', data);
			return data;
		}
		// Handle potential object wrapper format { notification_types: [...] }
		if (data && typeof data === 'object' && 'notification_types' in data) {
			console.log(
				'[NotificationPreferences] Extracting notification_types:',
				(data as any).notification_types
			);
			return (data as any).notification_types ?? [];
		}
		console.log('[NotificationPreferences] No types found, returning empty array');
		return [];
	});

	// Local state - initialize from preferences prop
	let silenceAll = $state(preferences?.silence_all_notifications ?? false);
	let eventReminders = $state(preferences?.event_reminders_enabled ?? true);
	let enabledChannels = $state<Array<'in_app' | 'email' | 'telegram'>>(
		preferences?.enabled_channels ?? ['in_app', 'email']
	);
	let digestFrequency = $state<string>(preferences?.digest_frequency ?? 'immediate');
	let digestSendTime = $state<string>(preferences?.digest_send_time ?? '09:00');
	let attendeeListVisibility = $state<string>(preferences?.show_me_on_attendee_list ?? 'never');
	let notificationTypeSettings = $state<Record<string, NotificationTypeSettings>>(
		preferences?.notification_type_settings ?? {}
	);
	let advancedOpen = $state(false);

	// Sync local state when preferences prop changes
	$effect(() => {
		if (preferences) {
			silenceAll = preferences.silence_all_notifications ?? false;
			eventReminders = preferences.event_reminders_enabled ?? true;
			enabledChannels = preferences.enabled_channels ?? ['in_app', 'email'];
			digestFrequency = preferences.digest_frequency ?? 'immediate';
			digestSendTime = preferences.digest_send_time ?? '09:00';
			attendeeListVisibility = preferences.show_me_on_attendee_list ?? 'never';
			notificationTypeSettings = preferences.notification_type_settings ?? {};
		}
	});

	// Debug effect for available types
	$effect(() => {
		console.log('[NotificationPreferences] Effect - Available types changed:', {
			count: availableTypes.length,
			types: availableTypes,
			queryStatus: availableTypesQuery.status,
			queryEnabled: !!authToken,
			isError: availableTypesQuery.isError,
			isLoading: availableTypesQuery.isLoading
		});
	});

	// Derived state
	let hasChanges = $derived.by(() => {
		// Default values to compare against if preferences is null
		const defaultSilenceAll = false;
		const defaultEventReminders = true;
		const defaultEnabledChannels = ['in_app', 'email'];
		const defaultDigestFrequency = 'immediate';
		const defaultDigestSendTime = '09:00';
		const defaultAttendeeListVisibility = 'never';
		const defaultNotificationTypeSettings = {};

		// Compare against preferences if available, otherwise against defaults
		const refSilenceAll = preferences?.silence_all_notifications ?? defaultSilenceAll;
		const refEventReminders = preferences?.event_reminders_enabled ?? defaultEventReminders;
		const refEnabledChannels = preferences?.enabled_channels ?? defaultEnabledChannels;
		const refDigestFrequency = preferences?.digest_frequency ?? defaultDigestFrequency;
		const refDigestSendTime = preferences?.digest_send_time ?? defaultDigestSendTime;
		const refAttendeeListVisibility =
			preferences?.show_me_on_attendee_list ?? defaultAttendeeListVisibility;
		const refNotificationTypeSettings =
			preferences?.notification_type_settings ?? defaultNotificationTypeSettings;

		return (
			silenceAll !== refSilenceAll ||
			eventReminders !== refEventReminders ||
			JSON.stringify([...enabledChannels].sort()) !==
				JSON.stringify([...refEnabledChannels].sort()) ||
			digestFrequency !== refDigestFrequency ||
			digestSendTime !== refDigestSendTime ||
			attendeeListVisibility !== refAttendeeListVisibility ||
			JSON.stringify(notificationTypeSettings) !== JSON.stringify(refNotificationTypeSettings)
		);
	});

	let isFormDisabled = $derived(disabled || silenceAll);
	let showTimePicker = $derived(digestFrequency === 'daily' || digestFrequency === 'weekly');
	let isTelegramConnected = $derived(telegramStatusQuery.data?.connected ?? false);

	// Validation
	let validationError = $derived.by(() => {
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
			show_me_on_attendee_list?: string;
			notification_type_settings?: Record<string, NotificationTypeSettings>;
		}) => {
			// In unsubscribe mode, send all fields explicitly (even false values)
			// In authenticated mode, only send fields that are explicitly set (PATCH requirement)
			const payload: Record<string, any> = {};

			if (isUnsubscribeMode) {
				// Send all fields explicitly in unsubscribe mode
				payload.silence_all_notifications = data.silence_all_notifications ?? false;
				payload.event_reminders_enabled = data.event_reminders_enabled ?? false;
				payload.enabled_channels = data.enabled_channels ?? [];
				payload.digest_frequency = data.digest_frequency ?? 'immediate';
				payload.digest_send_time = data.digest_send_time ?? '09:00';
				payload.show_me_on_attendee_list = data.show_me_on_attendee_list ?? 'never';
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
				if (data.show_me_on_attendee_list !== undefined) {
					payload.show_me_on_attendee_list = data.show_me_on_attendee_list;
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
					const error = response.error as any;
					throw new Error(error?.detail || error?.message || 'Failed to update preferences');
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
					const error = response.error as any;
					throw new Error(error?.detail || error?.message || 'Failed to update preferences');
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
			show_me_on_attendee_list: attendeeListVisibility,
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
		attendeeListVisibility = preferences?.show_me_on_attendee_list ?? 'never';
		notificationTypeSettings = preferences?.notification_type_settings ?? {};
	}

	// Helper functions for notification type settings
	function getNotificationTypeSettings(type: string): {
		enabled: boolean;
		channels: Array<'in_app' | 'email' | 'telegram'>;
	} {
		const settings = notificationTypeSettings[type];
		// If no custom settings, return defaults with global channels
		if (!settings) {
			return {
				enabled: true,
				channels: enabledChannels // Use global channels as default
			};
		}
		return {
			enabled: settings.enabled ?? true,
			channels: settings.channels ?? enabledChannels // Use global channels if not set
		};
	}

	function hasCustomSettings(type: string): boolean {
		return type in notificationTypeSettings;
	}

	function updateNotificationTypeEnabled(type: string, enabled: boolean) {
		const current = notificationTypeSettings[type];
		notificationTypeSettings = {
			...notificationTypeSettings,
			[type]: { enabled, channels: current?.channels ?? [] }
		};
	}

	function toggleNotificationTypeChannel(type: string, channel: 'in_app' | 'email' | 'telegram') {
		const current = notificationTypeSettings[type];
		// If no custom settings exist, start with global channels
		const currentChannels = current?.channels ?? [...enabledChannels];

		const newChannels = currentChannels.includes(channel)
			? currentChannels.filter((c) => c !== channel)
			: [...currentChannels, channel];

		// If all channels are unchecked, disable the notification type
		const enabled = newChannels.length > 0 ? (current?.enabled ?? true) : false;

		notificationTypeSettings = {
			...notificationTypeSettings,
			[type]: { enabled, channels: newChannels }
		};
	}

	function resetNotificationTypeToDefault(type: string) {
		// Remove the type from custom settings to revert to defaults
		const { [type]: _, ...rest } = notificationTypeSettings;
		notificationTypeSettings = rest;
	}

	function isNotificationTypeChannelEnabled(
		type: string,
		channel: 'in_app' | 'email' | 'telegram'
	): boolean {
		const settings = getNotificationTypeSettings(type);
		return settings.channels.includes(channel);
	}
</script>

<div class="space-y-6">
	{#if !isUnsubscribeMode}
		<!-- Privacy Settings Section -->
		<Card.Root>
			<Card.Header>
				<Card.Title class="flex items-center gap-2">
					<Eye class="h-5 w-5" aria-hidden="true" />
					{m['notificationPreferences.privacySettings']()}
				</Card.Title>
				<Card.Description>{m['accountSettingsPage.privacyDescription']()}</Card.Description>
			</Card.Header>
			<Card.Content>
				<div class="space-y-3">
					<Label>{m['notificationPreferences.showMeOnAttendeeList']()}</Label>
					<RadioGroup.Root
						value={attendeeListVisibility}
						onValueChange={(value) => {
							if (value) {
								attendeeListVisibility = value;
							}
						}}
						disabled={isFormDisabled}
					>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="always" id="vis-always" />
							<Label for="vis-always" class="font-normal"
								>{m['notificationPreferences.visibilityAlways']()}</Label
							>
						</div>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="never" id="vis-never" />
							<Label for="vis-never" class="font-normal"
								>{m['notificationPreferences.visibilityNever']()}</Label
							>
						</div>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="to_members" id="vis-members" />
							<Label for="vis-members" class="font-normal"
								>{m['notificationPreferences.visibilityToMembers']()}</Label
							>
						</div>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="to_invitees" id="vis-invitees" />
							<Label for="vis-invitees" class="font-normal"
								>{m['notificationPreferences.visibilityToInvitees']()}</Label
							>
						</div>
					</RadioGroup.Root>
					<p class="text-xs text-muted-foreground">
						{m['notificationPreferences.visibilityDescription']()}
					</p>
				</div>
			</Card.Content>
		</Card.Root>
	{/if}

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
											href="/account/profile"
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
		<Card.Root>
			<button
				type="button"
				onclick={() => (advancedOpen = !advancedOpen)}
				class="w-full p-6 text-left transition-colors hover:bg-accent"
				aria-expanded={advancedOpen}
			>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-2">
						<Settings class="h-5 w-5" aria-hidden="true" />
						<h3 class="text-lg font-semibold">{m['notificationPreferences.advancedSettings']()}</h3>
					</div>
					<ChevronDown
						class="h-5 w-5 transition-transform duration-200 {advancedOpen ? 'rotate-180' : ''}"
						aria-hidden="true"
					/>
				</div>
				<p class="mt-1 text-sm text-muted-foreground">
					{m['notificationPreferences.advancedSettingsDescription']()}
				</p>
			</button>

			{#if advancedOpen}
				<Card.Content class="space-y-6 border-t pt-6">
					{#if availableTypesQuery.isLoading}
						<div class="flex items-center justify-center py-8">
							<Loader2 class="h-6 w-6 animate-spin text-muted-foreground" />
						</div>
					{:else if availableTypesQuery.isError}
						<div class="py-4 text-center text-sm">
							<p class="font-medium text-destructive">
								{m['notificationPreferences.failedToLoadTypes']()}
							</p>
							<p class="mt-1 text-muted-foreground">
								{availableTypesQuery.error?.message || 'Unknown error'}
							</p>
							<Button
								variant="outline"
								size="sm"
								onclick={() => availableTypesQuery.refetch()}
								class="mt-3"
							>
								{m['notificationPreferences.retryLoad']()}
							</Button>
						</div>
					{:else if availableTypes.length === 0}
						<div class="py-4 text-center text-sm">
							<p class="text-muted-foreground">{m['notificationPreferences.noTypesAvailable']()}</p>
							<!-- Debug info -->
							<details class="mt-3 text-left">
								<summary class="cursor-pointer text-xs">Debug info</summary>
								<pre class="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
Query status: {availableTypesQuery.status}
Data: {JSON.stringify(availableTypesQuery.data, null, 2)}
								</pre>
							</details>
						</div>
					{:else}
						<div class="mb-4 space-y-1 text-sm text-muted-foreground">
							<p class="font-medium">{m['notificationPreferences.perTypeSettingsTitle']()}</p>
							<ul class="ml-2 list-inside list-disc space-y-1">
								<li>{m['notificationPreferences.perTypeSettingsDefault']()}</li>
								<li>{m['notificationPreferences.perTypeSettingsCustom']()}</li>
								<li>{m['notificationPreferences.perTypeSettingsReset']()}</li>
							</ul>
						</div>

						{#each availableTypes as notificationType, index (notificationType)}
							{@const settings = getNotificationTypeSettings(notificationType)}
							{@const isCustom = hasCustomSettings(notificationType)}
							<div class="space-y-3">
								{#if index > 0}
									<Separator />
								{/if}

								<!-- Notification type header with status and actions -->
								<div class="flex items-start justify-between gap-3">
									<div class="flex-1 space-y-1">
										<div class="flex flex-wrap items-center gap-2">
											<Label
												for="type-{notificationType}-enabled"
												class="text-base font-medium capitalize"
											>
												{notificationType.replace(/_/g, ' ')}
											</Label>
											{#if !isCustom}
												<span
													class="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
												>
													{m['notificationPreferences.usingDefaults']()}
												</span>
											{:else}
												<span
													class="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
												>
													{m['notificationPreferences.customSettings']()}
												</span>
											{/if}
										</div>
										<p class="text-xs text-muted-foreground">
											{#if settings.enabled}
												{#if settings.channels.length === 0}
													<strong>{m['notificationPreferences.enabled']()}</strong> •
													<span class="text-destructive"
														>{m['notificationPreferences.noChannels']()}</span
													>
												{:else}
													<strong>{m['notificationPreferences.enabled']()}</strong> • {settings.channels
														.map((c) => c.replace('_', '-'))
														.join(', ')}
												{/if}
											{:else}
												<strong class="text-destructive"
													>{m['notificationPreferences.disabled']()}</strong
												>
												• {m['notificationPreferences.disabled']()}
											{/if}
										</p>
									</div>
									<div class="flex items-center gap-2">
										{#if isCustom}
											<Button
												type="button"
												variant="ghost"
												size="sm"
												onclick={() => resetNotificationTypeToDefault(notificationType)}
												disabled={isFormDisabled}
												class="h-8 px-2 text-xs"
												aria-label={m['notificationPreferences.resetAriaLabel']({
													type: notificationType
												})}
											>
												{m['notificationPreferences.resetButton']()}
											</Button>
										{/if}
										<Checkbox
											id="type-{notificationType}-enabled"
											checked={settings.enabled}
											onCheckedChange={(checked) => {
												updateNotificationTypeEnabled(notificationType, checked === true);
											}}
											disabled={isFormDisabled}
											aria-label={m['notificationPreferences.enableAriaLabel']({
												type: notificationType
											})}
										/>
									</div>
								</div>

								<!-- Channel selection for this notification type -->
								{#if settings.enabled}
									<div class="ml-6 space-y-2">
										<Label class="text-sm font-medium">
											{m['notificationPreferences.channels']()}
											<span class="font-normal text-muted-foreground">
												{#if !isCustom}
													{m['notificationPreferences.usingGlobalDefaults']()}
												{/if}
											</span>:
										</Label>
										<div class="flex flex-wrap gap-3">
											<!-- In-App -->
											<div class="flex items-center space-x-2">
												<Checkbox
													id="type-{notificationType}-in-app"
													checked={settings.channels.includes('in_app')}
													onCheckedChange={() =>
														toggleNotificationTypeChannel(notificationType, 'in_app')}
													disabled={isFormDisabled}
												/>
												<Label
													for="type-{notificationType}-in-app"
													class="flex items-center gap-1.5 text-sm font-normal"
												>
													<Bell class="h-4 w-4" aria-hidden="true" />
													{m['notificationPreferences.channelInApp']()}
												</Label>
											</div>

											<!-- Email -->
											<div class="flex items-center space-x-2">
												<Checkbox
													id="type-{notificationType}-email"
													checked={settings.channels.includes('email')}
													onCheckedChange={() =>
														toggleNotificationTypeChannel(notificationType, 'email')}
													disabled={isFormDisabled}
												/>
												<Label
													for="type-{notificationType}-email"
													class="flex items-center gap-1.5 text-sm font-normal"
												>
													<Mail class="h-4 w-4" aria-hidden="true" />
													{m['notificationPreferences.channelEmail']()}
												</Label>
											</div>

											<!-- Telegram -->
											<div class="flex items-center space-x-2">
												<Checkbox
													id="type-{notificationType}-telegram"
													checked={settings.channels.includes('telegram')}
													onCheckedChange={() =>
														toggleNotificationTypeChannel(notificationType, 'telegram')}
													disabled={isFormDisabled || !isTelegramConnected}
												/>
												<Label
													for="type-{notificationType}-telegram"
													class="flex items-center gap-1.5 text-sm font-normal"
												>
													<MessageSquare class="h-4 w-4" aria-hidden="true" />
													{m['notificationPreferences.channelTelegram']()}
												</Label>
											</div>
										</div>
									</div>
								{/if}
							</div>
						{/each}
					{/if}
				</Card.Content>
			{/if}
		</Card.Root>
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
