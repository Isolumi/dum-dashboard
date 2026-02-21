# Technology Stack

**Analysis Date:** 2026-02-20

## Languages

**Primary:**
- TypeScript 5.7.4 - Type-safe frontend and configuration files
- JavaScript (JSX/TSX) - React components and utilities
- CSS - Styling via Tailwind CSS v4

## Runtime

**Environment:**
- Node.js - Next.js server runtime
- Bun (recommended per `CLAUDE.md`) - Alternative package manager and runtime

**Package Manager:**
- npm (from `package.json` scripts) - Primary package manager listed in dependencies
- Bun (recommended per project instructions) - Modern runtime with built-in package management
- Lockfile: `bun.lock` present (383KB)

## Frameworks

**Core:**
- Next.js 16.1.4 - Full-stack React framework with App Router
- React 19.1.4 - UI library
- React-DOM 19.1.4 - React DOM rendering

**Styling & UI:**
- Tailwind CSS 4 - Utility-first CSS framework
- @tailwindcss/postcss 4 - PostCSS plugin for Tailwind
- tailwind-merge 3.4.0 - Merge Tailwind classnames safely
- class-variance-authority 0.7.1 - Component variant pattern library

**Icons & Visual:**
- @phosphor-icons/react 2.1.10 - Icon library
- lucide-react 0.563.0 - Alternative icon library
- motion 12.29.2 - Animation library

**Deployment & Hosting:**
- @opennextjs/cloudflare 1.16.0 - Cloudflare Workers adapter for Next.js
- opennextjs-cloudflare CLI - Deployment tooling for Cloudflare platform

**Components:**
- @radix-ui/react-dialog 1.1.15 - Dialog/modal primitive
- @radix-ui/react-separator 1.1.8 - Separator primitive
- @radix-ui/react-slot 1.2.4 - Slot pattern primitive
- @radix-ui/react-tooltip 1.2.8 - Tooltip primitive

**Utilities:**
- clsx 2.1.1 - Classname conditionals
- tw-animate-css 1.4.0 - Extended Tailwind animations

## Key Dependencies

**Critical:**
- Next.js 16.1.4 - Web framework providing App Router, server components, and development server
- React 19.1.4 - UI rendering and component framework
- @opennextjs/cloudflare 1.16.0 - Enables Next.js deployment to Cloudflare Workers platform

**Infrastructure:**
- Tailwind CSS 4 - CSS framework with utility classes and custom theme configuration in `src/styles/globals.css`
- @phosphor-icons/react 2.1.10 - Icon component library used in `src/components/app-sidebar.tsx`
- wrangler 4.60.0 - Cloudflare Workers CLI for deployment and local development

## Dev Dependencies

**Build & Bundling:**
- TypeScript 5.7.4 - Type checking
- @types/node 25.0.10 - Node.js type definitions
- @types/react 19 - React type definitions
- @types/react-dom 19 - React-DOM type definitions
- @types/bun latest - Bun runtime type definitions

**Linting & Formatting:**
- @biomejs/biome 2.3.13 - Fast linter and formatter (configured in `biome.json`)

**Deployment:**
- wrangler 4.60.0 - Cloudflare Workers CLI for build and deployment

## Configuration

**Environment:**
- `.dev.vars` - Local Cloudflare Workers environment variables
- Environment variables are auto-loaded by Bun (per `CLAUDE.md`)
- No `.env` file usage required - handled by Wrangler

**Build:**
- `next.config.ts` - Next.js configuration (minimal, enables OpenNext Cloudflare dev mode)
- `open-next.config.ts` - OpenNext configuration for Cloudflare (currently empty, supports R2 caching)
- `wrangler.jsonc` - Cloudflare Workers configuration
  - Compatibility date: 2025-12-01
  - Compatibility flags: nodejs_compat, global_fetch_strictly_public
  - Assets binding to ASSETS for static files
  - Images binding to IMAGES for image optimization
  - Service binding to WORKER_SELF_REFERENCE
  - Observability enabled

**PostCSS:**
- `postcss.config.mjs` - PostCSS configuration for Tailwind v4 via @tailwindcss/postcss plugin

**TypeScript:**
- `tsconfig.json` - Type checking configuration
  - Target: ES2024
  - Module resolution: bundler
  - Strict mode enabled
  - Path aliases: `@/*` maps to `./src/*`
  - Includes Cloudflare environment types (`cloudflare-env.d.ts`)

**Linting:**
- `biome.json` - Biomejs linting and formatting configuration
  - Git integration enabled
  - Format: 2-space indentation
  - Linter: recommended rules
  - Tailwind directive support in CSS
  - Double quotes for JavaScript
  - Trailing commas: all
  - Auto import organization enabled
  - Disabled for `src/components/ui/**` (shadcn components)

## Platform Requirements

**Development:**
- Node.js runtime (or Bun as recommended alternative per `CLAUDE.md`)
- Bun package manager (recommended)
- Wrangler CLI v4.60.0 for local Cloudflare development
- Modern browser for UI testing

**Production:**
- Cloudflare Workers platform for deployment
- Cloudflare R2 storage (optional, commented out in `open-next.config.ts`)
- Cloudflare Image Optimization service (optional, configured in `wrangler.jsonc`)

## Build Commands

```bash
npm run dev      # Start Next.js development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run Biome linter
npm run format   # Format code with Biome
npm run check    # Check and auto-fix with Biome
npm run deploy   # Build and deploy to Cloudflare
npm run upload   # Build and upload to Cloudflare
npm run preview  # Build and preview on local Cloudflare runtime
npm run cf-typegen  # Generate Cloudflare environment types
```

---

*Stack analysis: 2026-02-20*
