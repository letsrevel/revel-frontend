import type {
	QuestionnaireQuestion as Question,
	QuestionnaireSection as Section,
	QuestionType
} from '$lib/utils/questionnaire-form-types';
import {
	addTopLevelQuestion as _addTopLevelQuestion,
	removeTopLevelQuestion as _removeTopLevelQuestion,
	updateTopLevelQuestion as _updateTopLevelQuestion,
	addSection as _addSection,
	removeSection as _removeSection,
	updateSection as _updateSection,
	addQuestionToSection as _addQuestionToSection,
	removeQuestionFromSection as _removeQuestionFromSection,
	updateQuestionInSection as _updateQuestionInSection
} from '$lib/utils/questionnaire-form-helpers';

/**
 * Reactive questions/sections model shared by the questionnaire create (`new`)
 * and edit (`[id]`) admin pages. Both pages previously held byte-identical
 * copies of these `$state` fields plus wrapper/move functions; this class is
 * the single cohesive home for that model. Behaviour is unchanged — the
 * wrapper methods delegate to the pure helpers and reassign state exactly as
 * before, and the move methods keep the same `$state.snapshot` reorder logic.
 */
export class QuestionnaireBuilder {
	/** Top-level questions (not in any section). */
	topLevelQuestions = $state<Question[]>([]);
	/** Sections with their own questions. */
	sections = $state<Section[]>([]);

	/** Total question count across top-level questions and all sections. */
	get totalQuestionCount(): number {
		return (
			this.topLevelQuestions.length + this.sections.reduce((sum, s) => sum + s.questions.length, 0)
		);
	}

	/** All questions (top-level + section) flattened, for validation. */
	get allQuestions(): Question[] {
		return [...this.topLevelQuestions, ...this.sections.flatMap((s) => s.questions)];
	}

	// ===== Wrapper methods that delegate to pure helpers and reassign $state =====

	addTopLevelQuestion(type: QuestionType) {
		this.topLevelQuestions = _addTopLevelQuestion(this.topLevelQuestions, type);
	}

	removeTopLevelQuestion(id: string) {
		this.topLevelQuestions = _removeTopLevelQuestion(this.topLevelQuestions, id);
	}

	updateTopLevelQuestion(id: string, updates: Partial<Question>) {
		this.topLevelQuestions = _updateTopLevelQuestion(this.topLevelQuestions, id, updates);
	}

	addSection() {
		this.sections = _addSection(this.sections);
	}

	removeSection(id: string) {
		this.sections = _removeSection(this.sections, id);
	}

	updateSection(id: string, updates: Partial<Section>) {
		this.sections = _updateSection(this.sections, id, updates);
	}

	addQuestionToSection(sectionId: string, type: QuestionType) {
		this.sections = _addQuestionToSection(this.sections, sectionId, type);
	}

	removeQuestionFromSection(sectionId: string, questionId: string) {
		this.sections = _removeQuestionFromSection(this.sections, sectionId, questionId);
	}

	updateQuestionInSection(sectionId: string, questionId: string, updates: Partial<Question>) {
		this.sections = _updateQuestionInSection(this.sections, sectionId, questionId, updates);
	}

	// ===== Reorder (move) methods =====

	moveTopLevelQuestion(index: number, direction: 'up' | 'down') {
		const targetIndex = direction === 'up' ? index - 1 : index + 1;
		if (targetIndex < 0 || targetIndex >= this.topLevelQuestions.length) return;
		const snapshot = $state.snapshot(this.topLevelQuestions);
		[snapshot[index], snapshot[targetIndex]] = [snapshot[targetIndex], snapshot[index]];
		this.topLevelQuestions = snapshot.map((q, i) => ({ ...q, order: i }));
	}

	moveSection(index: number, direction: 'up' | 'down') {
		const targetIndex = direction === 'up' ? index - 1 : index + 1;
		if (targetIndex < 0 || targetIndex >= this.sections.length) return;
		const snapshot = $state.snapshot(this.sections);
		[snapshot[index], snapshot[targetIndex]] = [snapshot[targetIndex], snapshot[index]];
		this.sections = snapshot.map((s, i) => ({ ...s, order: i }));
	}

	moveQuestionInSection(sectionId: string, index: number, direction: 'up' | 'down') {
		const sectionSnapshot = $state.snapshot(this.sections);
		const section = sectionSnapshot.find((s) => s.id === sectionId);
		if (!section) return;
		const targetIndex = direction === 'up' ? index - 1 : index + 1;
		if (targetIndex < 0 || targetIndex >= section.questions.length) return;
		[section.questions[index], section.questions[targetIndex]] = [
			section.questions[targetIndex],
			section.questions[index]
		];
		section.questions = section.questions.map((q, i) => ({ ...q, order: i }));
		this.sections = sectionSnapshot;
	}
}
