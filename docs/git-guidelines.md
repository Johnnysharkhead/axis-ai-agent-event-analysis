# GitLab Best Practices

## General Rules

- **Use feature branches for development**
- **Do not commit directly to the main branch**
- **Keep commits small and focused**
- **Never commit secrets or credentials**
- **Run tests locally before pushing**
- **Commit with descriptive messages**
- **Document your code with meaningful comments**

---

## Branching Strategy

- **Main branch**  
  Always stable, production-ready. The `develop` branch should be merged into `main` at the end of every sprint.

- **Develop branch**  
  Integration branch for features.  
  Developers branch off from `develop` to create feature branches (e.g., `feature/login-page`), then merge back once features are complete and reviewed.

- **Feature branch**  
  When adding a new feature, create a new branch out from `develop` with the following name:  
  `feature/<scope>-<short-description>`  
  _Example: `feature/login-page`_

- **Bugfix branch**  
  When fixing bugs, create a branch:  
  `fix/<scope>-<short-desc>`  
  _Example: `fix/auth-timeout`_

- **Test branch**  
  For testers to test the stable version.  
  Testers branch out from the last stable version.  
  Format: `test/<sprint-or-release>-<short-description>`  
  _Example: `test/sprint-5-final`_

---

## Branch Naming

- Use **lowercase** and **hyphens**:  
  _Example: `feature/user-authentication`_
- Keep names concise but descriptive

---

## Commit Messages

- Follow format:  
  `<type>(<scope>): <description>`
- **Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- _Example: `feat(auth): add JWT-based login`_

---

## Merge Requests

- **Open a Merge Request (MR) for _all_ changes**
- **Use clear and descriptive titles and descriptions**
- **One person must review and approve all code**
- **Pipeline must pass before merging**
- **Use “Squash & Merge” when merging**  
  (Keeps history clean: one merge is one commit, doesn’t include all small commits)
- **Delete branch after merge**

### Reviewer Should Focus On:

- Code correctness and quality
- Security implications
- Performance considerations
- Documentation

---

## Merge Conflicts

- Regularly pull changes from the target branch (`develop`) into your feature or fix branch to minimize conflict risk.
- **Always resolve merge conflicts on your local machine**, not through the web interface, to ensure you can build and test after resolving.
- Carefully review both sides of the conflict—do not blindly accept or discard changes. Ensure the final result is correct and maintains intended functionality.
- Run all relevant tests locally to ensure the resolution did not introduce bugs or break functionality.
- **Document the Resolution:**  
  If the conflict was significant or required design decisions, describe what was changed and why in the merge request description or commit message.
- If the resolution was complex, request an extra review to double-check correctness and intent.
- **Avoid Last-Minute Merges:**  
  Don’t wait until just before a release to resolve conflicts; handle them as early as possible in the development process.
- **Communicate with Team:**  
  If unsure about how to resolve a conflict, reach out to the team or code owner for clarification.

---

## Definition of Done

- All tests and lint checks pass
- Tests updated or added where needed
- Docs/CHANGELOG updated for user-facing changes
- Feature flags for incomplete work
- Security and performance considerations addressed
- Code is properly commented

---


# Simple Development Rules

## Coding Practices

- **Generative AI Usage:**  
  You may use generative AI for coding, but always **document with comments** what was generated or assisted by AI, and describe the intent behind the code.
- **Readable, Self-Documenting Code:**  
  Write clear code with simple, clean names that explain what each piece of code does.
- **Descriptive Naming:**  
  Use descriptive variable, function, and class names.
- **Small, Purposeful Functions:**  
  Keep functions small with a clear, single purpose to make understanding and maintenance easier.
- **Avoid Hardcoding:**  
  Do not hardcode values just to “make it work”; design for flexibility and clarity.

---

## Documentation & Traceability

- **Comment Your Code:**  
  Add meaningful comments to clarify why something is done, not just what is done.
- **Public Change Log:**  
  Always document code changes in a public document (e.g., CHANGELOG.md or relevant GitLab/Trello issue) to make retracing steps easier.
- **Bug Documentation:**  
  If bugs are found, document them thoroughly—include steps to reproduce, diagnostics, and how/when they were fixed.

---

## Testing & Quality

- **Local Testing:**  
  Test all features locally before merging—never test unverified changes on the main branch.
- **No Direct Main Branch Changes:**  
  Never commit or test directly on the main or develop branch; use feature branches and follow the correct Git workflow.
- **Pre-Merge Validation:**  
  Before merging any work into the main or develop branch, ensure all tests pass and that the feature is working as intended.

---

## Collaboration & Planning

- **Issue Tracking:**  
  Use Trello or GitLab Issues for planning, task assignment, and tracking progress.
- **Regular Communication:**  
  Hold regular meetings in the R&D department to sync, share knowledge, and resolve blockers.
- **Sprint Planning & Retrospectives:**  
  Conduct sprint planning and retrospectives at tollgates to continuously improve team processes.

---