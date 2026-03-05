<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { createMutation, useQueryClient } from '@tanstack/svelte-query';
	import { organizationadmindiscountcodesCreateDiscountCode } from '$lib/api/generated/sdk.gen';
	import type { DiscountCodeCreateSchema } from '$lib/api/generated/types.gen';
	import { authStore } from '$lib/stores/auth.svelte';
	import { Button } from '$lib/components/ui/button';
	import { ArrowLeft } from 'lucide-svelte';
	import DiscountCodeForm from '$lib/components/discount-codes/DiscountCodeForm.svelte';

	const organization = $derived($page.data.organization);
	const accessToken = $derived(authStore.accessToken);
	const queryClient = useQueryClient();

	let errorMessage = $state('');

	const createMut = createMutation(() => ({
		mutationFn: async (data: DiscountCodeCreateSchema) => {
			const response = await organizationadmindiscountcodesCreateDiscountCode({
				path: { slug: organization.slug },
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
				throw new Error('Failed to create discount code');
			}
			return response.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['discount-codes'] });
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

		const payload: DiscountCodeCreateSchema = {
			code: formData.code,
			discount_type: formData.discount_type,
			discount_value: formData.discount_value,
			is_active: formData.is_active,
			max_uses_per_user: parseInt(formData.max_uses_per_user) || 1,
			min_purchase_amount: formData.min_purchase_amount || '0'
		};

		if (formData.currency) payload.currency = formData.currency;
		if (formData.valid_from) payload.valid_from = formData.valid_from;
		if (formData.valid_until) payload.valid_until = formData.valid_until;
		if (formData.max_uses) payload.max_uses = parseInt(formData.max_uses);
		if (formData.series_ids.length > 0) payload.series_ids = formData.series_ids;
		if (formData.event_ids.length > 0) payload.event_ids = formData.event_ids;
		if (formData.tier_ids.length > 0) payload.tier_ids = formData.tier_ids;

		createMut.mutate(payload);
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
			<h1 class="text-2xl font-bold tracking-tight">New Discount Code</h1>
			<p class="text-muted-foreground">Create a discount code for ticket checkout.</p>
		</div>
	</div>

	<!-- Form -->
	<DiscountCodeForm
		organizationId={organization.id}
		onSubmit={handleSubmit}
		isSubmitting={createMut.isPending}
		{errorMessage}
	/>
</div>
