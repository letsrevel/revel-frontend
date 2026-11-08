import type { StepResult, VereinPlanStep } from './verein-preset';

/**
 * Outcome of the last Verein preset run, kept per event for the lifetime of the
 * page. Closing the dialog after a partial run must not forget which steps
 * already created something, or reopening would offer a fresh run that
 * duplicates them.
 */
export interface VereinRunMemory {
	results: StepResult[];
	plan: VereinPlanStep[];
}

const memory = new Map<string, VereinRunMemory>();

export function rememberVereinRun(eventId: string, run: VereinRunMemory): void {
	// Only a run that left something behind (a finished step, or a failure that
	// may have committed) is worth restoring. A clean 4xx failure created nothing,
	// so reopening shows the form again and the user can fix the input.
	const leftSomething = run.results.some(
		(r) => r.status === 'done' || (r.status === 'failed' && r.ambiguous)
	);
	if (leftSomething) {
		memory.set(eventId, { results: run.results.map((r) => ({ ...r })), plan: run.plan });
	} else {
		memory.delete(eventId);
	}
}

export function recallVereinRun(eventId: string): VereinRunMemory | null {
	return memory.get(eventId) ?? null;
}

export function forgetVereinRun(eventId: string): void {
	memory.delete(eventId);
}
