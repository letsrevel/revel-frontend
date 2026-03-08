<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { toast } from 'svelte-sonner';
	import { Button } from '$lib/components/ui/button';
	import { Download, Loader2 } from 'lucide-svelte';
	import { exportGetExportStatus } from '$lib/api';
	import { PUBLIC_API_URL } from '$env/static/public';

	interface Props {
		label: string;
		/** Should trigger the export and return the export ID. */
		onExport: () => Promise<string>;
		accessToken: string | null;
		disabled?: boolean;
	}

	let { label, onExport, accessToken, disabled = false }: Props = $props();

	let isExporting = $state(false);

	const POLL_INTERVAL = 2000;
	const MAX_POLLS = 60;

	async function pollExportStatus(exportId: string): Promise<string> {
		if (!accessToken) {
			throw new Error('Missing access token');
		}

		for (let i = 0; i < MAX_POLLS; i++) {
			await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL));

			const response = await exportGetExportStatus({
				path: { export_id: exportId },
				headers: { Authorization: `Bearer ${accessToken}` }
			});

			if (response.error || !response.data) {
				throw new Error('Failed to check export status');
			}

			const exportData = response.data;

			if (exportData.status === 'failed') {
				throw new Error(exportData.error_message || 'Export failed');
			}

			if (exportData.download_url) {
				if (/^https?:\/\//.test(exportData.download_url)) {
					return exportData.download_url;
				}
				if (!PUBLIC_API_URL) {
					throw new Error('PUBLIC_API_URL is not configured');
				}
				return `${PUBLIC_API_URL.replace(/\/$/, '')}${exportData.download_url}`;
			}
		}

		throw new Error('Export timed out');
	}

	function triggerDownload(url: string) {
		const link = document.createElement('a');
		link.href = url;
		link.download = '';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	}

	async function handleExport() {
		if (isExporting) return;
		isExporting = true;
		try {
			const exportId = await onExport();
			toast.info(m['exportButton.exportStarted']());

			const downloadUrl = await pollExportStatus(exportId);
			triggerDownload(downloadUrl);
			toast.success(m['exportButton.exportReady']());
		} catch {
			toast.error(m['exportButton.exportError']());
		} finally {
			isExporting = false;
		}
	}
</script>

<Button
	variant="outline"
	size="sm"
	onclick={handleExport}
	disabled={disabled || isExporting || !accessToken}
>
	{#if isExporting}
		<Loader2 class="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
		{m['exportButton.exporting']()}
	{:else}
		<Download class="mr-2 h-4 w-4" aria-hidden="true" />
		{label}
	{/if}
</Button>
