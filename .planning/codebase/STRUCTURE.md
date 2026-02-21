# Codebase Structure

**Analysis Date:** 2026-02-20

## Directory Layout

```
dum-dashboard/
├── src/                          # Application source code
│   ├── app/                      # Next.js App Router pages and layout
│   │   ├── layout.tsx            # Root layout with sidebar and header
│   │   ├── page.tsx              # Home page (/)
│   │   ├── colors/
│   │   │   └── page.tsx          # Colors palette page (/colors)
│   │   ├── dumdo/
│   │   │   └── page.tsx          # Dumdo page (/dumdo)
│   │   └── monies/
│   │       └── page.tsx          # Monies page (/monies)
│   ├── components/               # Reusable React components
│   │   ├── app-sidebar.tsx       # Main navigation sidebar
│   │   └── ui/                   # UI component primitives
│   │       ├── button.tsx
│   │       ├── input.tsx
│   │       ├── separator.tsx
│   │       ├── sheet.tsx
│   │       ├── sidebar.tsx
│   │       ├── skeleton.tsx
│   │       ├── tooltip.tsx
│   │       ├── plug-connected-icon.tsx
│   │       └── types.ts
│   ├── hooks/                    # React custom hooks
│   │   └── use-mobile.ts         # Mobile breakpoint detection hook
│   ├── lib/                      # Utility functions
│   │   └── utils.ts              # Tailwind class merging utility
│   └── styles/                   # Global styles
│       └── globals.css           # Tailwind config, theme colors, animations
├── public/                       # Static assets
├── .next/                        # Next.js build output (generated)
├── .open-next/                   # OpenNext Cloudflare build (generated)
├── .planning/                    # GSD planning documentation
├── package.json                  # NPM dependencies and scripts
├── tsconfig.json                 # TypeScript configuration with path aliases
├── next.config.ts                # Next.js configuration
├── biome.json                    # Biome linter/formatter configuration
├── tailwind.config.ts            # (Implicit) Tailwind configuration
├── wrangler.jsonc                # Wrangler/Cloudflare Workers config
├── open-next.config.ts           # OpenNext deployment configuration
└── cloudflare-env.d.ts           # Cloudflare Worker environment types (generated)
```

## Directory Purposes

**src/app:**
- Purpose: Next.js App Router directory containing all page routes
- Contains: Page components using RSC (React Server Components) pattern
- Key files: `layout.tsx` (root layout), page.tsx files for each route

**src/components:**
- Purpose: Reusable React components organized by scope
- Contains: Application-level components (`app-sidebar.tsx`) and UI primitives
- Key files: `app-sidebar.tsx` (navigation), `ui/` subdirectory (primitives)

**src/components/ui:**
- Purpose: Radix UI-based accessible UI components with Tailwind styling
- Contains: Button, Input, Sidebar, Sheet, Tooltip, Separator, Skeleton primitives
- Key files: `sidebar.tsx` (complex state management), `button.tsx`, `input.tsx`

**src/hooks:**
- Purpose: Custom React hooks for reusable logic
- Contains: Mobile responsive detection hook
- Key files: `use-mobile.ts` (useIsMobile hook)

**src/lib:**
- Purpose: Utility functions and helpers
- Contains: Styling utilities and helper functions
- Key files: `utils.ts` (cn function for Tailwind merge)

**src/styles:**
- Purpose: Global CSS and theme configuration
- Contains: Tailwind directives, CSS variables, animations
- Key files: `globals.css` (color theme, Tailwind config)

**.next:**
- Purpose: Next.js build artifacts (generated during build)
- Generated: Yes - automatically created by `npm run build`
- Committed: No - in .gitignore

**.open-next:**
- Purpose: OpenNext/Cloudflare Workers build artifacts (generated)
- Generated: Yes - created during Cloudflare deployment build
- Committed: No - in .gitignore

## Key File Locations

**Entry Points:**
- `src/app/layout.tsx`: Root HTML layout with SidebarProvider wrapper
- `src/app/page.tsx`: Home/dashboard page at `/`
- `src/components/app-sidebar.tsx`: Navigation component mounted in layout

**Configuration:**
- `tsconfig.json`: TypeScript setup with `@/*` path alias for src imports
- `next.config.ts`: Next.js configuration with OpenNext Cloudflare dev initialization
- `biome.json`: Linter/formatter rules (2-space indent, double quotes, UI components ignored)
- `package.json`: Dependencies (Next.js 16.1.4, React 19.1.4, Tailwind 4)

**Core Logic:**
- `src/components/ui/sidebar.tsx`: Complex sidebar context management, responsive behavior
- `src/components/app-sidebar.tsx`: Navigation menu with icon mapping and data-driven rendering
- `src/hooks/use-mobile.ts`: Mobile detection via MediaQueryList at 768px breakpoint

**Styling:**
- `src/styles/globals.css`: Tailwind v4 @theme configuration, OKLCH color variables

**Utilities:**
- `src/lib/utils.ts`: `cn()` function for conditional Tailwind class merging

## Naming Conventions

**Files:**
- Pages: `page.tsx` (Next.js App Router convention)
- Components: `kebab-case.tsx` (e.g., `app-sidebar.tsx`)
- Hooks: `use-[feature].ts` (e.g., `use-mobile.ts`)
- Utilities: `[purpose].ts` (e.g., `utils.ts`)
- Types: `types.ts` for exported types within components (e.g., `src/components/ui/types.ts`)

**Directories:**
- Feature/page routes: lowercase slug format (e.g., `colors/`, `dumdo/`, `monies/`)
- Organizational: lowercase with hyphens for multi-word dirs (e.g., `app-sidebar`)
- Common patterns: `components/`, `hooks/`, `lib/`, `styles/` (plural where multiple items)

**Functions:**
- Hooks: camelCase with `use` prefix (e.g., `useIsMobile`, `useSidebar`)
- Utilities: camelCase (e.g., `cn`)
- Components: PascalCase (e.g., `AppSidebar`, `RootLayout`)

**Variables/Constants:**
- CSS variables: kebab-case with double dash (e.g., `--gray-950`, `--sidebar-ring`)
- Component props: camelCase (e.g., `className`, `asChild`)
- Data structures: camelCase (e.g., `sidebarItems` array)

## Where to Add New Code

**New Page/Route:**
- Primary code: `src/app/[route-name]/page.tsx` - Create directory with page.tsx file
- Styling: Use Tailwind classes; add custom CSS variables to `src/styles/globals.css` if needed
- Navigation: Add item to `sidebarItems` array in `src/components/app-sidebar.tsx`

**New Component/Module:**
- Reusable UI component: `src/components/[component-name].tsx`
- UI primitive (Radix-based): `src/components/ui/[component-name].tsx`
- Application-level component: `src/components/[feature-name].tsx`

**New Hook:**
- Location: `src/hooks/use-[feature-name].ts`
- Example: Mobile detection, form state, API data fetching

**Utilities:**
- Shared helpers: `src/lib/utils.ts` (add function or create new `src/lib/[purpose].ts`)
- Type definitions: `src/lib/types.ts` (if needed; currently not present)

**Styling:**
- Global theme updates: `src/styles/globals.css` - Add to `:root` or `@theme inline`
- Component-scoped: Use inline Tailwind classes in component files
- CSS modules: Not used; rely on Tailwind utility classes

**Testing:**
- Currently no test files present
- Future pattern: Co-locate with source files as `.test.ts` or `.test.tsx`
- Use Biome or Vitest when adding tests

## Special Directories

**.next:**
- Purpose: Next.js build output with compiled pages, server functions, static assets
- Generated: Yes - created by `npm run build` or `npm run dev`
- Committed: No - in .gitignore

**.open-next:**
- Purpose: Cloudflare Workers build artifacts for edge deployment
- Generated: Yes - created by `opennextjs-cloudflare build` or deployment commands
- Committed: No - in .gitignore

**node_modules:**
- Purpose: Installed npm packages
- Generated: Yes - created by `npm install` or `bun install`
- Committed: No - in .gitignore

**public:**
- Purpose: Static assets served at root (e.g., `/favicon.svg`)
- Generated: No - manually added static files
- Committed: Yes - static assets tracked in git

---

*Structure analysis: 2026-02-20*
