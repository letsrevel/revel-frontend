<script lang="ts">
	import { Clock, Check, X } from 'lucide-svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { cn } from '$lib/utils/cn';

	interface Props {
		status: 'approved' | 'rejected' | 'pending review' | 'draft';
		class?: string;
	}

	let { status, class: className }: Props = $props();

	// Map status to display config
	let config = $derived.by(() => {
		switch (status) {
			case 'approved':
				return {
					icon: Check,
					label: 'Approved',
					variant: 'success' as const,
					className: 'bg-green-100 text-green-900 dark:bg-green-950 dark:text-green-100'
				};
			case 'rejected':
				return {
					icon: X,
					label: 'Rejected',
					variant: 'destructive' as const,
					className: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100'
				};
			case 'pending review':
				return {
					icon: Clock,
					label: 'Pending',
					variant: 'secondary' as const,
					className: 'bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-100'
				};
			case 'draft':
				return {
					icon: Clock,
					label: 'Draft',
					variant: 'outline' as const,
					className: 'bg-gray-100 text-gray-900 dark:bg-gray-900 dark:text-gray-100'
				};
		}
	});

	let IconComponent = $derived(config.icon);
</script>

<!--
  Submission Status Badge Component

  Displays the evaluation status of a questionnaire submission with appropriate
  icon and color coding.

  @component
  @example
  <SubmissionStatusBadge status="approved" />
  <SubmissionStatusBadge status="pending review" />
-->
<Badge class={cn(config.className, 'gap-1.5', className)}>
	<IconComponent class="h-3 w-3" aria-hidden="true" />
	<span>{config.label}</span>
</Badge>
