# Architecture

**Analysis Date:** 2026-02-20

## Pattern Overview

**Overall:** Next.js App Router with Client-Side Sidebar Management

**Key Characteristics:**
- File-based routing using Next.js App Router (`src/app/` directory)
- Server Components by default with selective client-side interactivity
- Responsive sidebar navigation component using React Context
- Tailwind CSS v4 with custom theme variables (OKLCH color space)
- Cloudflare Workers deployment via OpenNext
- Radix UI component primitives for accessibility

## Layers

**Application Shell (Layout):**
- Purpose: Provides the root layout with persistent sidebar and header navigation
- Location: `src/app/layout.tsx`
- Contains: Root HTML structure, SidebarProvider wrapper, responsive header
- Depends on: `AppSidebar`, UI primitives (`Separator`, `SidebarProvider`, `SidebarTrigger`)
- Used by: All page components inherit this layout

**Page Layer:**
- Purpose: Server Components that render individual pages accessible via Next.js routing
- Location: `src/app/page.tsx`, `src/app/colors/page.tsx`, `src/app/dumdo/page.tsx`, `src/app/monies/page.tsx`
- Contains: Page-specific content and markup
- Depends on: UI components and utilities as needed
- Used by: Next.js router automatically maps these to routes (/, /colors, /dumdo, /monies)

**Component Layer:**
- Purpose: Reusable UI components including navigation and primitives
- Location: `src/components/` (includes `app-sidebar.tsx` and `ui/` subdirectory)
- Contains: `AppSidebar` (navigation with icon mapping and links), Radix UI-based primitives
- Depends on: `@radix-ui/react-*` packages, Phosphor icons, Lucide icons, utilities
- Used by: Layout and pages

**Utility Layer:**
- Purpose: Shared helper functions and styling utilities
- Location: `src/lib/utils.ts`, `src/hooks/use-mobile.ts`
- Contains: `cn()` function for conditional Tailwind class merging, responsive mobile detection hook
- Depends on: `clsx`, `tailwind-merge` packages
- Used by: Components throughout the application

**Styling Layer:**
- Purpose: Global styles and Tailwind theme configuration
- Location: `src/styles/globals.css`
- Contains: Custom color variables (OKLCH format), radius scale definitions, Tailwind directive imports
- Depends on: Tailwind CSS v4, tw-animate-css
- Used by: All components via Tailwind class names

## Data Flow

**Navigation Flow:**

1. User clicks link in `AppSidebar` component
2. Link points to Next.js route (e.g., `/colors`)
3. Next.js router loads corresponding page component (e.g., `colors/page.tsx`)
4. Page renders within the `RootLayout` shell
5. Sidebar state context (`SidebarContext`) managed by `SidebarProvider`

**Responsive State Flow:**

1. `useIsMobile()` hook detects viewport width changes via MediaQueryList
2. Updates mobile state at 768px breakpoint
3. `SidebarProvider` uses this to switch between sidebar and mobile sheet
4. Mobile view shows sidebar in Sheet overlay, desktop shows persistent sidebar

**Styling State Flow:**

1. CSS variables defined in `:root` selector in `globals.css`
2. Tailwind theme ingests variables via `@theme inline` directive
3. Components use Tailwind classes which reference theme variables
4. `cn()` utility resolves conditional classes with proper Tailwind merge conflict resolution

## Key Abstractions

**SidebarProvider Context:**
- Purpose: Manages sidebar open/closed state and mobile detection
- Examples: `src/app/layout.tsx` wraps app in `SidebarProvider`, `src/components/ui/sidebar.tsx` exposes `useSidebar()` hook
- Pattern: React Context API for state, hooks for consumption

**UI Component Primitives:**
- Purpose: Encapsulate Radix UI components with Tailwind styling (Button, Input, Separator, Sheet, Sidebar, Tooltip, Skeleton, Dialog)
- Examples: `src/components/ui/button.tsx`, `src/components/ui/input.tsx`, `src/components/ui/sidebar.tsx`
- Pattern: CVA (class-variance-authority) for variant management, Radix for behavior

**Theme/Color System:**
- Purpose: Centralized color and spacing definitions using OKLCH color space
- Examples: Custom CSS variables in `src/styles/globals.css` (e.g., `--gray-950`, `--primary`, `--chart-1`)
- Pattern: CSS custom properties mapped through Tailwind theme

**Navigation Structure:**
- Purpose: Defines sidebar items with labels, routes, and icons
- Examples: `sidebarItems` array in `src/components/app-sidebar.tsx` maps to `/`, `/monies`, `/dumdo`, `/colors`
- Pattern: Data-driven rendering using `.map()` to generate navigation menu

## Entry Points

**Application Entry:**
- Location: `src/app/layout.tsx`
- Triggers: Browser navigates to any route
- Responsibilities: Render HTML shell, provide SidebarProvider context, render header with SidebarTrigger, mount page content in main area

**Page Entry Points:**
- `src/app/page.tsx` - Home/Dashboard page at `/`
- `src/app/colors/page.tsx` - Color palette showcase at `/colors`
- `src/app/dumdo/page.tsx` - Dumdo section at `/dumdo` (placeholder)
- `src/app/monies/page.tsx` - Monies section at `/monies` (placeholder)

**Navigation Entry:**
- Location: `src/components/app-sidebar.tsx`
- Triggers: User interaction with sidebar, layout mount
- Responsibilities: Render sidebar with icon navigation, handle route links via Next.js Link component

## Error Handling

**Strategy:** Implicit error boundary via Next.js (not explicitly configured)

**Patterns:**
- No explicit error handling visible in application code
- Relies on Next.js built-in error boundary for server-side errors
- Client-side errors would surface without explicit catch/fallback
- No validation or error messages shown in form inputs or API calls

## Cross-Cutting Concerns

**Logging:** Not implemented - no logging framework detected

**Validation:** Not implemented - no validation library detected; pages render without input validation

**Authentication:** Not implemented - no auth provider or middleware detected

**Responsive Design:**
- Implemented via `useIsMobile()` hook at 768px breakpoint
- Sidebar switches between persistent desktop view and mobile sheet overlay
- Tailwind responsive classes (e.g., `flex-col flex-1`) handle layout adaptation

**Styling:**
- Tailwind CSS v4 as primary styling approach
- Biome formatter with 2-space indent configured
- `cn()` utility used throughout for conditional class composition
- Custom theme colors via OKLCH variables instead of default Tailwind palette

---

*Architecture analysis: 2026-02-20*
