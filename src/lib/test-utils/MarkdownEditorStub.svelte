<script lang="ts">
	/** jsdom stand-in for MarkdownEditor: a plain textarea bound to `value`, mounted synchronously. */
	interface Props {
		id?: string;
		label?: string;
		value?: string;
		placeholder?: string;
		rows?: number;
		disabled?: boolean;
		[key: string]: unknown;
	}
	let { id, label, value = $bindable(''), placeholder, rows, disabled }: Props = $props();
</script>

<label for={id}>{label}</label>
<textarea {id} {placeholder} {rows} {disabled} bind:value></textarea>
