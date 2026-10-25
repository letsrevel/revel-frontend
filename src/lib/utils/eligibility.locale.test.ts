import { afterEach, describe, expect, it } from 'vitest';
import { setLocale } from '$lib/paraglide/runtime.js';
import {
	getActionButtonText,
	getMissingProfileFieldLabel,
	getNextStepMessage
} from './eligibility';
import { formatVisibilityLabel } from './event-labels';

afterEach(() => setLocale('en', { reload: false }));

describe('eligibility copy follows the app UI locale', () => {
	it('returns English for en', () => {
		setLocale('en', { reload: false });
		expect(getNextStepMessage('complete_questionnaire')).toBe(
			'Complete the required questionnaire to attend'
		);
		expect(getActionButtonText('complete_profile')).toBe('Complete Profile');
	});

	it('returns German, not English, for de', () => {
		setLocale('de', { reload: false });
		expect(getNextStepMessage('complete_questionnaire')).toBe(
			'Fülle den erforderlichen Fragebogen aus, um teilzunehmen'
		);
		expect(getActionButtonText('complete_profile')).toBe('Profil vervollständigen');
		expect(getMissingProfileFieldLabel('profile_picture')).toBe('Profilbild');
		expect(formatVisibilityLabel('unlisted')).toBe('Nicht gelistet');
	});
});
