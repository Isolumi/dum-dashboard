# Testing Patterns

**Analysis Date:** 2026-02-20

## Test Framework

**Runner:**
- Not configured - No testing framework is set up

**Assertion Library:**
- Not configured

**Run Commands:**
- No test scripts defined in `package.json`

## Test File Organization

**Status:**
- No test files exist in the project source code (`src/` directory)
- Test infrastructure has not been implemented

**Expected Structure (When Implemented):**
- Tests should be co-located with components or in separate `__tests__` directories
- Files would follow pattern: `*.test.ts` or `*.spec.ts`

## Test Coverage

**Requirements:** Not enforced - no testing infrastructure configured

## Recommendations for Future Testing

**When Testing Should Be Added:**

1. **Unit Tests for Utilities:**
   - `src/lib/utils.ts` - The `cn()` function should have tests for className merging
   - `src/hooks/use-mobile.ts` - Hook logic for mobile detection needs testing

2. **Component Tests:**
   - UI components in `src/components/ui/` should test variant combinations
   - Components like `Button`, `Input`, `Separator` should verify prop handling
   - Context provider components (`SidebarProvider`) should test state management

3. **Hook Tests:**
   - `useIsMobile()` hook needs tests for:
     - Initial state
     - Event listener setup
     - Cleanup behavior
   - `useSidebar()` hook needs tests for:
     - Context error handling when used outside provider
     - State updates and callbacks

4. **Integration Tests:**
   - Test sidebar state management across `SidebarProvider` and consuming components
   - Test navigation between pages with sidebar state persistence
   - Test cookie storage for sidebar state

5. **Page Component Tests:**
   - Verify page components render correctly with expected layout
   - Test data rendering (e.g., color palette display in `colors/page.tsx`)

## Suggested Testing Stack

**For Next.js 16 with React 19:**
- **Runner:** Vitest or Jest
- **Testing Library:** React Testing Library or @testing-library/react
- **Assertions:** Vitest assertions or Jest expect
- **Mocking:** Vitest mocking capabilities or Jest mocking

**Example Setup (Not Yet Implemented):**
```bash
npm install -D vitest @testing-library/react @testing-library/dom
```

**Package.json scripts (to add when testing is implemented):**
```json
{
  "scripts": {
    "test": "vitest",
    "test:watch": "vitest --watch",
    "test:coverage": "vitest --coverage"
  }
}
```

## Testing Best Practices for This Codebase

**For Utilities:**
- Test edge cases for `cn()` className merging
- Verify proper handling of conflicting Tailwind classes

**For Components:**
- Test with different prop combinations (variants, sizes, states)
- Verify accessibility attributes (`aria-invalid`, `data-slot`)
- Test className application and merging

**For Hooks:**
- Test with mocked window/media queries
- Verify effects cleanup
- Test context error scenarios

**For Client Components:**
- Mock Next.js router for navigation testing
- Test state management and effects
- Verify event handlers

**For UI Primitives:**
- Test that radix-ui components are properly composed
- Verify styling applied correctly
- Test keyboard interactions from underlying radix components

---

*Testing analysis: 2026-02-20*
