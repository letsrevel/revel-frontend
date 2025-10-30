/**
 * iCal (ICS) file generation utilities for calendar event downloads
 *
 * Generates RFC 5545 compliant iCalendar files that work with:
 * - Google Calendar
 * - Apple Calendar
 * - Outlook
 * - Other calendar applications
 */

interface ICalEvent {
	title: string;
	description?: string;
	location?: string;
	start: Date;
	end: Date;
	url?: string;
	organizerName?: string;
	organizerEmail?: string;
}

/**
 * Format a date as iCal DATETIME format (YYYYMMDDTHHMMSSZ in UTC)
 */
function formatICalDate(date: Date): string {
	const year = date.getUTCFullYear();
	const month = String(date.getUTCMonth() + 1).padStart(2, '0');
	const day = String(date.getUTCDate()).padStart(2, '0');
	const hours = String(date.getUTCHours()).padStart(2, '0');
	const minutes = String(date.getUTCMinutes()).padStart(2, '0');
	const seconds = String(date.getUTCSeconds()).padStart(2, '0');

	return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

/**
 * Escape special characters in iCal text fields
 */
function escapeICalText(text: string): string {
	return text
		.replace(/\\/g, '\\\\') // Backslash
		.replace(/;/g, '\\;') // Semicolon
		.replace(/,/g, '\\,') // Comma
		.replace(/\n/g, '\\n'); // Newline
}

/**
 * Fold long lines to 75 characters per RFC 5545
 */
function foldLine(line: string): string {
	const maxLength = 75;
	if (line.length <= maxLength) return line;

	const folded: string[] = [];
	let remaining = line;

	// First line gets maxLength characters
	folded.push(remaining.substring(0, maxLength));
	remaining = remaining.substring(maxLength);

	// Subsequent lines get maxLength - 1 (for the leading space)
	while (remaining.length > 0) {
		folded.push(' ' + remaining.substring(0, maxLength - 1));
		remaining = remaining.substring(maxLength - 1);
	}

	return folded.join('\r\n');
}

/**
 * Generate a unique UID for the calendar event
 */
function generateUID(eventId: string, domain: string = 'revel.events'): string {
	return `${eventId}@${domain}`;
}

/**
 * Generate an iCal file content for a single event
 */
export function generateICalFile(event: ICalEvent, eventId?: string): string {
	const now = new Date();
	const uid = generateUID(eventId || crypto.randomUUID());
	const dtstamp = formatICalDate(now);
	const dtstart = formatICalDate(event.start);
	const dtend = formatICalDate(event.end);

	const lines: string[] = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//Revel//Revel Events//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		'BEGIN:VEVENT',
		`UID:${uid}`,
		`DTSTAMP:${dtstamp}`,
		`DTSTART:${dtstart}`,
		`DTEND:${dtend}`,
		`SUMMARY:${escapeICalText(event.title)}`
	];

	if (event.description) {
		lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
	}

	if (event.location) {
		lines.push(`LOCATION:${escapeICalText(event.location)}`);
	}

	if (event.url) {
		lines.push(`URL:${event.url}`);
	}

	if (event.organizerName && event.organizerEmail) {
		lines.push(
			`ORGANIZER;CN=${escapeICalText(event.organizerName)}:mailto:${event.organizerEmail}`
		);
	}

	lines.push('STATUS:CONFIRMED');
	lines.push('SEQUENCE:0');
	lines.push('END:VEVENT');
	lines.push('END:VCALENDAR');

	// Fold long lines per RFC 5545
	return lines.map(foldLine).join('\r\n');
}

/**
 * Download an iCal file to the user's device
 */
export function downloadICalFile(content: string, filename: string): void {
	const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');

	link.href = url;
	link.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
	document.body.appendChild(link);
	link.click();

	// Cleanup
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

/**
 * Generate and download an iCal file for an event
 */
export function downloadEventICalFile(event: ICalEvent, eventId?: string, filename?: string): void {
	const icalContent = generateICalFile(event, eventId);
	const safeFilename = filename || event.title.replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'event';
	downloadICalFile(icalContent, safeFilename);
}

/**
 * Generate an iCal file from a Revel event schema
 */
export function generateICalFromRevelEvent(event: {
	id: string;
	name: string;
	description?: string | null;
	start: string;
	end: string;
	location?: string | null;
	venue_name?: string | null;
	organization?: {
		name: string;
		email?: string | null;
	};
}): string {
	// Format location
	let location = event.venue_name || event.location || undefined;

	// Create full URL to event
	const eventUrl =
		typeof window !== 'undefined' ? `${window.location.origin}/events/${event.id}` : undefined;

	return generateICalFile(
		{
			title: event.name,
			description: event.description || undefined,
			location: location,
			start: new Date(event.start),
			end: new Date(event.end),
			url: eventUrl,
			organizerName: event.organization?.name,
			organizerEmail: event.organization?.email || undefined
		},
		event.id
	);
}

/**
 * Download an iCal file for a Revel event
 */
export function downloadRevelEventICalFile(event: {
	id: string;
	name: string;
	description?: string | null;
	start: string;
	end: string;
	location?: string | null;
	venue_name?: string | null;
	organization?: {
		name: string;
		email?: string | null;
	};
}): void {
	const icalContent = generateICalFromRevelEvent(event);
	const filename = event.name.replace(/[^a-z0-9]/gi, '-').toLowerCase();
	downloadICalFile(icalContent, filename);
}
