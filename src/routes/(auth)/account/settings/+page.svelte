<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import type { PageData } from './$types';
	import { NotificationPreferencesForm } from '$lib/components/notifications';
	import CityAutocomplete from '$lib/components/forms/CityAutocomplete.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Label } from '$lib/components/ui/label';
	import * as RadioGroup from '$lib/components/ui/radio-group';
	import { userpreferencesUpdateGeneralPreferences } from '$lib/api/generated';
	import type { CitySchema } from '$lib/api/generated';
	import { toast } from 'svelte-sonner';
	import { Loader2, Eye } from 'lucide-svelte';

	interface Props {
		data: PageData;
	}

	let { data }: Props = $props();

	// General preferences state
	let selectedCity = $state<CitySchema | null>(data.generalPreferences?.city || null);
	let attendeeListVisibility = $state<string>(
		data.generalPreferences?.show_me_on_attendee_list ?? 'never'
	);
	let isUpdatingGeneral = $state(false);

	function handleCitySelect(city: CitySchema | null) {
		selectedCity = city;
	}

	async function saveGeneralPreferences() {
		if (!data.accessToken) return;

		isUpdatingGeneral = true;
		try {
			const { data: updatedPrefs, error } = await userpreferencesUpdateGeneralPreferences({
				headers: {
					Authorization: `Bearer ${data.accessToken}`
				},
				body: {
					city_id: selectedCity?.id || null,
					show_me_on_attendee_list: attendeeListVisibility as
						| 'never'
						| 'to_members'
						| 'to_invitees'
						| 'to_both'
						| 'always'
				}
			});

			if (error) {
				toast.error(m['accountSettingsPage.general.updateError']());
			} else {
				toast.success(m['accountSettingsPage.general.updateSuccess']());
			}
		} catch (err) {
			toast.error(m['accountSettingsPage.general.updateError']());
		} finally {
			isUpdatingGeneral = false;
		}
	}
</script>

<svelte:head>
	<title>{m['accountSettingsPage.pageTitle']()} - Revel</title>
	<meta name="description" content={m['accountSettingsPage.pageDescription']()} />
</svelte:head>

<div class="container mx-auto max-w-2xl px-4 py-8">
	<div class="mb-8">
		<h1 class="text-3xl font-bold tracking-tight">{m['accountSettingsPage.title']()}</h1>
		<p class="mt-2 text-muted-foreground">{m['accountSettingsPage.subtitle']()}</p>
	</div>

	{#if data.accessToken}
		<!-- General Preferences -->
		<div class="mb-8 rounded-lg border bg-card p-6">
			<h2 class="mb-4 text-xl font-semibold">{m['accountSettingsPage.general.title']()}</h2>
			<p class="mb-6 text-sm text-muted-foreground">
				{m['accountSettingsPage.general.description']()}
			</p>

			<div class="space-y-6">
				<!-- City -->
				<div>
					<CityAutocomplete
						value={selectedCity}
						onSelect={handleCitySelect}
						label={m['accountSettingsPage.general.cityLabel']()}
						description={m['accountSettingsPage.general.cityDescription']()}
					/>
				</div>

				<!-- Privacy Settings -->
				<div class="space-y-3">
					<div class="flex items-start gap-2">
						<Eye class="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
						<div class="flex-1">
							<Label class="text-base font-medium">
								{m['notificationPreferences.privacySettings']()}
							</Label>
							<p class="mt-1 text-sm text-muted-foreground">
								{m['accountSettingsPage.privacyDescription']()}
							</p>
						</div>
					</div>

					<RadioGroup.Root bind:value={attendeeListVisibility} class="ml-7 space-y-2">
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="never" id="privacy-never" />
							<Label for="privacy-never" class="font-normal">
								{m['accountSettingsPage.privacyNever']()}
							</Label>
						</div>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="to_members" id="privacy-members" />
							<Label for="privacy-members" class="font-normal">
								{m['accountSettingsPage.privacyToMembers']()}
							</Label>
						</div>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="to_invitees" id="privacy-invitees" />
							<Label for="privacy-invitees" class="font-normal">
								{m['accountSettingsPage.privacyToInvitees']()}
							</Label>
						</div>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="to_both" id="privacy-both" />
							<Label for="privacy-both" class="font-normal">
								{m['accountSettingsPage.privacyToBoth']()}
							</Label>
						</div>
						<div class="flex items-center space-x-2">
							<RadioGroup.Item value="always" id="privacy-always" />
							<Label for="privacy-always" class="font-normal">
								{m['accountSettingsPage.privacyAlways']()}
							</Label>
						</div>
					</RadioGroup.Root>
				</div>

				<!-- Save Button -->
				<div class="flex justify-end border-t pt-4">
					<Button onclick={saveGeneralPreferences} disabled={isUpdatingGeneral}>
						{#if isUpdatingGeneral}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
							{m['common.actions_saving']()}
						{:else}
							{m['common.actions_save']()}
						{/if}
					</Button>
				</div>
			</div>
		</div>

		<!-- Notification Settings -->
		<NotificationPreferencesForm
			preferences={data.notificationPreferences ?? null}
			authToken={data.accessToken}
		/>
	{:else}
		<div role="alert" class="rounded-md border border-destructive bg-destructive/10 p-4">
			<p class="text-sm font-medium text-destructive">
				{m['accountSettingsPage.errorNotLoggedIn']()}
			</p>
		</div>
	{/if}
</div>
