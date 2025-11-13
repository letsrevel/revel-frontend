/**
 * Relative time formatting utilities
 */

import { getLocale } from '$lib/paraglide/runtime.js';

/**
 * Format a timestamp as relative time (e.g., "2 hours ago", "yesterday", "3 days ago")
 * @param dateString ISO 8601 date-time string
 * @returns Relative time string
 */
export function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffMs / (1000 * 60));
	const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
	const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	const locale = getLocale();

	// Just now (less than 30 seconds)
	if (diffSeconds < 30) {
		return locale === 'en' ? 'just now' : locale === 'de' ? 'gerade eben' : 'proprio ora';
	}

	// Less than a minute
	if (diffMinutes < 1) {
		return locale === 'en'
			? `${diffSeconds} seconds ago`
			: locale === 'de'
				? `vor ${diffSeconds} Sekunden`
				: `${diffSeconds} secondi fa`;
	}

	// Less than an hour
	if (diffMinutes < 60) {
		const unit = locale === 'en' ? 'minute' : locale === 'de' ? 'Minute' : 'minuto';
		const units = locale === 'en' ? 'minutes' : locale === 'de' ? 'Minuten' : 'minuti';
		const word = locale === 'en' ? 'ago' : locale === 'de' ? 'vor' : 'fa';

		if (locale === 'de') {
			return `vor ${diffMinutes} ${diffMinutes === 1 ? unit : units}`;
		}

		return locale === 'en'
			? `${diffMinutes} ${diffMinutes === 1 ? unit : units} ago`
			: `${diffMinutes} ${diffMinutes === 1 ? unit : units} fa`;
	}

	// Less than a day
	if (diffHours < 24) {
		const unit = locale === 'en' ? 'hour' : locale === 'de' ? 'Stunde' : 'ora';
		const units = locale === 'en' ? 'hours' : locale === 'de' ? 'Stunden' : 'ore';
		const word = locale === 'en' ? 'ago' : locale === 'de' ? 'vor' : 'fa';

		if (locale === 'de') {
			return `vor ${diffHours} ${diffHours === 1 ? unit : units}`;
		}

		return locale === 'en'
			? `${diffHours} ${diffHours === 1 ? unit : units} ago`
			: `${diffHours} ${diffHours === 1 ? unit : units} fa`;
	}

	// Yesterday
	if (diffDays === 1) {
		return locale === 'en' ? 'yesterday' : locale === 'de' ? 'gestern' : 'ieri';
	}

	// Less than a week
	if (diffDays < 7) {
		const unit = locale === 'en' ? 'day' : locale === 'de' ? 'Tag' : 'giorno';
		const units = locale === 'en' ? 'days' : locale === 'de' ? 'Tagen' : 'giorni';
		const word = locale === 'en' ? 'ago' : locale === 'de' ? 'vor' : 'fa';

		if (locale === 'de') {
			return `vor ${diffDays} ${units}`;
		}

		return locale === 'en' ? `${diffDays} ${units} ago` : `${diffDays} ${units} fa`;
	}

	// Less than a month
	const diffWeeks = Math.floor(diffDays / 7);
	if (diffWeeks < 4) {
		const unit = locale === 'en' ? 'week' : locale === 'de' ? 'Woche' : 'settimana';
		const units = locale === 'en' ? 'weeks' : locale === 'de' ? 'Wochen' : 'settimane';
		const word = locale === 'en' ? 'ago' : locale === 'de' ? 'vor' : 'fa';

		if (locale === 'de') {
			return `vor ${diffWeeks} ${diffWeeks === 1 ? unit : units}`;
		}

		return locale === 'en'
			? `${diffWeeks} ${diffWeeks === 1 ? unit : units} ago`
			: `${diffWeeks} ${diffWeeks === 1 ? unit : units} fa`;
	}

	// More than a month: show absolute date
	return date.toLocaleDateString(locale === 'en' ? 'en-US' : locale === 'de' ? 'de-DE' : 'it-IT', {
		month: 'short',
		day: 'numeric',
		year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
	});
}
