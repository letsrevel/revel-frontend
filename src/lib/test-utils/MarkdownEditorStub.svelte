<script lang="ts">
	/** jsdom stand-in for MarkdownEditor: a plain textarea bound to `value`, mounted synchronously. */
	interface Props {
		id?: string;
		label?: string;
		value?: string;
		placeholder?: string;
		rows?: number;
		disabled?: boolean;
		describedBy?: string;
		[key: string]: unknown;
	}
	let {
		id,
		label,
		value = $bindable(''),
		placeholder,
		rows,
		disabled,
		describedBy
	}: Props = $props();
</script>

<label for={id}>{label}</label>
<textarea {id} {placeholder} {rows} {disabled} aria-describedby={describedBy} bind:value></textarea>
