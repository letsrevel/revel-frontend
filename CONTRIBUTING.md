# Contributing to Revel Frontend

Thank you for your interest in contributing to Revel! We're excited to have you join our community. Whether you're reporting a bug, suggesting a feature, or writing code, your contributions make this project better for everyone.

This document provides guidelines to ensure a smooth and effective contribution process.

---

## 🌈 Our Community Values

Revel is built for diverse, inclusive communities. We expect all contributors to:

- **Be respectful and welcoming** to people of all backgrounds and experience levels
- **Assume good intentions** and communicate constructively
- **Prioritize accessibility** and inclusive design
- **Value privacy and safety** as core principles
- **Follow our Code of Conduct** (see CODE_OF_CONDUCT.md)

---

## 🛠️ How to Contribute

### Reporting Bugs

If you find a bug, please check our [GitHub Issues](https://github.com/letsrevel/revel-frontend/issues) first to see if it's already been reported.

**To report a new bug:**

1. Open a new issue with a clear, descriptive title
2. Describe the steps to reproduce the bug
3. Include expected vs. actual behavior
4. Add screenshots or screen recordings if applicable
5. Include browser/device information
6. Label the issue as `bug`

**Example:**

```
Title: Event RSVP button not working on mobile Safari

Description:
When tapping the RSVP button on an event detail page using Mobile Safari (iOS 17),
nothing happens. The button shows a focus state but no modal appears.

Steps to reproduce:
1. Open event page on iPhone with Safari
2. Tap "RSVP to Event" button
3. Observe: No response

Expected: RSVP modal should appear
Actual: Nothing happens

Browser: Safari 17.1 on iOS 17.2
Device: iPhone 14 Pro
```

### Suggesting Features

We welcome feature suggestions! Before creating a new request:

1. Check existing issues and discussions
2. Consider if it aligns with Revel's mission (community-focused, privacy-first)
3. Open an issue with the `enhancement` label
4. Describe the problem you're trying to solve
5. Explain your proposed solution
6. Discuss alternatives you've considered

### Contributing Code

#### First-Time Contributors

New to open source? Welcome! Here's how to get started:

1. **Find a good first issue:** Look for issues labeled `good first issue`
2. **Comment on the issue:** Let others know you're working on it
3. **Ask questions:** Don't hesitate to ask for help in the issue comments
4. **Submit your PR:** We'll guide you through the review process

#### Development Setup

**Prerequisites:**

- Node.js 20+ (we recommend using [nvm](https://github.com/nvm-sh/nvm))
- pnpm 9+ (`npm install -g pnpm`)
- Git
- Revel backend running locally ([setup instructions](https://github.com/letsrevel/revel-backend))

**Setup Steps:**

1. **Fork the repository** on GitHub

2. **Clone your fork:**

   ```bash
   git clone https://github.com/YOUR-USERNAME/revel-frontend.git
   cd revel-frontend
   ```

3. **Add upstream remote:**

   ```bash
   git remote add upstream https://github.com/letsrevel/revel-frontend.git
   ```

4. **Install dependencies:**

   ```bash
   pnpm install
   ```

5. **Generate API client** (requires backend running):

   ```bash
   pnpm generate:api
   ```

6. **Start development server:**

   ```bash
   pnpm dev
   ```

7. **Open browser:** Navigate to `http://localhost:5173`

---

## 📝 Development Workflow

### Creating a Branch

Always create a new branch for your work:

```bash
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name
```

**Branch naming conventions:**

- `feature/` - New features (e.g., `feature/event-rsvp`)
- `fix/` - Bug fixes (e.g., `fix/mobile-button-click`)
- `refactor/` - Code refactoring (e.g., `refactor/api-client`)
- `docs/` - Documentation changes (e.g., `docs/contributing`)
- `test/` - Test additions or fixes (e.g., `test/event-component`)

### Writing Code

**IMPORTANT:** Read [CLAUDE.md](CLAUDE.md) for detailed development guidelines.

**Key principles:**

1. **TypeScript strict mode** - All code must be fully typed
2. **Svelte 5 Runes** - Use modern Svelte 5 syntax (`$state`, `$derived`, etc.)
3. **Mobile-first design** - Design for mobile, enhance for desktop
4. **Accessibility first** - WCAG 2.1 AA compliance is mandatory
5. **Test your code** - Write unit, integration, or E2E tests as appropriate

**Before writing code:**

- Understand the existing codebase structure
- Check if similar functionality exists
- Consider accessibility implications
- Think about mobile UX
- Consult the Svelte MCP for Svelte 5 best practices

### Code Style

We enforce code quality with automated tools:

- **ESLint:** Linting (`pnpm lint`)
- **Prettier:** Formatting (`pnpm format`)
- **TypeScript:** Type checking (`pnpm check`)

**Run before committing:**

```bash
pnpm check && pnpm lint && pnpm format && pnpm test
```

**Style guidelines:**

- Use `const` over `let` when possible
- Prefer descriptive names over short ones
- Add comments for complex logic
- Use TypeScript types, avoid `any`
- Follow existing patterns in the codebase

### Accessibility Requirements

**Every contribution must meet WCAG 2.1 AA standards:**

- ✅ **Keyboard navigation:** All interactive elements must work with keyboard
- ✅ **Screen reader support:** Use semantic HTML and ARIA labels
- ✅ **Color contrast:** Minimum 4.5:1 for text
- ✅ **Focus indicators:** Visible focus states on all focusable elements
- ✅ **Alt text:** All images must have descriptive alt attributes
- ✅ **Responsive:** Works on all screen sizes

**Test accessibility:**

1. Navigate your feature using only the keyboard (Tab, Enter, Escape)
2. Use a screen reader (VoiceOver on macOS, NVDA on Windows)
3. Check color contrast with browser DevTools
4. Test on mobile device or mobile viewport
5. Run Lighthouse accessibility audit

### Testing

**We require tests for:**

- New features
- Bug fixes (add a regression test)
- Public API changes

**Types of tests:**

1. **Unit tests** (Vitest) - Pure functions, utilities, stores

   ```bash
   pnpm test
   ```

2. **Component tests** (@testing-library/svelte) - Component behavior

   ```bash
   pnpm test
   ```

3. **E2E tests** (Playwright) - Critical user journeys
   ```bash
   pnpm test:e2e
   ```

**Writing good tests:**

- Test behavior, not implementation
- Use descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- Mock external dependencies (API calls, timers)
- Test accessibility (keyboard navigation, ARIA)

### Committing Changes

We use [Conventional Commits](https://www.conventionalcommits.org/) for clear commit history:

**Format:**

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, no logic change)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Build process, dependencies, tooling

**Examples:**

```bash
git commit -m "feat(events): add RSVP confirmation modal"
git commit -m "fix(auth): resolve token refresh loop on logout"
git commit -m "docs(readme): update installation instructions"
```

**Commit guidelines:**

- Keep commits focused (one logical change per commit)
- Write clear, descriptive messages
- Reference issues when applicable: `fixes #123`

### Pushing and Creating a Pull Request

1. **Push your branch:**

   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request** on GitHub:
   - Give it a clear, descriptive title
   - Fill out the PR template completely
   - Link related issues (e.g., `Closes #123`)
   - Add screenshots/videos for UI changes
   - Mark as draft if work-in-progress

3. **PR Description should include:**
   - What changed and why
   - How to test the changes
   - Accessibility considerations
   - Screenshots/videos (for UI changes)
   - Any breaking changes
   - Any new dependencies

**Example PR description:**

```markdown
## What Changed

Added RSVP confirmation modal to event detail pages.

## Why

Users were confused about whether their RSVP was submitted successfully.
This modal provides clear feedback.

## Testing

1. Navigate to any event detail page
2. Click "RSVP to Event"
3. Verify modal appears with confirmation message
4. Test keyboard navigation (Tab, Enter, Escape)
5. Test on mobile viewport

## Accessibility

- Modal traps focus (keyboard accessible)
- Escape key closes modal
- ARIA labels added for screen readers
- Color contrast meets WCAG AA

## Screenshots

[Include screenshots]

Closes #42
```

### Code Review Process

All PRs require review before merging:

1. **Automated checks must pass:**
   - Type checking (`pnpm check`)
   - Linting (`pnpm lint`)
   - Tests (`pnpm test`)
   - Build (`pnpm build`)

2. **Maintainer review:**
   - Code quality and style
   - Test coverage
   - Accessibility compliance
   - Mobile responsiveness
   - Performance implications

3. **Feedback:**
   - Address review comments
   - Push new commits (don't force-push during review)
   - Respond to questions

4. **Approval and merge:**
   - Maintainer will merge when approved
   - Delete your branch after merge

---

## 🎯 Contribution Guidelines

### What We're Looking For

**We especially welcome contributions that:**

- Improve accessibility
- Enhance mobile experience
- Add or improve tests
- Fix bugs
- Improve documentation
- Optimize performance
- Reduce bundle size

### What to Avoid

**Please don't:**

- Submit large PRs without prior discussion
- Introduce breaking changes without consensus
- Compromise accessibility for aesthetics
- Add unnecessary dependencies
- Ignore TypeScript errors
- Skip writing tests
- Force-push during code review

### Getting Help

**Stuck or have questions?**

- **Ask in the issue:** Comment on the issue you're working on
- **GitHub Discussions:** For broader questions or ideas
- **Discord:** (Coming soon) Real-time help from the community
- **Email maintainers:** For private concerns

---

## 🏆 Recognition

All contributors are recognized in our:

- GitHub contributors page
- Release notes
- Annual contributor highlights

We value all contributions, from code to documentation to bug reports!

---

## 📋 Checklist

Before submitting a PR, ensure:

- [ ] Code follows project style and conventions
- [ ] TypeScript strict mode passes (`pnpm check`)
- [ ] Linting passes (`pnpm lint`)
- [ ] Code is formatted (`pnpm format`)
- [ ] Tests pass (`pnpm test`)
- [ ] Tests added for new features or bug fixes
- [ ] Accessibility tested (keyboard nav, screen reader, contrast)
- [ ] Mobile-responsive design tested
- [ ] Documentation updated (if applicable)
- [ ] Commit messages follow Conventional Commits
- [ ] PR description is clear and complete
- [ ] Screenshots/videos included for UI changes

---

## 📜 License

By contributing to Revel Frontend, you agree that your contributions will be licensed under the MIT License.

---

## 🙏 Thank You

Thank you for taking the time to contribute to Revel! Your work helps build a better platform for diverse communities worldwide.

Together, we're creating something special. 🎉
