import { render, screen, within } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import PollSettingWarnings from './PollSettingWarnings.svelte';

const base = {
	voteVisibility: 'members-only',
	resultVisibility: 'staff-only',
	resultTiming: 'after_close',
	status: 'open',
	orgVisibility: 'public',
	pollId: 'p1'
};

const list = () => screen.getByTestId('poll-warnings');
const warnIn = (id: string) => list().querySelector(`[data-warning-id="${id}"]`);

describe('PollSettingWarnings', () => {
	it('G2a: info when results are public but the timing is never', () => {
		render(PollSettingWarnings, {
			...base,
			resultVisibility: 'public',
			resultTiming: 'never'
		});
		expect(warnIn('G2a')).toHaveTextContent('Only staff see the poll results');
		expect(warnIn('G2b-visible')).toBeNull();
		expect(within(list()).getByRole('link', { name: 'Change result timing' })).toHaveAttribute(
			'href',
			'#result-timing'
		);
	});

	it('G2b-vote: restricted org with public vote visibility', () => {
		render(PollSettingWarnings, { ...base, voteVisibility: 'public', orgVisibility: 'private' });
		expect(warnIn('G2b-vote')).toHaveTextContent('Everyone can see and vote in this poll');
		expect(warnIn('G2b-vote')).not.toHaveTextContent('After you open the poll');
		expect(within(list()).getByRole('link', { name: 'Change vote visibility' })).toHaveAttribute(
			'href',
			'#vote-visibility'
		);
	});

	it('G2b-visible: restricted org with unlisted results', () => {
		render(PollSettingWarnings, {
			...base,
			resultVisibility: 'unlisted',
			orgVisibility: 'members-only'
		});
		expect(warnIn('G2b-visible')).toBeInTheDocument();
		expect(warnIn('G2b-vote')).toBeNull();
		expect(within(list()).getByRole('link', { name: 'Change result visibility' })).toHaveAttribute(
			'href',
			'#result-visibility'
		);
	});

	it('public organization: no G2b', () => {
		render(PollSettingWarnings, {
			...base,
			voteVisibility: 'public',
			resultVisibility: 'public',
			orgVisibility: 'public'
		});
		expect(warnIn('G2b-vote')).toBeNull();
		expect(warnIn('G2b-visible')).toBeNull();
	});

	it('create page (no poll id, draft) uses the draft wording and has no dismiss button', () => {
		render(PollSettingWarnings, {
			...base,
			pollId: undefined,
			status: 'draft',
			voteVisibility: 'public',
			orgVisibility: 'private'
		});
		expect(warnIn('G2b-vote')).toHaveTextContent('After you open the poll');
		expect(within(list()).queryByRole('button', { name: /dismiss/i })).toBeNull();
	});

	it('edit page: Info warning has a dismiss button', () => {
		render(PollSettingWarnings, { ...base, voteVisibility: 'public', orgVisibility: 'private' });
		expect(within(list()).getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
	});
});
