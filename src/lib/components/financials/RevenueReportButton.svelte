<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Download, Loader2 } from 'lucide-svelte';
	import {
		organizationadminrevenueCreateRevenueReport,
		organizationadminrevenueGetRevenueReport
	} from '$lib/api';
	import type { FileExportSchema } from '$lib/api/generated';
	import { getBackendUrl } from '$lib/config/api';
	import { periodToDateRange, type PeriodValue } from './period';

	interface Props {
		slug: string;
		/** The on-screen period; the report is scoped to the same range so its
		 * figures reconcile with the live view. */
		period: PeriodValue;
	}

	const { slug, period }: Props = $props();

	let isWorking = $state(false);

	const POLL_INTERVAL = 2000;
	const MAX_POLLS = 60;

	function isReady(report: FileExportSchema): boolean {
		return !!report.download_url;
	}

	function isFailed(report: FileExportSchema): boolean {
		return (report.status ?? '').toUpperCase() === 'FAILED';
	}

	async function pollUntilReady(exportId: string): Promise<string> {
		for (let i = 0; i < MAX_POLLS; i++) {
			await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));
			const response = await organizationadminrevenueGetRevenueReport({
				path: { slug, export_id: exportId }
			});
			if (response.error || !response.data) {
				throw new Error('Failed to poll revenue report');
			}
			if (isFailed(response.data)) {
				throw new Error(response.data.error_message || 'Revenue report failed');
			}
			if (isReady(response.data)) {
				return getBackendUrl(response.data.download_url as string);
			}
		}
		throw new Error('Revenue report timed out');
	}

	function triggerDownload(url: string) {
		const link = document.createElement('a');
		link.href = url;
		link.download = '';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	async function handleDownload() {
		if (isWorking) return;
		isWorking = true;
		try {
			const response = await organizationadminrevenueCreateRevenueReport({
				path: { slug },
				body: periodToDateRange(period)
			});
			if (response.error || !response.data) {
				throw new Error('Failed to create revenue report');
			}

			let url: string;
			if (isReady(response.data)) {
				// Cached report — available immediately, no polling needed.
				url = getBackendUrl(response.data.download_url as string);
			} else {
				toast.info(m['financials.report.generating']());
				url = await pollUntilReady(response.data.id as string);
			}
			triggerDownload(url);
			toast.success(m['financials.report.ready']());
		} catch {
			toast.error(m['financials.report.error']());
		} finally {
			isWorking = false;
		}
	}
</script>

<Button variant="outline" size="sm" onclick={handleDownload} disabled={isWorking}>
	{#if isWorking}
		<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
		{m['financials.report.working']()}
	{:else}
		<Download class="mr-2 h-4 w-4" aria-hidden="true" />
		{m['financials.report.download']()}
	{/if}
</Button>
