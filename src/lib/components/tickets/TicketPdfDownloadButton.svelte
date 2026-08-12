<script lang="ts">
	import * as m from '$lib/paraglide/messages.js';
	import { ticketwalletDownloadPdf } from '$lib/api/generated/sdk.gen';
	import { toast } from 'svelte-sonner';
	import PdfDownloadButton from '$lib/components/common/PdfDownloadButton.svelte';
	import { saveBlob } from '$lib/utils/download';
	import { toFilenameSlug } from '$lib/utils/filename';

	interface Props {
		ticketId: string;
		/** Event name — used only for the downloaded filename. */
		eventName?: string;
	}

	const { ticketId, eventName = '' }: Props = $props();

	const safeName = $derived(toFilenameSlug(eventName, 'ticket'));

	async function downloadPdf(): Promise<void> {
		try {
			// Always through the endpoint, never the ticket's own pre-signed
			// `pdf_url`: that path opened a new tab (popup-blockable, and the
			// filename came from the storage key). The endpoint handles generation
			// and caching and redirects to the same object, which fetch follows.
			const response = await ticketwalletDownloadPdf({
				path: { ticket_id: ticketId },
				parseAs: 'stream'
			});
			if (!response.response?.ok) {
				toast.error(
					response.response?.status === 404
						? m['downloadPdf.notFound']()
						: m['downloadPdf.failed']()
				);
				return;
			}
			saveBlob(await response.response.blob(), `${safeName}-ticket.pdf`);
		} catch (err) {
			// Raw error text is unlocalized and may carry backend detail: the old
			// inline alert rendered `err.message` verbatim. Log it, show the
			// localized line — the same rule the wallet badges follow.
			console.error('Failed to download ticket PDF:', err);
			toast.error(m['downloadPdf.failed']());
		}
	}
</script>

<PdfDownloadButton onDownload={downloadPdf} />
