# Todo Density and Calendar Center Final Fix Report

Date: 2026-08-11
Status: Complete; deployment pending

## Scope

This single fix wave addresses the complete final-review list:

1. Give Base UI Dialog full ownership of Escape, outside-click, and focus-restoration behavior.
2. Change the approved design status from implementation pending to implementation complete and deployment pending.

No deployment was done.

## Diagnosis

`TodoDueDatePicker` used the same local `closeOnEscape` function for two different overlay paths. The Popover path still needs its current local behavior. The Dialog path did not need it because the installed Base UI Dialog already owns dismissal and focus restoration.

The old AddTodoRow Escape test mocked the project Dialog wrapper. Its mock spread `onKeyDown` onto a plain `div`, so the test exercised the duplicate local handler. It did not exercise Base UI dismissal, backdrop handling, or trigger focus restoration.

The fix removes only `onKeyDown={closeOnEscape}` from `DialogContent`. It keeps the Popover path unchanged. A new JSDOM test uses the real project Dialog wrapper and the installed Base UI implementation. It proves that the first Escape closes only the date Dialog, restores focus to the date trigger, and keeps the add form open. It also proves that a later Escape closes the add form and that a backdrop click closes only the Dialog and restores trigger focus.

## Base UI API evidence

Installed package: `@base-ui/react` 1.5.0.

Evidence from the installed package:

- `dialog/root/DialogRoot.d.ts` defines `onOpenChange(open, eventDetails)` and includes `escape-key` and `outside-press` in the Dialog change reasons.
- `dialog/root/useDialogRoot.js` configures `useDismiss` for intentional backdrop presses and enables Escape only for the topmost Dialog.
- `floating-ui-react/hooks/useDismiss.js` closes on Escape, calls `preventDefault()`, and stops propagation unless the event details allow it.
- `dialog/popup/DialogPopup.d.ts` defines `finalFocus` with default trigger or prior-focus behavior.
- `dialog/popup/DialogPopup.js` passes `finalFocus` to `FloatingFocusManager` and enables focus restoration.

Inspection commands:

```sh
node -p 'require("./node_modules/@base-ui/react/package.json").version'
nl -ba node_modules/@base-ui/react/dialog/root/DialogRoot.d.ts | sed -n '25,105p'
nl -ba node_modules/@base-ui/react/dialog/root/useDialogRoot.js | sed -n '55,115p'
nl -ba node_modules/@base-ui/react/floating-ui-react/hooks/useDismiss.js | sed -n '88,125p'
nl -ba node_modules/@base-ui/react/dialog/popup/DialogPopup.d.ts | sed -n '10,65p'
nl -ba node_modules/@base-ui/react/dialog/popup/DialogPopup.js | sed -n '96,145p'
```

Result: the installed source confirms native Escape dismissal, intentional outside-press handling, event propagation control, and final-focus restoration.

## RED and GREEN evidence

### Integration-test calibration

The first new JSDOM integration run failed for test-environment reasons: `fireEvent.click` did not focus the trigger as a browser click does, and Base UI inserted focus guards beside the backdrop. The test was corrected before the source fix by focusing the trigger explicitly and selecting the open presentation backdrop. The corrected real-Dialog test then passed with the old source: 2 tests passed. This established that the Base UI integration is practical in JSDOM.

### RED

The focused wrapper-boundary test was added while the old Dialog handler was restored:

```sh
npm test -- src/routes/_layout/todos/-TodoDueDatePicker.test.tsx
```

Result: expected failure. 1 of 10 tests failed. The failure was:

```text
TodoDueDatePicker > delegates Escape dismissal to the Dialog wrapper
expected [Function closeOnEscape] to be undefined
```

### GREEN

After removing the Dialog `onKeyDown` prop, the real Base UI integration test passed:

```sh
npm test -- src/routes/_layout/todos/-AddTodoRow.dialog.test.tsx
```

Result: 1 file passed, 2 tests passed.

The old AddTodoRow mock-only Escape test then failed because the plain Dialog mock no longer supplied native Base UI dismissal. That test was removed and replaced by the real integration coverage. The final focused command was:

```sh
npm test -- src/routes/_layout/todos/-TodoDueDatePicker.test.tsx src/routes/_layout/todos/-AddTodoRow.test.tsx src/routes/_layout/todos/-AddTodoRow.dialog.test.tsx
```

Result: 3 files passed, 25 tests passed, 0 failed.

## Verification commands and results

Baseline focused tests before changes:

```sh
npm test -- src/routes/_layout/todos/-TodoDueDatePicker.test.tsx src/routes/_layout/todos/-AddTodoRow.test.tsx
```

Result: 2 files passed, 23 tests passed.

Changed-file formatting and lint:

```sh
npx oxfmt --write docs/superpowers/specs/2026-08-10-todo-density-calendar-center-design.md src/routes/_layout/todos/-TodoDueDatePicker.tsx src/routes/_layout/todos/-TodoDueDatePicker.test.tsx src/routes/_layout/todos/-AddTodoRow.test.tsx src/routes/_layout/todos/-AddTodoRow.dialog.test.tsx
npx oxlint src/routes/_layout/todos/-TodoDueDatePicker.tsx src/routes/_layout/todos/-TodoDueDatePicker.test.tsx src/routes/_layout/todos/-AddTodoRow.test.tsx src/routes/_layout/todos/-AddTodoRow.dialog.test.tsx
npx oxfmt --check docs/superpowers/specs/2026-08-10-todo-density-calendar-center-design.md src/routes/_layout/todos/-TodoDueDatePicker.tsx src/routes/_layout/todos/-TodoDueDatePicker.test.tsx src/routes/_layout/todos/-AddTodoRow.test.tsx src/routes/_layout/todos/-AddTodoRow.dialog.test.tsx
```

Result: formatting matched; lint found 0 warnings and 0 errors. Oxfmt printed a Node `module.register()` deprecation notice and said that it used defaults because no formatter config exists.

Full test suite:

```sh
npm test
```

Result: 46 files passed, 632 tests passed, 0 failed. Vitest printed the existing Node localStorage experimental warning in two test workers.

Production build:

```sh
npm run build
```

Result: exit 0. Client, SSR, and Nitro builds completed. The build printed existing toolchain and dependency warnings: a generated CSS `[bg:var(...)]` token warning, ignored dependency `use client` directives, unused dependency imports, and the Node `module.register()` deprecation notice.

Final repository checks:

```sh
git diff --check
git status --short
```

Result before the commit: no whitespace errors; only the files in this report were changed.

## Files

- `src/routes/_layout/todos/-TodoDueDatePicker.tsx`: removed the duplicate Dialog Escape handler; kept the Popover handler.
- `src/routes/_layout/todos/-TodoDueDatePicker.test.tsx`: added a focused wrapper-boundary regression check.
- `src/routes/_layout/todos/-AddTodoRow.dialog.test.tsx`: added real Base UI Dialog integration tests for nested Escape, outside click, and focus restoration.
- `src/routes/_layout/todos/-AddTodoRow.test.tsx`: removed the obsolete mock-only nested Escape test.
- `docs/superpowers/specs/2026-08-10-todo-density-calendar-center-design.md`: changed the status to `Implemented; deployment pending`.
- `.superpowers/sdd/2026-08-10-todo-density-calendar-center/final-fix-report.md`: records this fix wave.

## Commit

- Branch: `agent/todo-density-calendar-center`
- Parent: `f03ba4f4d1ebee92ffa3ca937fd7d447db3dc1b5`
- Subject: `fix: delegate Todo dialog dismissal to Base UI`
- Scope: one final-review fix commit, including this report

The final commit hash is in Git history and the handoff response. A commit cannot contain its own final hash because adding that hash to this tracked report would change the hash.

## Self-review

- Finding 1 is fixed at the wrapper boundary. The Dialog path has no generic content `onKeyDown` handler.
- The Popover path is unchanged.
- The new real integration test uses the installed Base UI Dialog through `src/components/ui/dialog.tsx`; only the calendar body is mocked.
- The required nested behavior is covered: first Escape closes only the Dialog, focus returns to the date trigger, and a later Escape closes the add form.
- Outside-click behavior is covered through the actual Base UI backdrop, and the add form stays open.
- The weak Dialog-mock Escape test is removed. The focused unit test prevents the duplicate handler from returning.
- Finding 2 is fixed with the requested concise design status.
- The full diff contains no unrelated source change and no deployment change.
- Focused tests, full tests, formatting, changed-file lint, build, and `git diff --check` passed.

## Concerns

No change-specific behavior concern remains.

The build and test commands still print the warnings listed above. They do not fail verification and do not come from a file changed in this fix wave. The JSDOM integration test explicitly focuses the trigger before `fireEvent.click` because Testing Library does not reproduce the browser's click-to-focus behavior by itself.
