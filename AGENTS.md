# AI Agent Contribution Guide

Last Updated: November 3, 2025  
Audience: AI coding assistants (GitHub Copilot, Claude, Cursor, etc.)

---

## 1. Purpose & Scope
Render GitHub Copilot VS Code chat logs as a static Next.js site (App Router, `output: 'export'`). Everything is client-side: paste a Gist URL → fetch → parse → render. Focus: correctness, clarity, accessibility, and maintainability.

Core guardrails:
1. Static export only (no API routes, no server components, no runtime data fetching on the server).
2. Library‑first architecture (parser is pure TypeScript, UI-free, fully unit tested).
3. Zero `any` types; strict TypeScript must pass.
4. Interleaved `contentSegments` preserve exact original ordering.
5. Accessibility: semantic HTML + ARIA labels.
6. Resilience: retries, timeouts, rate limit awareness.

---

## 2. Architecture (Top → Bottom)
```
src/app/        Next.js pages & layout (entry points)
src/components/ Presentational + interactive React components ('use client')
src/lib/        Fetching, history, generic utilities
src/lib/parser/ Pure parsing logic (no React/DOM/Next imports)
```
Rules:
- Parser never imports components or Next.js APIs.
- All parser types exported from `types.ts`.
- Side effects isolated to UI layer (fetch, storage, DOM interactions).

---

## 3. Data Model Essentials
Key discriminated union: `ContentSegment` (e.g. `text`, `tool_call`, `code_block`). Segments appear in original order—never batch or reorder.

Tool call metadata:
- `rawAction`: original source string
- `action`: normalized display form
- `normalizedResultCount`: number for search calls (0 for "no results")
- `fromSubAgent`: nested delegated call flag
- `subAgentCalls`: child array under a parent call

Design preference: enrich metadata instead of heuristically parsing UI strings later.

---

## 4. Standards (Condensed)
TypeScript:
- No `any`; use unions, `unknown` + guards, or `Record<string, unknown>` with validation.
- Prefer inference; annotate only where it adds clarity.
- Discriminated unions for variant logic.

React / Next.js:
- Use `'use client'` for interactive components.
- Functional components only; semantic HTML > generic divs with click handlers.
- Keep components < ~200 LOC; extract once logic grows.

Tailwind:
- Prefer utility classes; avoid custom CSS unless truly necessary.
- Responsive: start mobile, layer `md:`/`lg:` as needed.

Naming:
- Files: Components `PascalCase.tsx`, utilities `kebab-case.ts`, tests `*.test.ts`.
- Constants: UPPER_CASE; variables/functions camelCase.

Accessibility:
- Interactive toggles: `aria-label`, `aria-expanded`.
- Avoid ambiguous icons without text for critical actions.

---

## 5. Testing Strategy
Framework: Vitest. Goal: fast deterministic unit tests; >80% coverage.

Focus areas:
- Parser correctness (segment ordering, tool call extraction, edge cases).
- Markdown rendering (inline code, emphasis preserved in `text` segments).
- Subagent nesting (indentation, auto-expansion, icon rendering).
- Resilience (search parsing, zero-result normalization).

Do NOT test internal React state—assert rendered structure or parsed data.

Minimal illustrative parser test:
```typescript
it('interleaves text and tool calls', () => {
  const log = 'GitHub Copilot: Intro\n\nRan Click\n\nMore';
  const result = parseLog(log);
  const segs = result.messages[0].contentSegments;
  expect(segs.map(s => s.type)).toEqual(['text', 'tool_call', 'text']);
});
```

Running:
```bash
npm test
npm run test:unit:watch
npm run test:unit:coverage
```

---

## 6. Common Tasks (Blueprints)
Add Tool Call Type:
1. Extend `ToolCallType` in `parser/types.ts`.
2. Add recognition logic in `parser/index.ts` (or extracted module).
3. Add icon mapping in `ChatMessage.tsx`.
4. Add unit test covering parse + rendering.

Add UI Component:
1. Create `src/components/ComponentName.tsx` with `'use client'`.
2. Strongly typed props; no `any`.
3. Include accessibility + `data-testid` for complex interactions.
4. Keep styling in Tailwind utilities.

Improve Resilience (fetch):
1. Add AbortController timeout.
2. Retry transient failures (exponential backoff). Avoid retry on 4xx fatal errors.
3. Inspect rate limit headers; surface user-friendly message.

Update CI (deploy workflow):
1. Ensure Node version bump.
2. Add caching for `~/.npm`.
3. Optionally add `npm audit --audit-level=high` step.

---

## 7. Subagent Tool Calls
Model:
- Parent orchestrator (type `subagent`) holds `subAgentCalls`.
- Nested calls flagged `fromSubAgent: true` and indented (`12px * depth`).
- Parent with children auto-expands; nested calls show 🤖 plus their tool icon.

Testing considerations:
- Assert icon presence, indentation style, expansion state.
- Use stable ARIA labels rather than brittle text concatenation.

Edge fallback: Orphan `fromSubAgent` calls become top-level if no parent seen.

---

## 8. Action Normalization
Purpose: decouple semantics from presentational strings.
Rules:
1. Strip leading operational verbs (`Ran`, `Using`).
2. Compress read paths to filenames.
3. Coerce type to `search` if `rawAction` starts with `Searched`.
4. Split multi-search lines into discrete tool calls.
5. Calculate `normalizedResultCount` (default undefined; 0 for "no results/matches").

Preferred test assertion: numeric counts / normalized fields > string fragments.

---

## 9. Development Workflow (Condensed)
Setup:
```bash
git pull origin main
npm install
npm run type-check && npm run lint && npm test
npm run dev
```

TDD Loop: write failing test → minimal implementation → refactor → repeat.

Pre-commit:
```bash
npm run type-check
npm run lint
npx prettier --write .
npm test
npm run build
git commit -m "feat: short description"
```

Commit prefixes: feat | fix | docs | test | refactor | style | chore

---

## 10. Troubleshooting (Quick Table)
| Symptom | Cause | Fix |
|---------|-------|-----|
| Double effect run | React StrictMode | Guard with `useRef` initialization flag |
| Missing styles | Tailwind content mismatch | Verify `tailwind.config` + restart dev |
| Build fails only | Using client-only code in server context | Add `'use client'` or dynamic import with `ssr:false` |
| Zero search results misparsed | Pattern splitting issue | Validate multi-search splitting & `normalizedResultCount` |
| Rate limit errors | Exhausted unauthenticated quota | Surface reset timestamp to user |

Parser debug toggle: temporary `DEBUG` flag printing segment counts (remove before commit).

---

## 11. Contribution Checklist
Before merging:
1. Tests green & coverage ≥ 80%.
2. Type + lint + build all PASS.
3. No stray `console.log` (except intentional structured debug removed before commit).
4. No `any`; unions or guards in place.
5. Accessibility attributes for interactive elements.
6. Mobile layout visually acceptable.
7. Added/updated tests for new behavior (happy path + 1-2 edge cases).
8. Comments describe intent / rationale, not obvious code.
9. Parser changes preserve ordering of segments.
10. Updated README or AGENTS.md if exposing new concepts.

---

## 12. Reference Links
- Next.js App Router: https://nextjs.org/docs/app
- Tailwind CSS: https://tailwindcss.com/docs
- Vitest: https://vitest.dev/api
- GitHub Gist API: https://docs.github.com/en/rest/gists

---

## 13. Rationale Notes (FAQ)
Q: Why library-first? → Easier reuse + isolation improves test coverage & refactors.
Q: Why interleaved segments? → Prevents ordering bugs (text vs tool calls).
Q: Why strict types/no `any`? → Guarantees parser/UI contract stability.
Q: Why enrich metadata (`rawAction` etc.)? → Stabilizes tests & enables analytics.
Q: Why AbortController + retry? → Avoid UI stalls; handle transient network errors gracefully.

---

## 14. Fast Start (TL;DR)
```bash
git pull
npm i
npm test
code src/lib/parser/index.ts  # make focused change
npm run test:unit:watch
git commit -m "fix: normalize search count"
```

Keep changes tight, tested, and traceable.

---

## 15. Final Reminder
If it touches parsing: add/adjust tests FIRST. If it alters UI behavior: assert rendered structure or ARIA in tests. If it adds tool call types: update icon + parser + tests together. Never sacrifice ordering or type safety for speed.

Ship quality, not surprises.