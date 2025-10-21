import typing as t
from uuid import UUID

from django.db import transaction
from django.db.models import QuerySet
from django.shortcuts import get_object_or_404
from ninja_extra import (
    api_controller,
    route,
)
from ninja_extra.pagination import PageNumberPaginationExtra, PaginatedResponseSchema, paginate
from ninja_extra.searching import Searching, searching
from ninja_jwt.authentication import JWTAuth

from accounts.models import RevelUser
from common.schema import ValidationErrorResponse
from common.throttling import UserDefaultThrottle, WriteThrottle
from events import models as event_models
from events import schema as event_schema
from events.service import update_organization_questionnaire
from questionnaires import models as questionnaires_models
from questionnaires import schema as questionnaire_schema
from questionnaires.service import QuestionnaireService

from .permissions import OrganizationPermission, QuestionnairePermission
from .user_aware_controller import UserAwareController


@api_controller("/questionnaires", auth=JWTAuth(), tags=["Questionnaires"], throttle=WriteThrottle())
class QuestionnaireController(UserAwareController):
    def get_queryset(self) -> QuerySet[event_models.OrganizationQuestionnaire]:
        """Get the queryset based on the user."""
        return event_models.OrganizationQuestionnaire.objects.for_user(self.user())

    def get_organization_queryset(self) -> QuerySet[event_models.Organization]:
        """Get the queryset for the organization."""
        return event_models.Organization.objects.for_user(self.user())

    def user(self) -> RevelUser:
        """Get a user for this request."""
        return t.cast(RevelUser, self.context.request.user)  # type: ignore[union-attr]

    @route.get(
        "/",
        url_name="list_org_questionnaires",
        response=PaginatedResponseSchema[event_schema.OrganizationQuestionnaireInListSchema],
        throttle=UserDefaultThrottle(),
    )
    @paginate(PageNumberPaginationExtra, page_size=20)
    @searching(Searching, search_fields=["questionnaire__name", "events__name", "event_series__name"])
    def list_org_questionnaires(self) -> QuerySet[event_models.OrganizationQuestionnaire]:
        """Browse questionnaires you have permission to view or manage.

        Returns questionnaires from organizations where you have staff/owner access. Use this to
        find questionnaires to attach to events or review submissions.
        """
        return self.get_queryset()

    @route.post(
        "/{organization_id}/create-questionnaire",
        url_name="create_questionnaire",
        response={200: event_schema.OrganizationQuestionnaireSchema, 400: ValidationErrorResponse},
        auth=JWTAuth(),
        permissions=[OrganizationPermission("create_questionnaire")],
    )
    def create_org_questionnaire(
        self, organization_id: UUID, payload: event_schema.OrganizationQuestionnaireCreateSchema
    ) -> event_models.OrganizationQuestionnaire:
        """Create a new questionnaire for an organization (admin only).

        Creates a questionnaire with specified type (admission, membership, feedback, or generic)
        and optional max_submission_age. After creation, add sections and questions via
        POST /questionnaires/{id}/sections and /multiple-choice-questions endpoints. Requires
        'create_questionnaire' permission (organization staff/owners).
        """
        organization = t.cast(
            event_models.Organization,
            self.get_object_or_exception(self.get_organization_queryset(), pk=organization_id),
        )
        with transaction.atomic():
            questionnaire = QuestionnaireService.create_questionnaire(payload)
            return event_models.OrganizationQuestionnaire.objects.create(
                organization=organization,
                questionnaire=questionnaire,
                max_submission_age=payload.max_submission_age,
                questionnaire_type=payload.questionnaire_type,
            )

    @route.get(
        "/{org_questionnaire_id}",
        url_name="get_org_questionnaire",
        response=event_schema.OrganizationQuestionnaireSchema,
        throttle=UserDefaultThrottle(),
    )
    def get_org_questionnaire(self, org_questionnaire_id: UUID) -> event_models.OrganizationQuestionnaire:
        """Retrieve a questionnaire's details and structure (admin only).

        Returns the questionnaire with all sections, questions, and settings. Use this to view or
        edit an existing questionnaire. Requires permission to manage the organization's questionnaires.
        """
        return t.cast(
            event_models.OrganizationQuestionnaire,
            self.get_object_or_exception(self.get_queryset(), pk=org_questionnaire_id),
        )

    @route.post(
        "/{org_questionnaire_id}/sections",
        url_name="create_section",
        response=questionnaire_schema.SectionUpdateSchema,
        permissions=[QuestionnairePermission("edit_questionnaire")],
    )
    def create_section(
        self, org_questionnaire_id: UUID, payload: questionnaire_schema.SectionCreateSchema
    ) -> questionnaires_models.QuestionnaireSection:
        """Add a section to organize questions in the questionnaire (admin only).

        Sections group related questions. Specify section name and display order. Requires
        'edit_questionnaire' permission.
        """
        org_questionnaire = self.get_object_or_exception(
            event_models.OrganizationQuestionnaire, pk=org_questionnaire_id
        )
        service = QuestionnaireService(org_questionnaire.questionnaire_id)
        return service.create_section(payload)

    @route.put(
        "/{org_questionnaire_id}/sections/{section_id}",
        url_name="update_section",
        response=questionnaire_schema.SectionUpdateSchema,
        permissions=[QuestionnairePermission("edit_questionnaire")],
    )
    def update_section(
        self, org_questionnaire_id: UUID, section_id: UUID, payload: questionnaire_schema.SectionUpdateSchema
    ) -> questionnaires_models.QuestionnaireSection:
        """Update a questionnaire section's details (admin only).

        Modify section name or display order. Requires 'edit_questionnaire' permission.
        """
        org_questionnaire = self.get_object_or_exception(
            event_models.OrganizationQuestionnaire, pk=org_questionnaire_id
        )
        service = QuestionnaireService(org_questionnaire.questionnaire_id)
        section = get_object_or_404(
            questionnaires_models.QuestionnaireSection,
            pk=section_id,
            questionnaire_id=org_questionnaire.questionnaire_id,
        )
        return service.update_section(section, payload)

    @route.post(
        "/{org_questionnaire_id}/multiple-choice-questions",
        url_name="create_mc_question",
        response=questionnaire_schema.MultipleChoiceQuestionUpdateSchema,
        permissions=[QuestionnairePermission("edit_questionnaire")],
    )
    def create_mc_question(
        self, org_questionnaire_id: UUID, payload: questionnaire_schema.MultipleChoiceQuestionCreateSchema
    ) -> questionnaires_models.MultipleChoiceQuestion:
        """Add a multiple-choice question to the questionnaire (admin only).

        Create a question with predefined answer options. After creation, add options via
        POST /questionnaires/{id}/multiple-choice-questions/{question_id}/options. Requires
        'edit_questionnaire' permission.
        """
        org_questionnaire = self.get_object_or_exception(
            event_models.OrganizationQuestionnaire, pk=org_questionnaire_id
        )
        service = QuestionnaireService(org_questionnaire.questionnaire_id)
        return service.create_mc_question(payload)

    @route.put(
        "/{org_questionnaire_id}/multiple-choice-questions/{question_id}",
        url_name="update_mc_question",
        response=questionnaire_schema.MultipleChoiceQuestionUpdateSchema,
        permissions=[QuestionnairePermission("edit_questionnaire")],
    )
    def update_mc_question(
        self,
        org_questionnaire_id: UUID,
        question_id: UUID,
        payload: questionnaire_schema.MultipleChoiceQuestionUpdateSchema,
    ) -> questionnaires_models.MultipleChoiceQuestion:
        """Create a multiple choice question."""
        org_questionnaire = self.get_object_or_exception(
            event_models.OrganizationQuestionnaire, pk=org_questionnaire_id
        )
        service = QuestionnaireService(org_questionnaire.questionnaire_id)
        mc_question = get_object_or_404(
            questionnaires_models.MultipleChoiceQuestion,
            pk=question_id,
            questionnaire_id=org_questionnaire.questionnaire_id,
        )
        return service.update_mc_question(mc_question, payload)

    @route.post(
        "/{org_questionnaire_id}/multiple-choice-questions/{question_id}/options",
        url_name="create_mc_option",
        response=questionnaire_schema.MultipleChoiceOptionUpdateSchema,
        permissions=[QuestionnairePermission("edit_questionnaire")],
    )
    def create_mc_option(
        self,
        org_questionnaire_id: UUID,
        question_id: UUID,
        payload: questionnaire_schema.MultipleChoiceOptionCreateSchema,
    ) -> questionnaires_models.MultipleChoiceOption:
        """Create a multiple choice question."""
        org_questionnaire = self.get_object_or_exception(
            event_models.OrganizationQuestionnaire, pk=org_questionnaire_id
        )
        service = QuestionnaireService(org_questionnaire.questionnaire_id)
        question = get_object_or_404(questionnaires_models.MultipleChoiceQuestion, id=question_id)
        return service.create_mc_option(question, payload)

    @route.put(
        "/{org_questionnaire_id}/multiple-choice-options/{option_id}",
        url_name="update_mc_option",
        response=questionnaire_schema.MultipleChoiceOptionUpdateSchema,
        permissions=[QuestionnairePermission("edit_questionnaire")],
    )
    def update_mc_option(
        self,
        org_questionnaire_id: UUID,
        option_id: UUID,
        payload: questionnaire_schema.MultipleChoiceOptionUpdateSchema,
    ) -> questionnaires_models.MultipleChoiceOption:
        """Create a multiple choice question."""
        org_questionnaire = self.get_object_or_exception(
            event_models.OrganizationQuestionnaire, pk=org_questionnaire_id
        )
        service = QuestionnaireService(org_questionnaire.questionnaire_id)
        option = get_object_or_404(
            questionnaires_models.MultipleChoiceOption,
            id=option_id,
            question__questionnaire_id=org_questionnaire.questionnaire_id,
        )
        return service.update_mc_option(option, payload)

    @route.post(
        "/{org_questionnaire_id}/free-text-questions",
        url_name="create_ft_question",
        response=questionnaire_schema.FreeTextQuestionUpdateSchema,
        permissions=[QuestionnairePermission("edit_questionnaire")],
    )
    def create_ft_question(
        self, org_questionnaire_id: UUID, payload: questionnaire_schema.FreeTextQuestionCreateSchema
    ) -> questionnaires_models.FreeTextQuestion:
        """Add a free-text question to the questionnaire (admin only).

        Create an open-ended question for text responses. Can be auto-evaluated by LLM based on
        scoring criteria. Requires 'edit_questionnaire' permission.
        """
        org_questionnaire = self.get_object_or_exception(
            event_models.OrganizationQuestionnaire, pk=org_questionnaire_id
        )
        service = QuestionnaireService(org_questionnaire.questionnaire_id)
        return service.create_ft_question(payload)

    @route.put(
        "/{org_questionnaire_id}/free-text-questions/{question_id}",
        url_name="update_ft_question",
        response=questionnaire_schema.FreeTextQuestionUpdateSchema,
        permissions=[QuestionnairePermission("edit_questionnaire")],
    )
    def update_ft_question(
        self, org_questionnaire_id: UUID, question_id: UUID, payload: questionnaire_schema.FreeTextQuestionUpdateSchema
    ) -> questionnaires_models.FreeTextQuestion:
        """Create a multiple choice question."""
        org_questionnaire = self.get_object_or_exception(
            event_models.OrganizationQuestionnaire, pk=org_questionnaire_id
        )
        service = QuestionnaireService(org_questionnaire.questionnaire_id)
        ft_question = get_object_or_404(
            questionnaires_models.FreeTextQuestion, id=question_id, questionnaire_id=org_questionnaire.questionnaire_id
        )
        return service.update_ft_question(ft_question, payload)

    @route.get(
        "/{org_questionnaire_id}/submissions",
        url_name="list_submissions",
        response=PaginatedResponseSchema[questionnaire_schema.SubmissionListItemSchema],
        permissions=[QuestionnairePermission("evaluate_questionnaire")],
        throttle=UserDefaultThrottle(),
    )
    @paginate(PageNumberPaginationExtra, page_size=20)
    @searching(Searching, search_fields=["user__email", "user__first_name", "user__last_name"])
    def list_submissions(self, org_questionnaire_id: UUID) -> QuerySet[questionnaires_models.QuestionnaireSubmission]:
        """View user submissions for this questionnaire (admin only).

        Returns submitted questionnaires ready for review. Use this to see who has applied for
        event access and their responses. Requires 'evaluate_questionnaire' permission.
        """
        org_questionnaire = self.get_object_or_exception(self.get_queryset(), pk=org_questionnaire_id)
        service = QuestionnaireService(org_questionnaire.questionnaire_id)
        return service.get_submissions_queryset().filter(
            status=questionnaires_models.QuestionnaireSubmission.Status.READY
        )

    @route.get(
        "/{org_questionnaire_id}/submissions/{submission_id}",
        url_name="get_submission_detail",
        response=questionnaire_schema.SubmissionDetailSchema,
        permissions=[QuestionnairePermission("evaluate_questionnaire")],
        throttle=UserDefaultThrottle(),
    )
    def get_submission_detail(
        self, org_questionnaire_id: UUID, submission_id: UUID
    ) -> questionnaire_schema.SubmissionDetailSchema:
        """View detailed answers for a specific submission (admin only).

        Returns all questions and the user's answers, plus automatic evaluation results if available.
        Use this to review a submission before manual approval/rejection. Requires
        'evaluate_questionnaire' permission.
        """
        org_questionnaire = self.get_object_or_exception(self.get_queryset(), pk=org_questionnaire_id)
        qs = (
            questionnaires_models.QuestionnaireSubmission.objects.select_related("user", "questionnaire")
            .prefetch_related(
                "evaluation",
                "multiplechoiceanswer_answers__question",
                "multiplechoiceanswer_answers__option",
                "freetextanswer_answers__question",
            )
            .filter(questionnaire_id=org_questionnaire.questionnaire_id)
        )
        submission = get_object_or_404(qs, pk=submission_id)

        # Transform answers to the schema format
        answers = []
        for mc_answer in submission.multiplechoiceanswer_answers.all():
            answers.append(
                questionnaire_schema.QuestionAnswerDetailSchema(
                    question_id=mc_answer.question.id,
                    question_text=mc_answer.question.question,
                    question_type="multiple_choice",
                    answer_content={"option_id": mc_answer.option.id, "option_text": mc_answer.option.option},
                )
            )

        for ft_answer in submission.freetextanswer_answers.all():
            answers.append(
                questionnaire_schema.QuestionAnswerDetailSchema(
                    question_id=ft_answer.question.id,
                    question_text=ft_answer.question.question,
                    question_type="free_text",
                    answer_content={"answer": ft_answer.answer},
                )
            )

        return questionnaire_schema.SubmissionDetailSchema(
            id=submission.id,
            user_email=submission.user.email,
            user_name=submission.user.preferred_name
            or f"{submission.user.first_name} {submission.user.last_name}".strip(),
            questionnaire=questionnaire_schema.QuestionnaireInListSchema(
                id=submission.questionnaire.id,
                name=submission.questionnaire.name,
                min_score=submission.questionnaire.min_score,
                shuffle_questions=submission.questionnaire.shuffle_questions,
                shuffle_sections=submission.questionnaire.shuffle_sections,
                evaluation_mode=questionnaires_models.Questionnaire.EvaluationMode(
                    submission.questionnaire.evaluation_mode
                ),
            ),
            status=questionnaires_models.QuestionnaireSubmission.Status(submission.status),
            submitted_at=submission.submitted_at,
            evaluation=(
                questionnaire_schema.EvaluationResponseSchema.from_orm(submission.evaluation)
                if hasattr(submission, "evaluation") and submission.evaluation
                else None
            ),
            answers=answers,
            created_at=submission.created_at,
        )

    @route.post(
        "/{org_questionnaire_id}/submissions/{submission_id}/evaluate",
        url_name="evaluate_submission",
        response={200: questionnaire_schema.EvaluationResponseSchema, 400: ValidationErrorResponse},
        permissions=[QuestionnairePermission("evaluate_questionnaire")],
    )
    def evaluate_submission(
        self,
        org_questionnaire_id: UUID,
        submission_id: UUID,
        payload: questionnaire_schema.EvaluationCreateSchema,
    ) -> questionnaires_models.QuestionnaireEvaluation:
        """Manually approve or reject a questionnaire submission (admin only).

        Overrides automatic evaluation or provides decision for manual-review questionnaires.
        Approved users can then RSVP or purchase tickets for the event. Requires
        'evaluate_questionnaire' permission.
        """
        org_questionnaire = self.get_object_or_exception(self.get_queryset(), pk=org_questionnaire_id)
        service = QuestionnaireService(org_questionnaire.questionnaire_id)
        return service.evaluate_submission(submission_id, payload, self.user())

    # ===== CRUD: UPDATE & DELETE =====

    @route.put(
        "/{org_questionnaire_id}",
        url_name="update_org_questionnaire",
        response=event_schema.OrganizationQuestionnaireSchema,
        permissions=[QuestionnairePermission("edit_questionnaire")],
    )
    def update_org_questionnaire(
        self, org_questionnaire_id: UUID, payload: event_schema.OrganizationQuestionnaireUpdateSchema
    ) -> event_models.OrganizationQuestionnaire:
        """Update organization questionnaire and underlying questionnaire settings (admin only).

        Allows updating both OrganizationQuestionnaire wrapper fields (max_submission_age,
        questionnaire_type) and the underlying Questionnaire fields (name, min_score, llm_guidelines,
        shuffle_questions, shuffle_sections, evaluation_mode, can_retake_after, max_attempts).
        Requires 'edit_questionnaire' permission.
        """
        org_questionnaire = self.get_object_or_exception(self.get_queryset(), pk=org_questionnaire_id)
        return t.cast(
            event_models.OrganizationQuestionnaire, update_organization_questionnaire(org_questionnaire, payload)
        )

    @route.delete(
        "/{org_questionnaire_id}",
        url_name="delete_org_questionnaire",
        response={204: None},
        permissions=[QuestionnairePermission("delete_questionnaire")],
    )
    def delete_org_questionnaire(self, org_questionnaire_id: UUID) -> tuple[int, None]:
        """Delete an organization questionnaire (admin only).

        Permanently removes the questionnaire. Requires 'delete_questionnaire' permission.
        """
        org_questionnaire = self.get_object_or_exception(self.get_queryset(), pk=org_questionnaire_id)
        org_questionnaire.delete()
        return 204, None

    @route.delete(
        "/{org_questionnaire_id}/sections/{section_id}",
        url_name="delete_section",
        response={204: None},
        permissions=[QuestionnairePermission("edit_questionnaire")],
    )
    def delete_section(self, org_questionnaire_id: UUID, section_id: UUID) -> tuple[int, None]:
        """Delete a questionnaire section (admin only).

        Removes the section and all questions within it. Requires 'edit_questionnaire' permission.
        """
        org_questionnaire = self.get_object_or_exception(self.get_queryset(), pk=org_questionnaire_id)
        section = get_object_or_404(
            questionnaires_models.QuestionnaireSection,
            pk=section_id,
            questionnaire_id=org_questionnaire.questionnaire_id,
        )
        section.delete()
        return 204, None

    @route.delete(
        "/{org_questionnaire_id}/multiple-choice-questions/{question_id}",
        url_name="delete_mc_question",
        response={204: None},
        permissions=[QuestionnairePermission("edit_questionnaire")],
    )
    def delete_mc_question(self, org_questionnaire_id: UUID, question_id: UUID) -> tuple[int, None]:
        """Delete a multiple choice question (admin only).

        Removes the question and all its options. Requires 'edit_questionnaire' permission.
        """
        org_questionnaire = self.get_object_or_exception(self.get_queryset(), pk=org_questionnaire_id)
        question = get_object_or_404(
            questionnaires_models.MultipleChoiceQuestion,
            pk=question_id,
            questionnaire_id=org_questionnaire.questionnaire_id,
        )
        question.delete()
        return 204, None

    @route.delete(
        "/{org_questionnaire_id}/multiple-choice-options/{option_id}",
        url_name="delete_mc_option",
        response={204: None},
        permissions=[QuestionnairePermission("edit_questionnaire")],
    )
    def delete_mc_option(self, org_questionnaire_id: UUID, option_id: UUID) -> tuple[int, None]:
        """Delete a multiple choice option (admin only).

        Removes the option from a question. Requires 'edit_questionnaire' permission.
        """
        org_questionnaire = self.get_object_or_exception(self.get_queryset(), pk=org_questionnaire_id)
        option = get_object_or_404(
            questionnaires_models.MultipleChoiceOption,
            pk=option_id,
            question__questionnaire_id=org_questionnaire.questionnaire_id,
        )
        option.delete()
        return 204, None

    @route.delete(
        "/{org_questionnaire_id}/free-text-questions/{question_id}",
        url_name="delete_ft_question",
        response={204: None},
        permissions=[QuestionnairePermission("edit_questionnaire")],
    )
    def delete_ft_question(self, org_questionnaire_id: UUID, question_id: UUID) -> tuple[int, None]:
        """Delete a free text question (admin only).

        Removes the question. Requires 'edit_questionnaire' permission.
        """
        org_questionnaire = self.get_object_or_exception(self.get_queryset(), pk=org_questionnaire_id)
        question = get_object_or_404(
            questionnaires_models.FreeTextQuestion,
            pk=question_id,
            questionnaire_id=org_questionnaire.questionnaire_id,
        )
        question.delete()
        return 204, None

    # ===== EVENT & EVENT SERIES ASSIGNMENT =====

    @route.put(
        "/{org_questionnaire_id}/events",
        url_name="replace_questionnaire_events",
        response=event_schema.OrganizationQuestionnaireSchema,
        permissions=[QuestionnairePermission("edit_questionnaire")],
    )
    def replace_events(
        self, org_questionnaire_id: UUID, payload: event_schema.EventAssignmentSchema
    ) -> event_models.OrganizationQuestionnaire:
        """Replace all assigned events for this questionnaire (admin only).

        Batch operation to set exactly which events require this questionnaire. Validates that
        events belong to the same organization. Requires 'edit_questionnaire' permission.
        """
        org_questionnaire = self.get_object_or_exception(self.get_queryset(), pk=org_questionnaire_id)

        # Validate events belong to the organization
        events = event_models.Event.objects.filter(
            pk__in=payload.event_ids, organization=org_questionnaire.organization
        )
        if events.count() != len(payload.event_ids):
            from ninja.errors import HttpError

            raise HttpError(400, "One or more events do not exist or belong to this organization.")

        org_questionnaire.events.set(events)
        return t.cast(event_models.OrganizationQuestionnaire, org_questionnaire)

    @route.post(
        "/{org_questionnaire_id}/events/{event_id}",
        url_name="assign_questionnaire_event",
        response=event_schema.OrganizationQuestionnaireSchema,
        permissions=[QuestionnairePermission("edit_questionnaire")],
    )
    def assign_event(self, org_questionnaire_id: UUID, event_id: UUID) -> event_models.OrganizationQuestionnaire:
        """Assign a single event to this questionnaire (admin only).

        Adds one event that will require completion of this questionnaire. Requires
        'edit_questionnaire' permission.
        """
        org_questionnaire = self.get_object_or_exception(self.get_queryset(), pk=org_questionnaire_id)
        event = get_object_or_404(event_models.Event, pk=event_id, organization=org_questionnaire.organization)
        org_questionnaire.events.add(event)
        return t.cast(event_models.OrganizationQuestionnaire, org_questionnaire)

    @route.delete(
        "/{org_questionnaire_id}/events/{event_id}",
        url_name="unassign_questionnaire_event",
        response={204: None},
        permissions=[QuestionnairePermission("edit_questionnaire")],
    )
    def unassign_event(self, org_questionnaire_id: UUID, event_id: UUID) -> tuple[int, None]:
        """Unassign a single event from this questionnaire (admin only).

        Removes requirement for this questionnaire from one event. Requires 'edit_questionnaire'
        permission.
        """
        org_questionnaire = self.get_object_or_exception(self.get_queryset(), pk=org_questionnaire_id)
        event = get_object_or_404(event_models.Event, pk=event_id)
        org_questionnaire.events.remove(event)
        return 204, None

    @route.put(
        "/{org_questionnaire_id}/event-series",
        url_name="replace_questionnaire_event_series",
        response=event_schema.OrganizationQuestionnaireSchema,
        permissions=[QuestionnairePermission("edit_questionnaire")],
    )
    def replace_event_series(
        self, org_questionnaire_id: UUID, payload: event_schema.EventSeriesAssignmentSchema
    ) -> event_models.OrganizationQuestionnaire:
        """Replace all assigned event series for this questionnaire (admin only).

        Batch operation to set exactly which event series require this questionnaire. Validates that
        series belong to the same organization. Requires 'edit_questionnaire' permission.
        """
        org_questionnaire = self.get_object_or_exception(self.get_queryset(), pk=org_questionnaire_id)

        # Validate event series belong to the organization
        series = event_models.EventSeries.objects.filter(
            pk__in=payload.event_series_ids, organization=org_questionnaire.organization
        )
        if series.count() != len(payload.event_series_ids):
            from ninja.errors import HttpError

            raise HttpError(400, "One or more event series do not exist or belong to this organization.")

        org_questionnaire.event_series.set(series)
        return t.cast(event_models.OrganizationQuestionnaire, org_questionnaire)

    @route.post(
        "/{org_questionnaire_id}/event-series/{series_id}",
        url_name="assign_questionnaire_event_series",
        response=event_schema.OrganizationQuestionnaireSchema,
        permissions=[QuestionnairePermission("edit_questionnaire")],
    )
    def assign_event_series(
        self, org_questionnaire_id: UUID, series_id: UUID
    ) -> event_models.OrganizationQuestionnaire:
        """Assign a single event series to this questionnaire (admin only).

        Adds one event series that will require completion of this questionnaire. Requires
        'edit_questionnaire' permission.
        """
        org_questionnaire = self.get_object_or_exception(self.get_queryset(), pk=org_questionnaire_id)
        series = get_object_or_404(event_models.EventSeries, pk=series_id, organization=org_questionnaire.organization)
        org_questionnaire.event_series.add(series)
        return t.cast(event_models.OrganizationQuestionnaire, org_questionnaire)

    @route.delete(
        "/{org_questionnaire_id}/event-series/{series_id}",
        url_name="unassign_questionnaire_event_series",
        response={204: None},
        permissions=[QuestionnairePermission("edit_questionnaire")],
    )
    def unassign_event_series(self, org_questionnaire_id: UUID, series_id: UUID) -> tuple[int, None]:
        """Unassign a single event series from this questionnaire (admin only).

        Removes requirement for this questionnaire from one event series. Requires 'edit_questionnaire'
        permission.
        """
        org_questionnaire = self.get_object_or_exception(self.get_queryset(), pk=org_questionnaire_id)
        series = get_object_or_404(event_models.EventSeries, pk=series_id)
        org_questionnaire.event_series.remove(series)
        return 204, None
