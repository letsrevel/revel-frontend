<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { authStore } from '$lib/stores/auth.svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';
	import { NotificationPreferencesForm } from '$lib/components/notifications';
	import { BillingProfileForm } from '$lib/components/billing';
	import CityAutocomplete from '$lib/components/forms/CityAutocomplete.svelte';
	import AttendeeVisibilitySelect from '$lib/components/profile/AttendeeVisibilitySelect.svelte';
	import { Button } from '$lib/components/ui/button';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import SectionHeader from '$lib/components/common/SectionHeader.svelte';
	import { userpreferencesUpdateGeneralPreferences } from '$lib/api/generated';
	import type { CitySchema } from '$lib/api/generated';
	import type { VisibilityValue } from '$lib/schemas/preferences';
	import { toast } from 'svelte-sonner';
	import { Loader2, Eye, Info, FileText } from '@lucide/svelte';

	interface Props {
		data: PageData;
	}

	const { data }: Props = $props();

	// Check for redirect URL (used when coming from events)
	const redirectUrl = $derived($page.url.searchParams.get('redirect'));

	// General preferences state
	let selectedCity = $state<CitySchema | null>(data.generalPreferences?.city || null);
	let attendeeListVisibility = $state<VisibilityValue>(
		data.generalPreferences?.show_me_on_attendee_list ?? 'never'
	);
	let isUpdatingGeneral = $state(false);

	function handleCitySelect(city: CitySchema | null) {
		selectedCity = city;
	}

	async function saveGeneralPreferences() {
		if (!authStore.accessToken) return;

		isUpdatingGeneral = true;
		try {
			const { error } = await userpreferencesUpdateGeneralPreferences({
				headers: {
					Authorization: `Bearer ${authStore.accessToken}`
				},
				body: {
					city_id: selectedCity?.id || null,
					show_me_on_attendee_list: attendeeListVisibility
				}
			});

			if (error) {
				toast.error(m['accountSettingsPage.general.updateError']());
			} else {
				if (redirectUrl) {
					toast.success(m['settings.savedRedirecting']());
					setTimeout(() => {
						// eslint-disable-next-line svelte/no-navigation-without-resolve -- post-auth return path read from the ?redirect query param; app-relative, not a static route id
						goto(redirectUrl);
					}, 1000);
				} else {
					toast.success(m['accountSettingsPage.general.updateSuccess']());
				}
			}
		} catch {
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
	<PageHeader
		kicker={m['myInvoices.account']()}
		title={m['accountSettingsPage.title']()}
		subtitle={m['accountSettingsPage.subtitle']()}
		class="mb-8"
	/>

	{#if redirectUrl}
		<!-- Composited tint mirrors ToneTile's audited "info as icon/accent" pair
		     (>=3:1 vs background/card per audit-brand-themes.py); body copy stays on
		     --foreground so contrast never depends on the alpha overlay. -->
		<div class="mb-6 rounded-md border border-info/30 bg-info/10 p-4">
			<p class="text-sm text-foreground">
				<Info class="mr-2 inline-block h-4 w-4 text-info" aria-hidden="true" />
				{m['settings.updateToReturn']()}
			</p>
		</div>
	{/if}

	{#if authStore.accessToken}
		<!-- General Preferences -->
		<div class="mb-8 rounded-lg border bg-card p-6">
			<SectionHeader title={m['accountSettingsPage.general.title']()} class="mb-4" />
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
				<div class="flex items-start gap-2">
					<Eye class="mt-0.5 h-5 w-5 text-muted-foreground" aria-hidden="true" />
					<div class="flex-1">
						<AttendeeVisibilitySelect bind:value={attendeeListVisibility} />
					</div>
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

		<!-- Billing Information -->
		<div class="mb-8 rounded-lg border bg-card p-6">
			<div class="flex items-center gap-2">
				<FileText class="h-5 w-5 text-muted-foreground" aria-hidden="true" />
				<SectionHeader title={m['accountSettingsPage.billing.title']()} class="flex-1" />
			</div>
			<p class="mt-1 text-sm text-muted-foreground">
				{m['accountSettingsPage.billing.description']()}
			</p>
			<BillingProfileForm authToken={authStore.accessToken} />
		</div>

		<!-- Notification Settings -->
		<NotificationPreferencesForm
			preferences={data.notificationPreferences ?? null}
			authToken={authStore.accessToken}
		/>
	{:else}
		<div role="alert" class="rounded-md border border-destructive bg-destructive/10 p-4">
			<p class="text-sm font-medium text-destructive">
				{m['accountSettingsPage.errorNotLoggedIn']()}
			</p>
		</div>
	{/if}
</div>
