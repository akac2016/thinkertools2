# Codex Preferences

For minor code changes, do not run the linter by default. Run lint only when:

- the change touches shared logic, build config, imports, types, or multiple files
- the edit is risky enough that lint is likely to catch a real issue
- the user explicitly asks for verification

For docs, copy, styling-only, and trivial one-line edits, summarize the change and note that lint was skipped.
