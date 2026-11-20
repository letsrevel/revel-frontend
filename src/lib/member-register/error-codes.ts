import { z } from 'zod';
import { RegisterApiError } from './api';

/**
 * Backend 400 bodies carry a stable machine-readable `code`; the `detail` text
 * is translated and must never be matched on. The body is external data, so it
 * is validated with Zod before the code is trusted.
 */
const CodedBody = z.object({ code: z.string() });

export function errorCodeOf(body: unknown): string | null {
	const parsed = CodedBody.safeParse(body);
	return parsed.success ? parsed.data.code : null;
}

/** True for a failed register call (400) whose body carries exactly this `code`. */
export function isCodedRefusal(error: unknown, code: string): boolean {
	return (
		error instanceof RegisterApiError && error.status === 400 && errorCodeOf(error.body) === code
	);
}

/** The account already holds a membership row of any state. */
export const isAlreadyMember = (error: unknown): boolean => isCodedRefusal(error, 'already_member');
