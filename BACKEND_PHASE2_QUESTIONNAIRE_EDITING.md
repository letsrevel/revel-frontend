# Backend Phase 2: Full Questionnaire Question Editing

## Context

We currently have a **metadata-only** questionnaire editing system in the frontend. Users can edit:
- Questionnaire name, type, evaluation mode
- Settings (shuffle options, LLM guidelines, durations)
- Wrapper fields (max_submission_age, questionnaire_type)

**What's missing:** The ability to edit, add, or delete **questions and sections** after creation.

## Current Limitations

### Frontend Implementation
- Questions display as **read-only** in edit mode
- Warning banner: "Questions cannot be edited after creation"
- This is intentional to preserve submission integrity

### Backend API Structure
The current API requires **multiple granular calls** to modify questions:

```python
# To update a question, you must:
PUT /api/questionnaires/{id}/multiple-choice-questions/{question_id}
PUT /api/questionnaires/{id}/free-text-questions/{question_id}

# To update sections:
PUT /api/questionnaires/{id}/sections/{section_id}

# To update MC question options:
# Must PUT entire question with all options recreated
PUT /api/questionnaires/{id}/multiple-choice-questions/{question_id}
body: {
    # Must include ALL options, not just changed ones
    options: [...all options with new ones added/edited]
}
```

This creates a **complex state management problem** on the frontend:
1. Track which questions were added/edited/deleted
2. Generate correct API calls for each change
3. Handle order changes (requires updating all questions)
4. Manage option changes for MC questions

## Phase 2 Goals

Add the ability to **edit questionnaire structure** (sections/questions) while preserving data integrity.

### User Stories

1. **As an admin**, I want to fix typos in questions without creating a new questionnaire
2. **As an admin**, I want to add new questions to an existing questionnaire
3. **As an admin**, I want to reorder questions for better UX
4. **As an admin**, I want to remove questions that are no longer relevant
5. **As an admin**, I want to edit MC options (add/remove/reword)

### Critical Requirements

1. **Submission Integrity**
   - Prevent breaking changes that invalidate existing submissions
   - Consider versioning questionnaires if submissions exist
   - Warn admins when editing questionnaires with submissions

2. **Evaluation Impact**
   - Changing scoring (positive_weight, negative_weight, is_fatal) affects evaluations
   - Changing MC correct answers affects scoring
   - Consider: freeze structure once submissions exist?

3. **Data Migration**
   - How do we handle submissions if question structure changes?
   - Archive old submissions? Mark them as "evaluated under old version"?

## Proposed Backend Changes

### Option A: Bulk Update Endpoints (Recommended)

Add endpoints that accept the **entire questionnaire structure** and diff/update atomically.

```python
# New endpoint
PUT /api/questionnaires/{org_questionnaire_id}/structure
body: {
    sections: [
        {
            id: uuid | null,  # null = new section
            name: str,
            order: int,
            multiplechoicequestion_questions: [
                {
                    id: uuid | null,  # null = new question
                    question: str,
                    is_mandatory: bool,
                    order: int,
                    # ... all question fields
                    options: [
                        {
                            id: uuid | null,  # null = new option
                            option: str,
                            is_correct: bool,
                            order: int
                        }
                    ]
                }
            ],
            freetextquestion_questions: [...]
        }
    ],
    multiplechoicequestion_questions: [...],  # top-level questions
    freetextquestion_questions: [...]
}

# Backend logic:
# 1. Diff incoming structure with existing structure
# 2. Identify adds (id=null), updates (id=existing), deletes (missing ids)
# 3. Apply changes atomically in transaction
# 4. Validate scoring weights, order consistency
# 5. Check if submissions exist, apply business rules
```

**Advantages:**
- Frontend sends entire state once
- Backend handles complexity of diffing/updating
- Atomic transaction ensures consistency
- Easier to add validation rules

**Implementation Notes:**
- Use Django transactions
- Create service layer function `update_questionnaire_structure()`
- Add validation for breaking changes
- Consider adding `has_submissions` flag to response

### Option B: Enhanced Granular Endpoints

Improve existing endpoints to handle batch operations.

```python
# Batch update questions
PUT /api/questionnaires/{id}/questions/batch
body: {
    multiple_choice: [
        {id: uuid | null, ...},  # Upsert logic
    ],
    free_text: [...]
}

# Batch delete
DELETE /api/questionnaires/{id}/questions/batch
body: {
    question_ids: [uuid, uuid, ...]
}
```

**Advantages:**
- Less breaking change to existing API
- Can reuse existing validators/services

**Disadvantages:**
- Still requires multiple API calls from frontend
- Harder to ensure atomic updates
- Order management is complex

### Option C: Versioned Questionnaires (Future Consideration)

Create a new questionnaire version when structure changes if submissions exist.

```python
POST /api/questionnaires/{id}/create-version
body: { ... updated structure }

# Creates QuestionnaireVersion model
# Old submissions reference old version
# New submissions use new version
```

**Advantages:**
- Perfect data integrity
- Historical tracking
- Can compare versions

**Disadvantages:**
- Most complex to implement
- Database schema changes required
- May confuse users

## Validation Rules to Implement

### Breaking Changes (Require Warning)
- Changing question text significantly
- Changing MC correct answers
- Changing scoring weights
- Removing questions
- Changing question order

### Safe Changes
- Fixing typos (minor text edits)
- Adding new questions
- Adding new options to MC questions
- Changing is_mandatory flag
- Updating section names

### Business Rules
1. **If questionnaire has 0 submissions:**
   - Allow all changes freely

2. **If questionnaire has submissions:**
   - **Metadata changes:** Always allowed
   - **Question additions:** Allowed (don't affect existing submissions)
   - **Question deletions:** Allowed but warn (submissions will have orphaned answers)
   - **Question edits:** Allowed but warn (may affect evaluation)
   - **Scoring changes:** Allowed but warn (requires re-evaluation?)

3. **If questionnaire has evaluations:**
   - Consider freezing structure entirely OR
   - Require creating new version

## Database Considerations

### Current Schema
```python
class Questionnaire(models.Model):
    name = models.CharField(...)
    # ... settings fields

class QuestionnaireSection(models.Model):
    questionnaire = models.ForeignKey(Questionnaire)
    name = models.CharField(...)
    order = models.PositiveIntegerField()

class MultipleChoiceQuestion(models.Model):
    questionnaire = models.ForeignKey(Questionnaire)
    section = models.ForeignKey(QuestionnaireSection, null=True)
    question = models.TextField()
    order = models.PositiveIntegerField()
    # ... scoring fields

class MultipleChoiceOption(models.Model):
    question = models.ForeignKey(MultipleChoiceQuestion)
    option = models.CharField(...)
    is_correct = models.BooleanField()
    order = models.PositiveIntegerField()
```

### Potential Schema Additions

```python
# Option 1: Add versioning
class QuestionnaireVersion(models.Model):
    questionnaire = models.ForeignKey(Questionnaire)
    version_number = models.IntegerField()
    created_at = models.DateTimeField()
    structure_snapshot = models.JSONField()  # Full JSON snapshot

class QuestionnaireSubmission(models.Model):
    questionnaire = models.ForeignKey(Questionnaire)
    questionnaire_version = models.ForeignKey(QuestionnaireVersion, null=True)
    # ...

# Option 2: Add change tracking
class QuestionnaireEditLog(models.Model):
    questionnaire = models.ForeignKey(Questionnaire)
    user = models.ForeignKey(User)
    changed_at = models.DateTimeField()
    change_type = models.CharField()  # "question_added", "question_edited", etc.
    change_data = models.JSONField()
```

## Frontend Implementation (Phase 2)

Once backend supports this, the frontend would:

1. **Load questionnaire** with all sections/questions
2. **Enable editing mode** for questions
   - Use same `QuestionEditor.svelte` from creation flow
   - Track local state (adds/edits/deletes)
3. **On save**, send entire structure to bulk endpoint
4. **Show warnings** if questionnaire has submissions
5. **Confirm breaking changes** with modal dialog

## Testing Requirements

### Backend Tests
1. Test bulk update with various scenarios
2. Test validation rules (breaking changes)
3. Test submission integrity after edits
4. Test transaction rollback on errors
5. Test permission checks

### Frontend Tests (Future)
1. Test edit flow with existing questions
2. Test adding/removing questions
3. Test reordering questions
4. Test option editing for MC questions
5. Test warning modals for breaking changes

## Rollout Plan

### Phase 2.1 (MVP)
1. Add bulk structure update endpoint
2. Add validation for breaking changes
3. Add `has_submissions` flag to GET endpoint
4. Update frontend to check flag and show warnings

### Phase 2.2 (Enhanced)
1. Add edit mode for questions in frontend
2. Implement local state management
3. Add confirmation modals for breaking changes
4. Add ability to preview changes before save

### Phase 2.3 (Advanced)
1. Add questionnaire versioning
2. Add change log/audit trail
3. Add ability to compare versions
4. Add ability to rollback changes

## Questions for Discussion

1. **What's the priority?** Do users urgently need to edit questions, or is metadata-only sufficient for now?

2. **Submission integrity:** Should we freeze structure once submissions exist? Or allow edits with warnings?

3. **Evaluation impact:** If scoring changes, should we re-evaluate existing submissions?

4. **Versioning:** Is full versioning overkill, or necessary for audit trail?

5. **UI/UX:** How do we balance power (edit anything) vs. safety (prevent breaking changes)?

## Recommended Implementation Order

1. **Start with Option A** (bulk update endpoint)
   - Simplest for frontend
   - Backend controls complexity
   - Can add validation incrementally

2. **Add `has_submissions` check first**
   - Minimal backend change
   - Allows frontend to show warnings
   - Prevents most issues upfront

3. **Implement business rules gradually**
   - Start: allow all edits if no submissions
   - Add: warnings for breaking changes
   - Future: add versioning if needed

4. **Test thoroughly with existing data**
   - Ensure no data loss
   - Ensure submissions remain valid
   - Test edge cases (orphaned answers, etc.)

## Code Structure

```
revel-backend/src/
├── events/
│   ├── controllers/
│   │   └── questionnaire.py  # Add new bulk endpoint
│   ├── services/
│   │   └── questionnaire_editor.py  # NEW: Bulk update logic
│   └── validators/
│       └── questionnaire_changes.py  # NEW: Validation rules
└── questionnaires/
    └── service.py  # Existing QuestionnaireService to enhance
```

### Example Service Implementation

```python
# events/services/questionnaire_editor.py
from django.db import transaction

class QuestionnaireStructureEditor:
    def __init__(self, org_questionnaire: OrganizationQuestionnaire):
        self.org_questionnaire = org_questionnaire
        self.questionnaire = org_questionnaire.questionnaire
        self.has_submissions = self.questionnaire.questionnaire_submissions.exists()

    @transaction.atomic
    def update_structure(self, structure_data: dict) -> OrganizationQuestionnaire:
        """Update entire questionnaire structure atomically"""
        # 1. Validate changes
        self._validate_changes(structure_data)

        # 2. Diff structure
        existing_ids = self._collect_existing_ids()
        incoming_ids = self._collect_incoming_ids(structure_data)

        # 3. Apply changes
        self._apply_section_changes(structure_data['sections'], existing_ids, incoming_ids)
        self._apply_question_changes(structure_data, existing_ids, incoming_ids)

        # 4. Delete removed items
        self._delete_removed_items(existing_ids, incoming_ids)

        # 5. Refresh and return
        self.org_questionnaire.refresh_from_db()
        return self.org_questionnaire

    def _validate_changes(self, structure_data: dict):
        """Validate that changes won't break existing submissions"""
        if not self.has_submissions:
            return  # All changes allowed

        # Check for breaking changes
        breaking_changes = self._detect_breaking_changes(structure_data)
        if breaking_changes:
            # Log warning or raise ValidationError
            pass
```

## Summary

**Recommended approach:** Implement **Option A (bulk update endpoint)** with:
1. Single endpoint that accepts entire structure
2. Backend diff/update logic
3. Validation rules for breaking changes
4. `has_submissions` flag to control edit permissions
5. Gradual rollout starting with metadata-only (current state)

This balances complexity, safety, and user needs while providing a clear path to full editing capabilities.

Let me know which approach you prefer, and I can provide more detailed implementation guidance.
