# Coding Conventions

**Analysis Date:** 2026-02-20

## Naming Patterns

**Files:**
- Components: PascalCase (e.g., `AppSidebar`, `Button`, `Input`)
- Pages: lowercase with hyphens (e.g., `page.tsx` in route directories)
- Utility files: lowercase (e.g., `utils.ts`)
- Hook files: kebab-case prefixed with `use-` (e.g., `use-mobile.ts`)
- Type/Interface files: lowercase (e.g., `types.ts`)

**Functions & Components:**
- React components: PascalCase (e.g., `function AppSidebar()`, `function Button()`)
- Custom hooks: camelCase with `use` prefix (e.g., `useIsMobile()`, `useSidebar()`)
- Utility functions: camelCase (e.g., `cn()`)
- Exported constants: UPPER_SNAKE_CASE (e.g., `SIDEBAR_COOKIE_NAME`, `MOBILE_BREAKPOINT`)

**Variables:**
- camelCase for all local variables and state (e.g., `isMobile`, `openProp`, `sidebarItems`)
- Destructured props maintain their property names

**Types:**
- PascalCase for interfaces and types (e.g., `AnimatedIconProps`, `SidebarContextProps`)
- Suffix `Props` for component prop types (e.g., `AnimatedIconProps`)
- Suffix `Handle` for imperative refs (e.g., `AnimatedIconHandle`)

## Code Style

**Formatting:**
- Tool: Biome 2.3.13
- Indent: 2 spaces
- Line endings: Standard

**Key Biome Settings:**
```json
{
  "indentStyle": "space",
  "indentWidth": 2,
  "quoteStyle": "double",
  "trailingCommas": "all"
}
```

**Linting:**
- Tool: Biome
- Config: `biome.json`
- Recommended rules enabled
- CSS linting enabled with Tailwind directives and CSS modules support
- Auto-organize imports enabled

**Exclusions:**
- `src/components/ui/**` - Linting and formatting disabled (UI components from shadcn/ui or similar)

## Import Organization

**Order:**
1. External dependencies from `node_modules` (e.g., `import * as React from "react"`, `import { Slot } from "@radix-ui/react-slot"`)
2. Next.js imports (e.g., `import type { Metadata } from "next"`)
3. Font imports (e.g., `import { Inter } from "next/font/google"`)
4. Relative imports from project root with alias (e.g., `import { AppSidebar } from "@/components/app-sidebar"`)
5. Style imports (e.g., `import "../styles/globals.css"`)

**Path Aliases:**
- `@/*` maps to `./src/*` as defined in `tsconfig.json`
- Used consistently throughout codebase (e.g., `@/components`, `@/lib`, `@/hooks`)

**Import Syntax:**
- Named imports for utilities (e.g., `import { cn } from "@/lib/utils"`)
- Namespace imports for larger dependencies (e.g., `import * as React from "react"`)
- Type imports using `import type` (e.g., `import type { Metadata } from "next"`)

## Error Handling

**Patterns:**
- Context-based error handling with `React.createContext` for null checks
- Custom hooks that check context existence and throw descriptive errors:
  ```typescript
  function useSidebar() {
    const context = React.useContext(SidebarContext);
    if (!context) {
      throw new Error("useSidebar must be used within a SidebarProvider.");
    }
    return context;
  }
  ```
- Type narrowing using conditional checks for state management

## Logging

**Framework:** None - uses console directly when needed

**Patterns:**
- Minimal logging in production code
- Comments used instead of logging for inline explanation

## Comments

**When to Comment:**
- Comments are used sparingly
- File headers: Used for special directives like `"use client"` in client components
- Inline comments: Minimal, only when logic is non-obvious
- JSDoc/TSDoc: Used for types and interfaces to document properties

**JSDoc/TSDoc:**
- Interface properties documented with `/** ... */` format (see `src/components/ui/types.ts`)
- Example:
  ```typescript
  export interface AnimatedIconProps {
    /** Icon size in pixels or CSS string */
    size?: number | string;
    /** Icon color (defaults to currentColor) */
    color?: string;
  }
  ```

## Function Design

**Size:**
- Small, focused functions preferred
- Components typically under 100 lines
- Complex logic extracted to custom hooks

**Parameters:**
- React components use destructured props with type annotations
- Props objects typed with `React.ComponentProps<"element">` when extending HTML elements
- Spread operator used for remaining props: `{...props}`
- Default parameters for optional values (e.g., `orientation = "horizontal"`)

**Return Values:**
- JSX for components
- Hooks return state or context values
- Utility functions return computed values
- Type narrowing with return type annotations (e.g., `React.useContext()` returns typed context)

## Module Design

**Exports:**
- Named exports for reusable components and functions (e.g., `export { Button, buttonVariants }`)
- Default exports for page components (e.g., `export default function Home()`)
- Named exports from utility modules (e.g., `export function cn()`)
- Barrel exports from component folders:
  ```typescript
  export {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
    TooltipProvider,
  };
  ```

**Barrel Files:**
- Not consistently used - components export themselves
- UI components export component and variant constants separately (e.g., `Button` and `buttonVariants`)

## TypeScript

**Strict Mode:** Enabled in `tsconfig.json`

**Key Settings:**
- `strict: true` - All strict checks enabled
- `skipLibCheck: true` - Skip type checking for node_modules
- `moduleResolution: "bundler"` - Modern module resolution
- `jsx: "react-jsx"` - New JSX transform

**Type Usage:**
- Explicit type annotations for component props and return types
- `type` keyword for type-only imports
- `React.ComponentProps<"element">` for native element prop types
- Conditional type unions for variant props (e.g., `VariantProps<typeof buttonVariants>`)

## Client Components

**Directive:** `"use client"` declared at top of file for client-side interactive components
- Used in components with state, effects, or event handlers
- Examples: `app-sidebar.tsx`, `sidebar.tsx`, `separator.tsx`
- Server components (no directive) used for static content and layouts

## Utility Patterns

**Class Name Merging:**
- All UI components use `cn()` utility from `@/lib/utils`
- Combines `clsx` and `tailwind-merge` for proper Tailwind class override behavior
- Pattern: `className={cn(buttonVariants({ variant, size, className }))}`

**Component Variants:**
- `class-variance-authority` (CVA) used for component variant systems
- Examples: `button.tsx`, `sidebar.tsx`
- Variants defined with structure:
  ```typescript
  const buttonVariants = cva(baseStyles, {
    variants: {
      variant: { /* variant options */ },
      size: { /* size options */ },
    },
    defaultVariants: { /* defaults */ },
  });
  ```

**Data Attributes:**
- UI components often include `data-slot` and `data-variant`/`data-size` attributes for testing/styling
- Example: `<button data-slot="button" data-variant={variant} />`

---

*Convention analysis: 2026-02-20*
