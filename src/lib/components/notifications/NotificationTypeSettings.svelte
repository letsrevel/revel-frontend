<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { notificationpreferenceGetAvailableNotificationTypes } from '$lib/api';
	import { createQuery } from '@tanstack/svelte-query';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import { Checkbox } from '$lib/components/ui/checkbox';
	import * as Card from '$lib/components/ui/card';
	import { Separator } from '$lib/components/ui/separator';
	import { Loader2, Bell, Mail, MessageSquare, ChevronDown, Settings } from '@lucide/svelte';
	import type { NotificationTypeSettings, NotificationType } from '$lib/api/generated/types.gen.js';

	interface Props {
		notificationTypeSettings: Record<string, NotificationTypeSettings>;
		enabledChannels: Array<'in_app' | 'email' | 'telegram'>;
		isFormDisabled: boolean;
		isTelegramConnected: boolean;
		authToken?: string;
	}

	let {
		notificationTypeSettings = $bindable(),
		enabledChannels,
		isFormDisabled,
		isTelegramConnected,
		authToken
	}: Props = $props();

	let advancedOpen = $state(false);

	// Fetch available notification types
	const availableTypesQuery = createQuery(() => ({
		queryKey: ['notification-types'],
		queryFn: async () => {
			const response = await notificationpreferenceGetAvailableNotificationTypes({
				headers: { Authorization: `Bearer ${authToken}` }
			});
			return response;
		},
		enabled: !!authToken,
		staleTime: 5 * 60 * 1000, // Cache for 5 minutes
		retry: 1
	}));

	const availableTypes = $derived.by(() => {
		const data = availableTypesQuery.data?.data;

		// The API returns Array<NotificationType> directly
		if (Array.isArray(data)) {
			return data;
		}
		// Handle potential object wrapper format { notification_types: [...] }
		if (data && typeof data === 'object' && 'notification_types' in data) {
			const wrapper = data as { notification_types?: NotificationType[] };
			return wrapper.notification_types ?? [];
		}
		return [];
	});

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
</script>

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
						{availableTypesQuery.error?.message || m['notificationPreferences.unknownError']()}
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
				</div>
			{:else}
				<div class="mb-4 space-y-1 text-sm text-muted-foreground">
					<h3 class="font-medium">{m['notificationPreferences.perTypeSettingsTitle']()}</h3>
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
