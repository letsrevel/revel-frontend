<script lang="ts">
	/**
	 * An email that wraps at sensible points instead of mid-word: a break
	 * opportunity before each dot and right after "@". The <wbr> elements add no
	 * text, so the DOM text, the title and the accessible name stay the complete
	 * address. `overflow-wrap: break-word` is the last resort for one huge label
	 * (unlike `anywhere`, it does not collapse the column's min-content width).
	 */
	interface Props {
		email: string;
		class?: string;
	}

	const { email, class: className }: Props = $props();

	const at = $derived(email.indexOf('@'));
	const localParts = $derived((at === -1 ? email : email.slice(0, at)).split('.'));
	const domainParts = $derived(at === -1 ? [] : email.slice(at + 1).split('.'));
</script>

<span
	class="[overflow-wrap:break-word] {className ?? ''}"
	title={email}
	data-testid="register-email"
	>{#each localParts as part, i (i)}{#if i > 0}<wbr />.{/if}{part}{/each}{#if at !== -1}@<wbr
		/>{#each domainParts as part, i (i)}{#if i > 0}<wbr />.{/if}{part}{/each}{/if}</span
>
