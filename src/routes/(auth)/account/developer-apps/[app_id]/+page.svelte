<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import * as m from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query';
	import { ArrowLeft, Loader2, SearchX } from '@lucide/svelte';
	import type { OAuthAppUpdatePayload } from '$lib/api/generated/types.gen';
	import {
		appQuery,
		deleteApp,
		isEmailUnverified,
		isNotFound,
		oauthKeys,
		rotateSecret,
		scopesQuery,
		setAppActive,
		updateApp,
		uploadLogo
	} from '$lib/api/queries/oauth';
	import { authStore } from '$lib/stores/auth.svelte';
	import {
		diffForPatch,
		fieldErrorsFrom,
		removedScopes,
		valuesFromApp,
		type AppFormValues
	} from '$lib/utils/oauth-app-form';
	import { Button } from '$lib/components/ui/button';
	import PageHeader from '$lib/components/common/PageHeader.svelte';
	import EmptyState from '$lib/components/common/EmptyState.svelte';
	import StatusBadge from '$lib/components/common/StatusBadge.svelte';
	import CopyField from '$lib/components/common/CopyField.svelte';
	import ConfirmDialog from '$lib/components/common/ConfirmDialog.svelte';
	import DeveloperAppForm from '$lib/components/oauth/DeveloperAppForm.svelte';
	import DeveloperAppLogo from '$lib/components/oauth/DeveloperAppLogo.svelte';
	import DeveloperAppDangerZone from '$lib/components/oauth/DeveloperAppDangerZone.svelte';
	import SecretReveal from '$lib/components/oauth/SecretReveal.svelte';
	import EmailUnverifiedCallout from '$lib/components/oauth/EmailUnverifiedCallout.svelte';

	/** The one confirmation in flight; a single `ConfirmDialog` renders whichever it is. */
	type PendingAction =
		| { kind: 'scopes'; body: OAuthAppUpdatePayload; removed: string[] }
		| { kind: 'rotate' }
		| { kind: 'toggle'; active: boolean }
		| { kind: 'delete' };

	const queryClient = useQueryClient();
	const appId = $derived(page.params.app_id ?? '');
	const listHref = resolve('/(auth)/account/developer-apps', {});

	// Only an explicit `false` short-circuits: a user still loading is not unverified.
	const storeUnverified = $derived(authStore.user?.email_verified === false);

	const app = createQuery(() => ({ ...appQuery(appId), enabled: !storeUnverified }));
	const scopes = createQuery(() => ({ ...scopesQuery(), enabled: !storeUnverified }));

	/**
	 * The rotated secret lives here only; never in a query or mutation cache. Tagged
	 * with the app it belongs to: SvelteKit reuses this component across `app_id`s,
	 * so a secret must never render on (or outlive a move to) another app's page.
	 */
	let secret = $state<{ appId: string; clientId: string; clientSecret: string } | null>(null);
	const revealed = $derived(secret && secret.appId === appId ? secret : null);
	let fieldErrors = $state<Record<string, string>>({});
	let formError = $state<string | null>(null);
	let logoError = $state<string | null>(null);
	let pending = $state<PendingAction | null>(null);
	let revealEl = $state<HTMLDivElement | null>(null);
	let dialogHost = $state<HTMLDivElement | null>(null);
	/** Where focus returns when a dialog closes. */
	let dialogTrigger: HTMLElement | null = null;

	// Per-app local state resets when the route moves to another app id (before the DOM
	// updates, so nothing from the previous app flashes). Only `appId` is tracked.
	$effect.pre(() => {
		const id = appId;
		untrack(() => {
			if (secret && secret.appId !== id) secret = null;
			fieldErrors = {};
			formError = null;
			logoError = null;
			pending = null;
		});
	});

	function refresh() {
		// `app(id)` is nested under `apps`, so this refetches the list AND this detail.
		return queryClient.invalidateQueries({ queryKey: oauthKeys.apps });
	}

	function actionFailed() {
		toast.error(m['oauth.developer.actionError']());
	}

	const update = createMutation(() => ({
		...updateApp(),
		onMutate: () => {
			fieldErrors = {};
			formError = null;
		},
		onSuccess: async () => {
			await refresh();
			toast.success(m['oauth.developer.saved']());
		},
		onError: (err) => {
			({ fields: fieldErrors, form: formError } = fieldErrorsFrom(err));
		}
	}));

	const logo = createMutation(() => ({
		...uploadLogo(),
		onMutate: () => {
			logoError = null;
		},
		onSuccess: async () => {
			await refresh();
			toast.success(m['oauth.developer.logo.uploaded']());
		},
		onError: () => {
			logoError = m['oauth.developer.logo.error']();
		}
	}));

	const rotate = createMutation(() => ({
		...rotateSecret(),
		onSuccess: async (rotated, id) => {
			if (rotated.client_secret) {
				// Copy and detach BEFORE any await: an unmount mid-refetch must not lose a
				// just-issued secret, and with no observer left `gcTime: 0` drops the
				// settled mutation (whose `data` carries the secret) from the cache.
				secret = { appId: id, clientId: rotated.client_id, clientSecret: rotated.client_secret };
				rotate.reset();
				await focusReveal();
			}
			await refresh();
		},
		onError: actionFailed
	}));

	const active = createMutation(() => ({
		...setAppActive(),
		onSuccess: () => refresh(),
		onError: actionFailed
	}));

	const remove = createMutation(() => ({
		...deleteApp(),
		// `id` is the mutation variable: after `goto` this component is destroyed and reading
		// the `appId` derived would warn (derived_inert) even though the value is still right.
		onSuccess: async (_data, id) => {
			const name = app.data?.name ?? '';
			// Only the list: refetching this detail now would flash the not-found state.
			await queryClient.invalidateQueries({ queryKey: oauthKeys.apps, exact: true });
			toast.success(m['oauth.developer.danger.deleted']({ name }));
			await goto(listHref);
			queryClient.removeQueries({ queryKey: oauthKeys.app(id) });
		},
		onError: actionFailed
	}));

	// The backend 403s the whole surface for an unverified email; the store may lag behind.
	// Any action can be the first to hit that 403. Every error is read up front (no
	// short-circuit), matching the tracking rule for `loading`/`failed` below.
	const unverified = $derived.by(() => {
		const errors = [
			app.error,
			scopes.error,
			update.error,
			rotate.error,
			active.error,
			remove.error,
			logo.error
		];
		return storeUnverified || errors.some(isEmailUnverified);
	});
	// Read BOTH flags every time: a query result only notifies about props it has seen
	// read, so a short-circuited `a || b` would leave `b` untracked and stale forever.
	const loading = $derived.by(() => {
		const flags = [app.isPending, scopes.isPending];
		return flags.some(Boolean);
	});
	const failed = $derived.by(() => {
		const flags = [app.isError, scopes.isError];
		return flags.some(Boolean);
	});
	const notFound = $derived(isNotFound(app.error));
	const busy = $derived(rotate.isPending || active.isPending || remove.isPending);

	/** The reveal appears far above the danger zone the user was in: take them there. */
	async function focusReveal() {
		await tick();
		const heading = revealEl?.querySelector<HTMLElement>('h2');
		heading?.setAttribute('tabindex', '-1');
		heading?.focus();
	}

	/** `ConfirmDialog` does not move focus itself: land on Cancel, the safe default. */
	async function openDialog(action: PendingAction) {
		dialogTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		pending = action;
		await tick();
		const cancel = m['confirmDialog.cancel']();
		const buttons = dialogHost?.querySelectorAll<HTMLButtonElement>('[role="dialog"] button');
		Array.from(buttons ?? [])
			.find((b) => b.textContent?.trim() === cancel)
			?.focus();
	}

	function closeDialog() {
		pending = null;
		dialogTrigger?.focus();
		dialogTrigger = null;
	}

	function submit(values: AppFormValues) {
		if (!app.data) return;
		// Diff against what the server holds now, not the form's first seed.
		const body = diffForPatch(valuesFromApp(app.data), values);
		if (Object.keys(body).length === 0) {
			toast.success(m['oauth.developer.saved']());
			return;
		}
		const removed = removedScopes(app.data.allowed_scopes, values.allowed_scopes);
		if (removed.length > 0) void openDialog({ kind: 'scopes', body, removed });
		else update.mutate({ id: appId, body });
	}

	function confirm() {
		const action = pending;
		closeDialog();
		if (!action) return;
		switch (action.kind) {
			case 'scopes':
				update.mutate({ id: appId, body: action.body });
				break;
			case 'rotate':
				rotate.mutate(appId);
				break;
			case 'toggle':
				active.mutate({ id: appId, active: action.active });
				break;
			case 'delete':
				remove.mutate(appId);
				break;
		}
	}

	const dialog = $derived.by(() => {
		const name = app.data?.name ?? '';
		switch (pending?.kind) {
			case 'scopes':
				return {
					title: m['oauth.developer.scopeRemoval.title'](),
					message: m['oauth.developer.scopeRemoval.message']({
						scopes: pending.removed.join(', ')
					}),
					confirmText: m['oauth.developer.scopeRemoval.confirm'](),
					variant: 'warning' as const
				};
			case 'rotate':
				return {
					title: m['oauth.developer.danger.rotateTitle'](),
					message: m['oauth.developer.danger.rotateMessage'](),
					confirmText: m['oauth.developer.danger.rotate'](),
					variant: 'warning' as const
				};
			case 'toggle':
				return pending.active
					? {
							title: m['oauth.developer.danger.activateTitle']({ name }),
							message: m['oauth.developer.danger.activateMessage'](),
							confirmText: m['oauth.developer.danger.activate'](),
							variant: 'info' as const
						}
					: {
							title: m['oauth.developer.danger.deactivateTitle']({ name }),
							message: m['oauth.developer.danger.deactivateMessage'](),
							confirmText: m['oauth.developer.danger.deactivate'](),
							variant: 'warning' as const
						};
			case 'delete':
				return {
					title: m['oauth.developer.danger.deleteTitle']({ name }),
					message: m['oauth.developer.danger.deleteMessage'](),
					confirmText: m['oauth.developer.danger.delete'](),
					variant: 'danger' as const
				};
			default:
				return null;
		}
	});

	const title = $derived(app.data?.name ?? m['oauth.developer.title']());
</script>

<svelte:head>
	<title>{title}</title>
</svelte:head>

<div class="container mx-auto max-w-3xl space-y-6 px-4 py-6">
	<!-- The not-found state carries its own way back; one link is enough. -->
	{#if !notFound}
		<a
			href={listHref}
			class="inline-flex items-center gap-1 rounded-sm text-sm font-bold text-muted-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
		>
			<ArrowLeft class="h-4 w-4" aria-hidden="true" />
			{m['oauth.developer.backToList']()}
		</a>
	{/if}

	<PageHeader kicker={m['oauth.developer.title']()} {title} class="break-words" />

	{#key appId}
		<!-- Outside the state chain below: the secret is shown exactly once, so a refetch
		     that fails (or any other state flip) after a rotate must never unmount it. -->
		{#if revealed}
			<div bind:this={revealEl} class="[&_h2]:outline-none">
				<SecretReveal
					clientId={revealed.clientId}
					clientSecret={revealed.clientSecret}
					onDone={() => (secret = null)}
				/>
			</div>
		{/if}

		{#if unverified}
			<EmailUnverifiedCallout />
		{:else if notFound}
			<EmptyState
				icon={SearchX}
				level={2}
				title={m['oauth.developer.notFoundTitle']()}
				body={m['oauth.developer.notFoundBody']()}
			>
				{#snippet action()}
					<Button href={listHref} variant="outline">{m['oauth.developer.backToList']()}</Button>
				{/snippet}
			</EmptyState>
		{:else if failed}
			<p role="alert" class="text-sm text-destructive">{m['oauth.developer.actionError']()}</p>
		{:else if loading}
			<div role="status">
				<Loader2 class="h-5 w-5 animate-spin" aria-hidden="true" />
				<span class="sr-only">{m['common.loading']()}</span>
			</div>
		{:else if app.data && scopes.data}
			{@const current = app.data}
			<div class="space-y-3">
				<div class="flex flex-wrap items-center gap-2">
					<StatusBadge
						tone="neutral"
						label={current.client_type === 'public'
							? m['oauth.developer.typePublic']()
							: m['oauth.developer.typeConfidential']()}
					/>
					<StatusBadge
						tone={current.is_active ? 'success' : 'neutral'}
						label={current.is_active
							? m['oauth.developer.active']()
							: m['oauth.developer.inactive']()}
					/>
					{#if current.verified}
						<StatusBadge tone="success" label={m['oauth.consent.verified']()} />
					{/if}
				</div>
				<div>
					<!-- Visual caption only: the field and its copy button are named by `label`. -->
					<p class="mb-1 text-sm font-bold" aria-hidden="true">
						{m['oauth.developer.secret.clientId']()}
					</p>
					<CopyField
						id="developer-app-client-id"
						value={current.client_id}
						label={m['oauth.developer.secret.clientId']()}
					/>
				</div>
			</div>

			<DeveloperAppForm
				mode="edit"
				initial={valuesFromApp(current)}
				vocabulary={scopes.data}
				submitting={update.isPending}
				{formError}
				{fieldErrors}
				onSubmit={submit}
			/>

			<DeveloperAppLogo
				app={current}
				uploading={logo.isPending}
				error={logoError}
				onUpload={(file) => logo.mutate({ id: appId, file })}
			/>

			<DeveloperAppDangerZone
				app={current}
				{busy}
				onRotate={() => openDialog({ kind: 'rotate' })}
				onToggleActive={() => openDialog({ kind: 'toggle', active: !current.is_active })}
				onDelete={() => openDialog({ kind: 'delete' })}
			/>
		{/if}
	{/key}
</div>

<div bind:this={dialogHost}>
	<ConfirmDialog
		isOpen={dialog !== null}
		title={dialog?.title ?? ''}
		message={dialog?.message ?? ''}
		confirmText={dialog?.confirmText}
		variant={dialog?.variant}
		onConfirm={confirm}
		onCancel={closeDialog}
	/>
</div>
