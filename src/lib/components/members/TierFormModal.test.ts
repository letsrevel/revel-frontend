import { render, screen, waitFor, within } from '@testing-library/svelte';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import type { ComponentProps } from 'svelte';
import TierFormModal from './TierFormModal.svelte';
import type {
	MembershipTierAdminSchema,
	OrganizationQuestionnaireInListSchema
} from '$lib/api/generated/types.gen';

const vibeCheck = {
	id: 'oq-1',
	questionnaire_type: 'membership',
	members_exempt: false,
	per_event: false,
	requires_evaluation: false,
	questionnaire: { id: 'q-1', name: 'Vibe check', status: 'published' }
} as unknown as OrganizationQuestionnaireInListSchema;

const goldTier: MembershipTierAdminSchema = {
	id: 't1',
	name: 'Gold',
	description: '',
	display_order: 0,
	membership_questionnaire_id: 'oq-1',
	requires_membership_approval: false
};

/**
 * Render the modal and wait for bits-ui's dialog auto-focus to land.
 *
 * The focus scope moves focus into the dialog from a `requestAnimationFrame`
 * scheduled at mount; under parallel-suite CPU contention it can land between
 * two of user-event's ~1ms keystrokes and swallow the rest of the word. The
 * steal happens exactly once per mount, so waiting for it before touching the
 * form removes the race rather than papering over it (same idiom as
 * `PlanFormModal.test.ts`).
 */
async function renderModal(props: Partial<ComponentProps<typeof TierFormModal>> = {}) {
	const result = render(TierFormModal, {
		props: {
			tier: null,
			open: true,
			onClose: vi.fn(),
			onSave: vi.fn(),
			membershipQuestionnaires: [],
			orgDefaultRequiresApproval: false,
			...props
		}
	});
	await waitFor(() => expect(document.body).not.toHaveFocus());
	return result;
}

describe('TierFormModal eligibility overrides', () => {
	it('defaults both overrides to inherit when creating a tier', async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		await renderModal({ onSave, membershipQuestionnaires: [vibeCheck] });

		await user.type(screen.getByLabelText(/tier name/i), 'Gold');
		await user.click(screen.getByRole('button', { name: /create tier/i }));

		expect(onSave).toHaveBeenCalledWith({
			name: 'Gold',
			description: '',
			membership_questionnaire_id: null,
			requires_membership_approval: null
		});
	});

	it('prefills the overrides when editing and round-trips them unchanged', async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		await renderModal({ tier: goldTier, onSave, membershipQuestionnaires: [vibeCheck] });

		const questionnaire = screen.getByLabelText(/membership questionnaire/i);
		expect(questionnaire).toHaveValue('oq-1');
		expect(within(questionnaire).getByRole('option', { name: 'Vibe check' })).toBeInTheDocument();

		const approval = screen.getByLabelText(/manual approval/i);
		expect(approval).toHaveValue('norequire');
		expect(
			within(approval).getByRole('option', { name: /don't require approval/i })
		).toBeInTheDocument();

		await user.click(screen.getByRole('button', { name: /update tier/i }));

		expect(onSave).toHaveBeenCalledWith({
			name: 'Gold',
			description: '',
			membership_questionnaire_id: 'oq-1',
			requires_membership_approval: false
		});
	});

	it('round-trips the approval tri-state through require and back to inherit', async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		await renderModal({ tier: goldTier, onSave, membershipQuestionnaires: [vibeCheck] });

		const approval = screen.getByLabelText(/manual approval/i);

		await user.selectOptions(approval, 'require');
		await user.click(screen.getByRole('button', { name: /update tier/i }));
		expect(onSave).toHaveBeenLastCalledWith(
			expect.objectContaining({ requires_membership_approval: true })
		);

		await user.selectOptions(approval, 'inherit');
		await user.click(screen.getByRole('button', { name: /update tier/i }));
		expect(onSave).toHaveBeenLastCalledWith(
			expect.objectContaining({ requires_membership_approval: null })
		);
	});

	it('clears the questionnaire override back to inherit', async () => {
		const user = userEvent.setup();
		const onSave = vi.fn();
		await renderModal({ tier: goldTier, onSave, membershipQuestionnaires: [vibeCheck] });

		await user.selectOptions(screen.getByLabelText(/membership questionnaire/i), '');
		await user.click(screen.getByRole('button', { name: /update tier/i }));

		expect(onSave).toHaveBeenLastCalledWith(
			expect.objectContaining({ membership_questionnaire_id: null })
		);
	});

	it('spells out an org default of "approval required" in the inherit option', async () => {
		await renderModal({ orgDefaultRequiresApproval: true });
		const approval = screen.getByLabelText(/manual approval/i);
		expect(within(approval).getByRole('option', { name: /approval required/i })).toHaveValue(
			'inherit'
		);
	});

	it('spells out an org default of "no approval required" in the inherit option', async () => {
		await renderModal({ orgDefaultRequiresApproval: false });
		const approval = screen.getByLabelText(/manual approval/i);
		expect(within(approval).getByRole('option', { name: /no approval required/i })).toHaveValue(
			'inherit'
		);
	});
});
