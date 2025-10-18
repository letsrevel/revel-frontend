# Claude Code Subagents

This directory contains specialized Claude Code subagents for the Revel Frontend project. Subagents are AI assistants that Claude Code can delegate tasks to, each with their own context window and specialized instructions.

## What are Subagents?

Subagents are:

- **Specialized AI assistants** focused on specific tasks
- **Separate context windows** that don't pollute the main conversation
- **Reusable** across different features and work sessions
- **Configurable** with specific tool access and system prompts

Think of them as expert teammates you can call upon for specialized work.

## Available Subagents

### 🔄 api-sync

**Description:** Regenerate TypeScript API client from backend OpenAPI specification

**Use when:**

- Backend API has changed
- Adding new endpoints
- API types are out of sync

**Invocation:**

```
"The backend API changed. Use the api-sync subagent to update the frontend."
```

---

### 🧩 component-creator

**Description:** Create new Svelte 5 components with proper structure, TypeScript, accessibility, and mobile-first design

**Use when:**

- Building new UI components
- Adding feature-specific components
- Creating reusable elements

**Invocation:**

```
"Create an EventCard component. Use the component-creator subagent."
```

---

### 🛣️ route-creator

**Description:** Create new SvelteKit routes with proper SSR/CSR configuration and TypeScript types

**Use when:**

- Adding new pages
- Creating API endpoints
- Setting up protected routes

**Invocation:**

```
"Create the event listing route. Use the route-creator subagent."
```

---

### ✅ testing-helper

**Description:** Write comprehensive tests using Vitest, @testing-library/svelte, and Playwright

**Use when:**

- Testing new features
- Writing unit tests
- Creating E2E tests
- Ensuring test coverage

**Invocation:**

```
"Write tests for the EventCard component. Use the testing-helper subagent."
```

---

### ♿ accessibility-checker

**Description:** Audit and ensure WCAG 2.1 AA compliance

**Use when:**

- Before merging features
- During code review
- After design changes
- Creating new components

**Invocation:**

```
"Check accessibility of the login form. Use the accessibility-checker subagent."
```

---

### 📋 project-manager

**Description:** Plan features, create GitHub issues, break down tasks

**Use when:**

- Planning new features
- Creating GitHub issues
- Breaking down large tasks
- Organizing milestones
- Tracking implementation progress

**Invocation:**

```
"Plan the event RSVP feature. Use the project-manager subagent."
```

---

## How to Use Subagents

### Method 1: Explicit Invocation (Recommended)

Tell Claude Code which subagent to use:

```
"I need to create a new button component.
Use the component-creator subagent."
```

```
"The backend API was updated.
Use the api-sync subagent to synchronize the client."
```

### Method 2: Automatic Delegation

Claude Code can automatically choose the right subagent based on your request:

```
"Create an EventCard component"
# Claude Code may automatically invoke component-creator

"Check if this component is accessible"
# Claude Code may automatically invoke accessibility-checker
```

### Method 3: Using `/agents` Command

Manage subagents interactively:

```
/agents
```

This opens an interface to:

- View all available subagents
- Edit subagent configurations
- Test subagent behavior

## Subagent Workflow Example

### Creating a Feature

**You:** "I want to add event RSVP functionality."

**Claude Code:** _Invokes project-manager subagent_

- Creates technical design
- Breaks down into tasks
- Creates GitHub issues

**You:** "Create the RSVPButton component."

**Claude Code:** _Invokes component-creator subagent_

- Creates Svelte 5 component with Runes
- Adds accessibility features
- Implements mobile-first design
- Creates test file

**You:** "Check if this component is accessible."

**Claude Code:** _Invokes accessibility-checker subagent_

- Audits WCAG 2.1 AA compliance
- Checks keyboard navigation
- Verifies ARIA usage
- Reports issues with fixes

**You:** "Write comprehensive tests for it."

**Claude Code:** _Invokes testing-helper subagent_

- Creates unit tests
- Adds component interaction tests
- Includes accessibility tests
- Achieves high coverage

## Benefits of Subagents

1. **Context Preservation:** Main conversation stays clean and focused
2. **Specialized Expertise:** Each subagent is an expert in its domain
3. **Consistency:** Same patterns and best practices every time
4. **Reusability:** Use across multiple features and projects
5. **Efficiency:** Faster execution with focused instructions

## Customizing Subagents

Subagents are stored as Markdown files with YAML frontmatter. You can edit them:

```yaml
---
name: your-subagent-name
description: When this subagent should be invoked
tools: Bash, Read, Write # Optional: limit tool access
model: inherit # Optional: sonnet, opus, haiku, or inherit
---
Your custom system prompt here...
```

**Location:**

- Project-level: `.claude/agents/` (version controlled, team-wide)
- User-level: `~/.claude/agents/` (personal, all projects)

## Best Practices

1. **Be specific in requests:** "Use the component-creator subagent" is clearer than "create a component"
2. **Chain subagents:** Use multiple subagents for complex features
3. **Review outputs:** Subagents are autonomous but outputs should be reviewed
4. **Customize as needed:** Edit subagents to match your team's conventions
5. **Version control:** Project subagents are in git, share with your team

## Integration with CLAUDE.md

These subagents work alongside [CLAUDE.md](../../CLAUDE.md):

- **CLAUDE.md:** Broad architectural guidelines, tech stack, philosophy
- **Subagents:** Specialized execution of specific tasks

Together, they provide comprehensive AI assistance for the project.

## Quick Reference

| Task                | Subagent                | Command                              |
| ------------------- | ----------------------- | ------------------------------------ |
| Update API types    | `api-sync`              | "Use api-sync subagent"              |
| New component       | `component-creator`     | "Use component-creator subagent"     |
| New page/route      | `route-creator`         | "Use route-creator subagent"         |
| Write tests         | `testing-helper`        | "Use testing-helper subagent"        |
| Check accessibility | `accessibility-checker` | "Use accessibility-checker subagent" |
| Plan feature        | `project-manager`       | "Use project-manager subagent"       |

## Resources

- [Claude Code Subagents Documentation](https://docs.claude.com/en/docs/claude-code/sub-agents)
- [Project CLAUDE.md](../../CLAUDE.md)
- [Contributing Guidelines](../../CONTRIBUTING.md)

---

**Note:** Subagents are a powerful feature of Claude Code. Use them liberally to maintain high code quality and consistency across the project!
