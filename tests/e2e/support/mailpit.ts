/**
 * Mailpit client (https://mailpit.axllent.org/docs/api-v1/) for asserting
 * outbound email in E2E flows: registration verification, password reset,
 * invitations, transactional ticket emails, …
 *
 * Isolation convention: flows that trigger email should use a unique recipient
 * (e.g. `e2e+<runId>@example.com`) and search by that address — never assert on
 * "the latest message", which races against parallel workers.
 */

const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://localhost:8025';

export interface MailpitAddress {
	Name: string;
	Address: string;
}

export interface MailpitMessageSummary {
	ID: string;
	From: MailpitAddress;
	To: MailpitAddress[];
	ReplyTo?: MailpitAddress[];
	Subject: string;
	Created: string;
}

export interface MailpitMessage extends MailpitMessageSummary {
	Text: string;
	HTML: string;
}

async function mailpit<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetch(`${MAILPIT_URL}/api/v1${path}`, init);
	if (!response.ok) {
		throw new Error(`Mailpit ${path} → ${response.status}: ${await response.text()}`);
	}
	return (await response.json()) as T;
}

async function search(query: string): Promise<MailpitMessageSummary[]> {
	const data = await mailpit<{ messages: MailpitMessageSummary[] }>(
		`/search?query=${encodeURIComponent(query)}&limit=20`
	);
	return data.messages ?? [];
}

/**
 * The backend rewrites every recipient unless SiteSettings.live_emails is on:
 * `local@domain.tld` → `<catchall-user>+local_at_domain_dot_tld@<catchall-domain>`
 * (see revel-backend src/common/tasks.py to_safe_email_address). The catchall
 * user/domain are DB config; match the encoded local-part with a wildcard so
 * the helper works against both live and intercepted mailboxes.
 */
function interceptedForm(to: string): string {
	return to.replace('@', '_at_').replaceAll('.', '_dot_');
}

/**
 * Poll until an email to `to` (optionally with `subject` as a substring)
 * arrives; resolves with the full message (HTML + text bodies). Matches both
 * the raw recipient and the backend's intercepted (safe-rewritten) form.
 */
export async function waitForEmail(
	{ to, subject }: { to: string; subject?: string },
	timeoutMs = 20_000
): Promise<MailpitMessage> {
	const deadline = Date.now() + timeoutMs;
	const subjectPart = subject ? ` subject:"${subject}"` : '';
	const queries = [`to:"${to}"${subjectPart}`, `to:"+${interceptedForm(to)}@"${subjectPart}`];
	for (;;) {
		for (const query of queries) {
			const [match] = await search(query);
			if (match) {
				return await mailpit<MailpitMessage>(`/message/${match.ID}`);
			}
		}
		if (Date.now() > deadline) {
			throw new Error(`No email matching ${queries.join(' OR ')} within ${timeoutMs}ms`);
		}
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
}

/**
 * Extract the first link in the message (HTML preferred, text fallback) whose
 * URL matches `pattern` — e.g. /\/verify\?/ for the verification link.
 */
export function extractLink(message: MailpitMessage, pattern: RegExp): string {
	const hrefs = [...message.HTML.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
	const urls = [...message.Text.matchAll(/https?:\/\/\S+/g)].map((m) => m[0]);
	const link = [...hrefs, ...urls].find((url) => pattern.test(url));
	if (!link) {
		throw new Error(`No link matching ${pattern} in message "${message.Subject}"`);
	}
	// Entity-decode &amp; from HTML hrefs.
	return link.replaceAll('&amp;', '&');
}

/** Wipe the mailbox — use sparingly (it is shared across parallel workers). */
export async function deleteAllMessages(): Promise<void> {
	const response = await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' });
	if (!response.ok) {
		throw new Error(`Mailpit delete-all → ${response.status}`);
	}
}
