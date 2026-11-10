<script lang="ts">
	/**
	 * An email that wraps at sensible points instead of mid-word: a break
	 * opportunity right after "@" and before each dot. The <wbr> elements add no
	 * text, so the DOM text, the title and the accessible name stay the complete
	 * address. `overflow-wrap: anywhere` is the last resort for one huge label.
	 */
	interface Props {
		email: string;
		class?: string;
	}

	const { email, class: className }: Props = $props();

	const at = $derived(email.indexOf('@'));
	const local = $derived(at === -1 ? email : email.slice(0, at + 1));
	const domainParts = $derived(at === -1 ? [] : email.slice(at + 1).split('.'));
</script>

<span class="[overflow-wrap:anywhere] {className ?? ''}" title={email} data-testid="register-email"
	>{local}{#if domainParts.length}<wbr />{#each domainParts as part, i (i)}{#if i > 0}<wbr
				/>.{/if}{part}{/each}{/if}</span
>
