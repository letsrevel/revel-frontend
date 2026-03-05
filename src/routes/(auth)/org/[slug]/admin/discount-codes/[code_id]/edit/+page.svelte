<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { createQuery, createMutation, useQueryClient } from '@tanstack/svelte-query';
	import {
		organizationadmindiscountcodesGetDiscountCode,
		organizationadmindiscountcodesUpdateDiscountCode
	} from '$lib/api/generated/sdk.gen';
	import type { DiscountCodeUpdateSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Alert, AlertDescription } from '$lib/components/ui/alert';
	import { ArrowLeft, AlertCircle } from 'lucide-svelte';
	import DiscountCodeForm from '$lib/components/discount-codes/DiscountCodeForm.svelte';

	const organization = $derived($page.data.organization);
	const codeId = $derived($page.params.code_id);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	let errorMessage = $state('');

	// Fetch existing code
	const codeQuery = createQuery(() => ({
		queryKey: ['discount-code', organization.slug, codeId],
		queryFn: async () => {
			const response = await organizationadmindiscountcodesGetDiscountCode({
				path: { slug: organization.slug, code_id: codeId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) throw new Error('Failed to load discount code');
			return response.data;
		}
	}));

	const existingCode = $derived(codeQuery.data ?? null);

	// Update mutation
	const updateMut = createMutation(() => ({
		mutationFn: async (data: DiscountCodeUpdateSchema) => {
			const response = await organizationadmindiscountcodesUpdateDiscountCode({
				path: { slug: organization.slug, code_id: codeId },
				body: data,
				headers: { Authorization: `Bearer ${accessToken}` }
			});
			if (response.error) {
				const err = response.error as any;
				const detail = err?.detail;
				if (typeof detail === 'string') throw new Error(detail);
				if (Array.isArray(detail)) {
					throw new Error(detail.map((d: any) => d.msg || String(d)).join(', '));
				}
				throw new Error('Failed to update discount code');
			}
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
			queryClient.invalidateQueries({ queryKey: ['discount-code', organization.slug, codeId] });
			goto(`/org/${organization.slug}/admin/discount-codes`);
		},
		onError: (err: Error) => {
			errorMessage = err.message;
		}
	}));

	async function handleSubmit(formData: {
		code: string;
		discount_type: 'percentage' | 'fixed_amount';
		discount_value: string;
		currency: string;
		valid_from: string;
		valid_until: string;
		max_uses: string;
		max_uses_per_user: string;
		min_purchase_amount: string;
		is_active: boolean;
		series_ids: string[];
		event_ids: string[];
		tier_ids: string[];
	}) {
		errorMessage = '';

		const payload: DiscountCodeUpdateSchema = {
			discount_type: formData.discount_type,
			discount_value: formData.discount_value,
			is_active: formData.is_active,
			max_uses_per_user: parseInt(formData.max_uses_per_user) || 1,
			min_purchase_amount: formData.min_purchase_amount || '0',
			currency: formData.currency || null,
			valid_from: formData.valid_from || null,
			valid_until: formData.valid_until || null,
			max_uses: formData.max_uses ? parseInt(formData.max_uses) : null,
			series_ids: formData.series_ids.length > 0 ? formData.series_ids : null,
			event_ids: formData.event_ids.length > 0 ? formData.event_ids : null,
			tier_ids: formData.tier_ids.length > 0 ? formData.tier_ids : null
		};

		updateMut.mutate(payload);
	}
</script>

<div class="mx-auto max-w-2xl space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-4">
		<Button
			variant="ghost"
			size="icon"
			onclick={() => goto(`/org/${organization.slug}/admin/discount-codes`)}
			aria-label="Back to discount codes"
		>
			<ArrowLeft class="h-5 w-5" />
		</Button>
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Edit Discount Code</h1>
			{#if existingCode}
				<p class="text-muted-foreground">
					Editing <span class="font-mono font-semibold">{existingCode.code}</span>
				</p>
			{/if}
		</div>
	</div>

	<!-- Content -->
	{#if codeQuery.isLoading}
		<div class="flex items-center justify-center py-12">
			<div
				class="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"
				aria-label="Loading discount code"
			></div>
		</div>
	{:else if codeQuery.error}
		<Alert variant="destructive">
			<AlertCircle class="h-4 w-4" />
			<AlertDescription>Failed to load discount code. It may have been deleted.</AlertDescription>
		</Alert>
	{:else if existingCode}
		<DiscountCodeForm
			organizationId={organization.id}
			{existingCode}
			onSubmit={handleSubmit}
			isSubmitting={updateMut.isPending}
			{errorMessage}
		/>
	{/if}
</div>
