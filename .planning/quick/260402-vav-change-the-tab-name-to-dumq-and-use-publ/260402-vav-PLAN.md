---
phase: quick
plan: 260402-vav
type: execute
wave: 1
depends_on: []
files_modified:
  - src/routes/__root.tsx
  - src/components/AppSidebar.tsx
  - public/manifest.json
autonomous: true
requirements: []
must_haves:
  truths:
    - "Browser tab displays 'Dumq' as the page title"
    - "Browser tab shows the custom favicon.ico from public/"
    - "Sidebar header shows the favicon.ico image instead of the LayoutDashboard icon"
    - "Sidebar header text reads 'Dumq' instead of 'Dashboard'"
  artifacts:
    - path: "src/routes/__root.tsx"
      provides: "Title set to Dumq and favicon link tag"
      contains: "Dumq"
    - path: "src/components/AppSidebar.tsx"
      provides: "Sidebar header with favicon image and Dumq text"
      contains: "Dumq"
    - path: "public/manifest.json"
      provides: "Updated PWA manifest with Dumq name"
      contains: "Dumq"
  key_links:
    - from: "src/routes/__root.tsx"
      to: "public/favicon.ico"
      via: "link rel=icon href"
      pattern: "rel.*icon.*favicon"
---

<objective>
Change the browser tab title to "Dumq", add the favicon.ico link to the HTML head, and replace the sidebar header icon with the favicon image and update the sidebar label to "Dumq".

Purpose: Brand the dashboard with the correct name and logo.
Output: Updated root route, sidebar component, and manifest.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/routes/__root.tsx
@src/components/AppSidebar.tsx
@public/manifest.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Update tab title to Dumq and add favicon link</name>
  <files>src/routes/__root.tsx, public/manifest.json</files>
  <action>
In src/routes/__root.tsx:
1. Change the meta title from "Dashboard" to "Dumq" (line 16, inside the head() function's meta array).
2. Add a favicon link entry to the `links` array alongside the existing stylesheet link:
   ```
   { rel: "icon", href: "/favicon.ico", type: "image/x-icon" }
   ```

In public/manifest.json:
1. Change "short_name" from "TanStack App" to "Dumq".
2. Change "name" from "Create TanStack App Sample" to "Dumq".
3. Remove the logo192.png and logo512.png icon entries (those files were already deleted from public/) — keep only the favicon.ico entry.
  </action>
  <verify>
    <automated>grep -q "Dumq" src/routes/__root.tsx && grep -q "favicon" src/routes/__root.tsx && grep -q "Dumq" public/manifest.json && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>Browser tab shows "Dumq" as page title, favicon.ico is linked in the HTML head, manifest.json references "Dumq" with only the favicon.ico icon entry.</done>
</task>

<task type="auto">
  <name>Task 2: Replace sidebar header icon with favicon image and update label</name>
  <files>src/components/AppSidebar.tsx</files>
  <action>
In src/components/AppSidebar.tsx:
1. Remove the `LayoutDashboard` import from lucide-react (line 2) — it is no longer used after this change. Keep `LayoutGrid` since it is still used for the Overview nav item.
2. In the SidebarHeader section (lines 46-51), replace the LayoutDashboard icon element with an img tag:
   ```tsx
   <img src="/favicon.ico" alt="Dumq" className="size-6" />
   ```
3. Change the sidebar label text from "Dashboard" to "Dumq" (the span on line 48-49).

The final SidebarHeader content should look like:
```tsx
<SidebarHeader>
  <div className="flex items-center gap-2 px-4 py-3">
    <img src="/favicon.ico" alt="Dumq" className="size-6" />
    <span className="text-sm font-semibold text-neutral-100 group-data-[collapsible=icon]:hidden">
      Dumq
    </span>
  </div>
</SidebarHeader>
```
  </action>
  <verify>
    <automated>grep -q "Dumq" src/components/AppSidebar.tsx && grep -q "favicon.ico" src/components/AppSidebar.tsx && ! grep -q "LayoutDashboard" src/components/AppSidebar.tsx && echo "PASS" || echo "FAIL"</automated>
  </verify>
  <done>Sidebar header displays the favicon.ico image as the logo and shows "Dumq" as the label. LayoutDashboard import is removed (no unused imports).</done>
</task>

</tasks>

<verification>
- `bun run build` completes without errors (no broken imports)
- Browser tab title reads "Dumq"
- Favicon appears in the browser tab
- Sidebar header shows the favicon image and "Dumq" text
</verification>

<success_criteria>
- Tab title is "Dumq" (not "Dashboard")
- Favicon.ico is linked in the HTML head and visible in the browser tab
- Sidebar header uses favicon.ico as the logo image (not LayoutDashboard icon)
- Sidebar header label reads "Dumq" (not "Dashboard")
- manifest.json updated with "Dumq" name, stale icon references removed
- No unused imports remain
</success_criteria>

<output>
After completion, create `.planning/quick/260402-vav-change-the-tab-name-to-dumq-and-use-publ/260402-vav-SUMMARY.md`
</output>
