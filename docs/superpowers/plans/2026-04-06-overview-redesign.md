# Overview Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the aggregate-stats TodoBentoCard with a full scrollable list, add a live 24h clock widget, and restructure the overview grid to a 2fr/1fr layout.

**Architecture:** The `ToolEntry` registry gains an `overviewOnly` flag so widgets like the clock can live in the overview without a sidebar entry or dedicated route. The overview grid is split into a wide left column (todos) and a narrow right column (clock + future tools stacked vertically). The TodoBentoCard is rewritten from scratch; all other files are minimally touched.

**Tech Stack:** React 19, TanStack Start, Tailwind v4, Lucide React, Vitest + Testing Library

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/tools/registry.ts` | Modify | Add `overviewOnly?: boolean` to `ToolEntry`; add clock entry |
| `src/components/AppSidebar.tsx` | Modify | Filter `overviewOnly` tools from nav items |
| `src/tools/ClockBentoCard.tsx` | **Create** | 24h HH:MM clock, client-only interval |
| `src/tools/ClockBentoCard.test.tsx` | **Create** | Tests for clock rendering and tick behaviour |
| `src/routes/_layout/todos/-TodoBentoCard.tsx` | Modify | Replace aggregate stats with scrollable grouped list |
| `src/routes/_layout/todos/-TodoBentoCard.test.tsx` | Modify | Replace all existing tests with tests for new list UI |
| `src/routes/_layout/index.tsx` | Modify | 2fr/1fr grid, updated loading skeleton |

---

## Task 1: Extend ToolEntry + filter sidebar

**Files:**
- Modify: `src/tools/registry.ts`
- Modify: `src/components/AppSidebar.tsx`

- [ ] **Step 1: Add `overviewOnly` to `ToolEntry` in registry.ts**

Replace the entire file content:

```ts
import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckSquare } from "lucide-react";
import { TodoBentoCard } from "#/routes/_layout/todos/-TodoBentoCard";
import { getTodos } from "#/routes/todos/todos.functions";

export interface ToolEntry {
  id: string;
  label: string;
  route: string;
  icon: LucideIcon;
  BentoCard: ComponentType<{ tool: ToolEntry; data: unknown }>;
  loadData?: () => Promise<unknown>;
  overviewOnly?: boolean;
}

export const tools: ToolEntry[] = [
  {
    id: "todos",
    label: "Todos",
    route: "/todos",
    icon: CheckSquare,
    BentoCard: TodoBentoCard,
    loadData: getTodos,
  },
];
```

- [ ] **Step 2: Filter `overviewOnly` tools from sidebar nav**

In `src/components/AppSidebar.tsx`, find the `tools.map(...)` block inside `<SidebarMenu>` and add a filter before `.map`:

```tsx
{tools
  .filter((tool) => !tool.overviewOnly)
  .map((tool: ToolEntry) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isActive = Boolean(matchRoute({ to: tool.route as any }));
    return (
      <SidebarMenuItem key={tool.id}>
        <NavItem tool={tool} isActive={isActive} />
      </SidebarMenuItem>
    );
  })}
```

- [ ] **Step 3: Run type check**

```bash
cd /Users/isolumi/Documents/CS/dum-dashboard && bunx tsc --noEmit
```

Expected: no errors related to `ToolEntry` or `AppSidebar`.

- [ ] **Step 4: Commit**

```bash
git add src/tools/registry.ts src/components/AppSidebar.tsx
git commit -m "feat: add overviewOnly flag to ToolEntry, filter sidebar"
```

---

## Task 2: Create ClockBentoCard

**Files:**
- Create: `src/tools/ClockBentoCard.tsx`
- Create: `src/tools/ClockBentoCard.test.tsx`
- Modify: `src/tools/registry.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/tools/ClockBentoCard.test.tsx`:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, act } from "@testing-library/react";
import React from "react";
import type { ToolEntry } from "#/tools/registry";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const { ClockBentoCard } = await import("./ClockBentoCard");

const mockTool = {
  id: "clock",
  label: "Clock",
  route: "/",
  icon: () => null,
  BentoCard: () => null,
  overviewOnly: true,
} as unknown as ToolEntry;

describe("ClockBentoCard", () => {
  it("renders current time in HH:MM format", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T14:37:00"));
    render(React.createElement(ClockBentoCard, { tool: mockTool, data: null }));
    expect(screen.getByText("14:37")).toBeTruthy();
  });

  it("zero-pads single-digit hours and minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T09:05:00"));
    render(React.createElement(ClockBentoCard, { tool: mockTool, data: null }));
    expect(screen.getByText("09:05")).toBeTruthy();
  });

  it("renders the 24h label", () => {
    render(React.createElement(ClockBentoCard, { tool: mockTool, data: null }));
    expect(screen.getByText("24h")).toBeTruthy();
  });

  it("updates display after one minute elapses", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T14:37:00"));
    render(React.createElement(ClockBentoCard, { tool: mockTool, data: null }));
    expect(screen.getByText("14:37")).toBeTruthy();

    act(() => {
      vi.setSystemTime(new Date("2026-01-01T14:38:00"));
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText("14:38")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/isolumi/Documents/CS/dum-dashboard && bun test src/tools/ClockBentoCard.test.tsx
```

Expected: FAIL — `ClockBentoCard` not found.

- [ ] **Step 3: Create ClockBentoCard implementation**

Create `src/tools/ClockBentoCard.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { ToolEntry } from "#/tools/registry";

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function ClockBentoCard({ tool: _tool, data: _data }: { tool: ToolEntry; data: unknown }) {
  const [time, setTime] = useState(() => formatTime(new Date()));

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime(new Date())), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-border bg-card p-6">
      <time className="text-4xl font-light tabular-nums tracking-wider text-foreground">
        {time}
      </time>
      <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">24h</span>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/isolumi/Documents/CS/dum-dashboard && bun test src/tools/ClockBentoCard.test.tsx
```

Expected: 4 tests PASS.

- [ ] **Step 5: Add clock entry to registry**

In `src/tools/registry.ts`, add the `Clock` icon import and clock entry:

```ts
import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckSquare, Clock } from "lucide-react";
import { TodoBentoCard } from "#/routes/_layout/todos/-TodoBentoCard";
import { ClockBentoCard } from "#/tools/ClockBentoCard";
import { getTodos } from "#/routes/todos/todos.functions";

export interface ToolEntry {
  id: string;
  label: string;
  route: string;
  icon: LucideIcon;
  BentoCard: ComponentType<{ tool: ToolEntry; data: unknown }>;
  loadData?: () => Promise<unknown>;
  overviewOnly?: boolean;
}

export const tools: ToolEntry[] = [
  {
    id: "todos",
    label: "Todos",
    route: "/todos",
    icon: CheckSquare,
    BentoCard: TodoBentoCard,
    loadData: getTodos,
  },
  {
    id: "clock",
    label: "Clock",
    route: "/",
    icon: Clock,
    BentoCard: ClockBentoCard,
    overviewOnly: true,
  },
];
```

- [ ] **Step 6: Run type check**

```bash
cd /Users/isolumi/Documents/CS/dum-dashboard && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/tools/ClockBentoCard.tsx src/tools/ClockBentoCard.test.tsx src/tools/registry.ts
git commit -m "feat: add ClockBentoCard with 24h HH:MM display"
```

---

## Task 3: Rewrite TodoBentoCard

**Files:**
- Modify: `src/routes/_layout/todos/-TodoBentoCard.test.tsx`
- Modify: `src/routes/_layout/todos/-TodoBentoCard.tsx`

- [ ] **Step 1: Replace existing tests with tests for the new list UI**

Overwrite `src/routes/_layout/todos/-TodoBentoCard.test.tsx` entirely:

```tsx
/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import React from "react";

import type { Todo } from "#/lib/database.types";
import type { ToolEntry } from "#/tools/registry";

afterEach(() => {
  cleanup();
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    to,
    children,
    ...props
  }: {
    to: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => React.createElement("a", { href: to, ...props }, children),
}));

const { TodoBentoCard } = await import("./-TodoBentoCard");

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: crypto.randomUUID(),
    name: "Test todo",
    status: "not_started" as const,
    priority: "medium" as const,
    due_date: null,
    sort_order: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const PAST_DATE = "2020-01-01";
const FUTURE_DATE = "2099-12-31";

const mockTool = {
  id: "todos",
  label: "Todos",
  route: "/todos",
  icon: () => null,
  BentoCard: () => null,
} as unknown as ToolEntry;

describe("TodoBentoCard", () => {
  it("renders priority section labels for non-empty sections", () => {
    const todos = [
      makeTodo({ priority: "high" }),
      makeTodo({ priority: "low" }),
    ];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    expect(screen.getByText("High")).toBeTruthy();
    expect(screen.getByText("Low")).toBeTruthy();
  });

  it("hides priority section label when section is empty", () => {
    const todos = [makeTodo({ priority: "medium" })];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    expect(screen.queryByText("High")).toBeNull();
    expect(screen.queryByText("Low")).toBeNull();
    expect(screen.getByText("Medium")).toBeTruthy();
  });

  it("renders todo names inside their priority sections", () => {
    const todos = [
      makeTodo({ priority: "high", name: "Fix auth bug" }),
      makeTodo({ priority: "low", name: "Update deps" }),
    ];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    expect(screen.getByText("Fix auth bug")).toBeTruthy();
    expect(screen.getByText("Update deps")).toBeTruthy();
  });

  it("formats due date as 'Mon D' (e.g. Jan 1)", () => {
    const todos = [makeTodo({ due_date: "2026-04-10" })];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    expect(screen.getByText("Apr 10")).toBeTruthy();
  });

  it("shows dash when due_date is null", () => {
    const todos = [makeTodo({ due_date: null })];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    expect(screen.getByText("—")).toBeTruthy();
  });

  it("marks overdue due date with aria-label for past-due incomplete todos", () => {
    const todos = [makeTodo({ due_date: PAST_DATE, status: "not_started" })];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    // Implementation adds aria-label="Overdue: Jan 1" on the date span
    expect(screen.getByLabelText(/overdue/i)).toBeTruthy();
  });

  it("does not mark completed todos as overdue even with past due date", () => {
    const todos = [makeTodo({ due_date: PAST_DATE, status: "complete" })];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    // Completed todos skip the overdue aria-label
    expect(screen.queryByLabelText(/overdue/i)).toBeNull();
  });

  it("wraps completed todo name in <s> (strikethrough)", () => {
    const todos = [makeTodo({ status: "complete", name: "Done task" })];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    const nameEl = screen.getByText("Done task");
    expect(nameEl.tagName.toLowerCase()).toBe("s");
  });

  it("renders the card as a link to /todos", () => {
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: [] }));

    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/todos");
  });

  it("shows empty state message when there are no todos", () => {
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: [] }));
    expect(screen.getByText(/no todos yet/i)).toBeTruthy();
  });

  it("handles null data without throwing", () => {
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: null }));
    expect(screen.getByText(/no todos yet/i)).toBeTruthy();
  });

  it("sorts todos within a section by sort_order ascending", () => {
    const todos = [
      makeTodo({ priority: "high", name: "Second", sort_order: 1 }),
      makeTodo({ priority: "high", name: "First", sort_order: 0 }),
    ];
    render(React.createElement(TodoBentoCard, { tool: mockTool, data: todos }));

    const names = screen.getAllByText(/first|second/i).map((el) => el.textContent);
    expect(names[0]).toMatch(/first/i);
    expect(names[1]).toMatch(/second/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/isolumi/Documents/CS/dum-dashboard && bun test src/routes/_layout/todos/-TodoBentoCard.test.tsx
```

Expected: FAIL — existing component doesn't match new expectations.

- [ ] **Step 3: Rewrite TodoBentoCard implementation**

Overwrite `src/routes/_layout/todos/-TodoBentoCard.tsx` entirely:

```tsx
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckSquare, Circle, CircleCheck, CircleDot } from "lucide-react";

import type { Todo, TodoPriority } from "#/lib/database.types";
import type { ToolEntry } from "#/tools/registry";

const PRIORITY_ORDER: TodoPriority[] = ["high", "medium", "low"];
const PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function formatDueDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function TodoRow({ todo, today }: { todo: Todo; today: Date }) {
  const isComplete = todo.status === "complete";
  const isOverdue =
    !isComplete && todo.due_date !== null && new Date(todo.due_date) < today;

  return (
    <div className="flex items-center gap-2 border-b border-border/40 py-1 last:border-0">
      {todo.status === "not_started" && (
        <Circle className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      {todo.status === "started" && (
        <CircleDot className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
      )}
      {todo.status === "complete" && (
        <CircleCheck className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}

      {isComplete ? (
        <s className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{todo.name}</s>
      ) : (
        <span className="min-w-0 flex-1 truncate text-xs text-foreground">{todo.name}</span>
      )}

      <span
        className={`shrink-0 text-xs ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}
        aria-label={isOverdue ? `Overdue: ${formatDueDate(todo.due_date!)}` : undefined}
      >
        {todo.due_date ? formatDueDate(todo.due_date) : "—"}
      </span>
    </div>
  );
}

export function TodoBentoCard({ tool: _tool, data }: { tool: ToolEntry; data: unknown }) {
  const todos = Array.isArray(data) ? (data as Todo[]) : [];
  const today = new Date(new Date().toISOString().split("T")[0]);

  const grouped = PRIORITY_ORDER.reduce<Record<TodoPriority, Todo[]>>(
    (acc, p) => {
      acc[p] = todos
        .filter((t) => t.priority === p)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      return acc;
    },
    { high: [], medium: [], low: [] },
  );

  return (
    <Link
      to="/todos"
      aria-label="Open Todos tool"
      className="block rounded-lg border border-border bg-card transition-colors duration-150 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <CheckSquare className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1 text-sm font-normal text-foreground">Todos</span>
        <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
      </div>

      <div className="max-h-96 overflow-y-auto p-4">
        {todos.length === 0 ? (
          <p className="text-xs text-muted-foreground">No todos yet.</p>
        ) : (
          PRIORITY_ORDER.map((priority) => {
            const items = grouped[priority];
            if (items.length === 0) return null;
            return (
              <div key={priority} className="mb-3 last:mb-0">
                <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {PRIORITY_LABELS[priority]}
                </div>
                {items.map((todo) => (
                  <TodoRow key={todo.id} todo={todo} today={today} />
                ))}
              </div>
            );
          })
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/isolumi/Documents/CS/dum-dashboard && bun test src/routes/_layout/todos/-TodoBentoCard.test.tsx
```

Expected: 12 tests PASS.

- [ ] **Step 5: Run all tests to check for regressions**

```bash
cd /Users/isolumi/Documents/CS/dum-dashboard && bun test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/routes/_layout/todos/-TodoBentoCard.tsx src/routes/_layout/todos/-TodoBentoCard.test.tsx
git commit -m "feat: rewrite TodoBentoCard as scrollable grouped list"
```

---

## Task 4: Update overview grid

**Files:**
- Modify: `src/routes/_layout/index.tsx`

- [ ] **Step 1: Rewrite the overview page with the 2fr/1fr grid**

Overwrite `src/routes/_layout/index.tsx` entirely:

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "#/components/ui/skeleton";
import { tools } from "#/tools/registry";

export const Route = createFileRoute("/_layout/")({
  loader: async () => {
    const results = await Promise.all(
      tools.map((tool) => tool.loadData?.() ?? Promise.resolve(null)),
    );
    const toolData: Record<string, unknown> = {};
    tools.forEach((tool, i) => {
      toolData[tool.id] = results[i];
    });
    return { toolData };
  },
  pendingComponent: OverviewLoading,
  errorComponent: OverviewError,
  component: OverviewPage,
});

function OverviewLoading() {
  return (
    <main className="p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr] md:gap-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <Skeleton className="mb-4 h-4 w-24" />
          <Skeleton className="mb-3 h-4 w-40" />
          <Skeleton className="mb-2 h-3 w-32" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="flex flex-col gap-4 md:gap-6">
          <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card p-6 gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-3 w-8" />
          </div>
        </div>
      </div>
    </main>
  );
}

function OverviewError() {
  return (
    <main className="p-6">
      <p className="text-sm text-destructive">Could not load overview. Refresh to try again.</p>
    </main>
  );
}

function OverviewPage() {
  const { toolData } = Route.useLoaderData();
  const [firstTool, ...remainingTools] = tools;

  return (
    <main className="p-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr] md:gap-6">
        {firstTool && (
          <firstTool.BentoCard tool={firstTool} data={toolData[firstTool.id]} />
        )}
        {remainingTools.length > 0 && (
          <div className="flex flex-col gap-4 md:gap-6">
            {remainingTools.map((tool) => (
              <tool.BentoCard key={tool.id} tool={tool} data={toolData[tool.id]} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
cd /Users/isolumi/Documents/CS/dum-dashboard && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
cd /Users/isolumi/Documents/CS/dum-dashboard && bun test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/_layout/index.tsx
git commit -m "feat: restructure overview to 2fr/1fr grid with clock widget"
```
