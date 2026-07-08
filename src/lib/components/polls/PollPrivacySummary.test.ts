import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import PollPrivacySummary from './PollPrivacySummary.svelte';
import type { PollResultTiming, ResourceVisibility } from '$lib/api/generated/types.gen';

// Row-visibility matrix for PollPrivacySummary.
//
// The component renders up to five rows:
//   - "Who can vote: {audience}"              (always visible)
//   - "Results visible to: {audience} ({when})"  (hidden whenever timing is "never" —
//     "visible to X (not shared)" would contradict itself)
//   - "Your identity is hidden from other voters" OR amber "visible to anyone who can see results"
//     (hidden when result_visibility=staff-only — other voters see nothing anyway)
//   - amber "Staff can see who voted what"    (only when staff_anonymous=false)
//   - "You can change or withdraw your vote"  (only when allow_vote_changes=true)
//
// This file locks down those rules with table-driven cases so future tweaks
// to the rendering logic can't silently regress the matrix that the smoke
// spec § F walks through.

interface Case {
	name: string;
	props: {
		voteVisibility: ResourceVisibility;
		resultVisibility: ResourceVisibility;
		resultTiming: PollResultTiming;
		staffAnonymous: boolean;
		publicAnonymous: boolean;
		allowVoteChanges: boolean;
	};
	expectVisible: string[];
	expectHidden: string[];
}

const cases: Case[] = [
	{
		name: 'C1 — public/public/after_vote, both anon, allow changes',
		props: {
			voteVisibility: 'public',
			resultVisibility: 'public',
			resultTiming: 'after_vote',
			staffAnonymous: true,
			publicAnonymous: true,
			allowVoteChanges: true
		},
		expectVisible: [
			'Who can vote: anyone',
			'Results visible to: anyone (after you vote)',
			'Your identity is hidden from other voters',
			'You can change or withdraw your vote'
		],
		expectHidden: [
			'Staff can see who voted what',
			'Your identity is visible to anyone who can see results'
		]
	},
	{
		name: 'C3 — private/private/after_close, public_anon=false → amber identity-visible chip',
		props: {
			voteVisibility: 'private',
			resultVisibility: 'private',
			resultTiming: 'after_close',
			staffAnonymous: true,
			publicAnonymous: false,
			allowVoteChanges: false
		},
		expectVisible: [
			'Who can vote: invited people only',
			'Results visible to: invited people only (after the poll closes)',
			'Your identity is visible to anyone who can see results'
		],
		expectHidden: [
			'Your identity is hidden from other voters',
			'You can change or withdraw your vote',
			'Staff can see who voted what'
		]
	},
	{
		name: 'C4 (form default) — members-only vote / staff-only results / never → rows 2+3 hidden',
		props: {
			voteVisibility: 'members-only',
			resultVisibility: 'staff-only',
			resultTiming: 'never',
			staffAnonymous: true,
			publicAnonymous: true,
			allowVoteChanges: true
		},
		expectVisible: ['Who can vote: members only', 'You can change or withdraw your vote'],
		expectHidden: [
			'Results visible to',
			'Your identity is hidden from other voters',
			'Staff can see who voted what'
		]
	},
	{
		name: 'C4 (spec) — members-only/members-only/never → row 2 hidden (timing "never" always skips it)',
		props: {
			voteVisibility: 'members-only',
			resultVisibility: 'members-only',
			resultTiming: 'never',
			staffAnonymous: true,
			publicAnonymous: true,
			allowVoteChanges: true
		},
		expectVisible: [
			'Who can vote: members only',
			'Your identity is hidden from other voters',
			'You can change or withdraw your vote'
		],
		expectHidden: ['Results visible to', 'Staff can see who voted what']
	},
	{
		name: 'C5 — staff-only/staff-only/after_vote + staff_anon=false → amber staff chip, row 3 hidden',
		props: {
			voteVisibility: 'staff-only',
			resultVisibility: 'staff-only',
			resultTiming: 'after_vote',
			staffAnonymous: false,
			publicAnonymous: true,
			allowVoteChanges: false
		},
		expectVisible: [
			'Who can vote: staff only',
			'Results visible to: staff only (after you vote)',
			'Staff can see who voted what'
		],
		expectHidden: [
			'Your identity is hidden from other voters',
			'Your identity is visible to anyone who can see results',
			'You can change or withdraw your vote'
		]
	},
	{
		name: 'staff-only + never → skip row 2 entirely',
		props: {
			voteVisibility: 'staff-only',
			resultVisibility: 'staff-only',
			resultTiming: 'never',
			staffAnonymous: true,
			publicAnonymous: true,
			allowVoteChanges: false
		},
		expectVisible: ['Who can vote: staff only'],
		expectHidden: [
			'Results visible to',
			'Your identity is hidden from other voters',
			'Staff can see who voted what',
			'You can change or withdraw your vote'
		]
	}
];

describe('PollPrivacySummary row visibility', () => {
	for (const c of cases) {
		it(c.name, () => {
			render(PollPrivacySummary, { props: c.props });

			for (const needle of c.expectVisible) {
				// Use a regex so partial-text matches catch the "Results visible to: ..."
				// row regardless of the specific interpolated audience/timing copy.
				const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
				expect(
					screen.queryByText(re),
					`expected to find "${needle}" in the rendered output`
				).not.toBeNull();
			}

			for (const needle of c.expectHidden) {
				const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
				expect(
					screen.queryByText(re),
					`expected NOT to find "${needle}" in the rendered output`
				).toBeNull();
			}
		});
	}
});
