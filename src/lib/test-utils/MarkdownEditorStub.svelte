<script lang="ts">
	/** jsdom stand-in for MarkdownEditor: a plain textarea bound to `value`, mounted synchronously. */
	interface Props {
		id?: string;
		label?: string;
		value?: string;
		[key: string]: unknown;
	}
	let { id, label, value = $bindable(''), ...rest }: Props = $props();
	void rest;
</script>

<label for={id}>{label}</label>
<textarea {id} bind:value></textarea>
