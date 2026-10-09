# DESIGN: UI/UX Rulebook

The dashboard is a **security operations console**: calm, dense but readable, built for fast decisions. The visual language is **flat, dark, precise**. No gradients, no glow, no decorative illustration. Use **Tailwind CSS only**.

---

## 1. Design principles

1. **Clarity over decoration.** Every pixel supports a decision (what is happening, what did the agent do, what do I approve).
2. **Status is never color alone.** Pair color with an icon and a text label.
3. **Risk is always visible.** Any action shows its score, tier and factors where it appears.
4. **Safe by default.** Destructive buttons need clear labels; the kill switch is always reachable.
5. **Evidence first.** Show the "why": reasoning summary, dry-run result, hash.

## 2. Color palette

### 2.1 Core (dark theme, default)

| Token | Hex | Use |
|---|---|---|
| `bg` | `#0B1220` | App background |
| `surface` | `#111A2E` | Panels, cards |
| `surface-2` | `#16223B` | Raised/hover surface, table header |
| `border` | `#22304D` | Dividers and card borders (1px) |
| `text` | `#E6EDF7` | Primary text |
| `text-muted` | `#8FA0BF` | Secondary text, labels |
| `primary` | `#0E7C86` | Brand, primary buttons, links |
| `primary-hover` | `#12929E` | Hover/active on primary |
| `primary-soft` | `#0E3B45` | Primary tint backgrounds |

### 2.2 Semantic status

| Meaning | Token | Hex | Icon |
|---|---|---|---|
| ACTIVE path / HIGH risk / danger | `danger` | `#EF4444` | `ShieldAlert` |
| BLOCKED path / MEDIUM risk / warning | `warning` | `#F59E0B` | `ShieldBan` |
| SAFE path / LOW risk / contained | `success` | `#22C55E` | `ShieldCheck` |
| Info / pending | `info` | `#3B82F6` | `Info` |
| New edge in graph diff | `diff` | `#A78BFA` | `Sparkles` (dashed ring) |

Tinted backgrounds for badges: the semantic color at 15% opacity (`bg-danger/15`) with the solid color as text and a 1px border at 40% opacity.

### 2.3 Optional light theme (P2)
`bg #F6F8FB`, `surface #FFFFFF`, `border #D5DDE8`, `text #0B1F3A`, `text-muted #5B6B85`; semantic colors unchanged.

### 2.4 Tailwind config

```js
// tailwind.config.js (extend)
colors: {
  bg: '#0B1220', surface: '#111A2E', 'surface-2': '#16223B', border: '#22304D',
  text: '#E6EDF7', muted: '#8FA0BF',
  primary: { DEFAULT: '#0E7C86', hover: '#12929E', soft: '#0E3B45' },
  danger: '#EF4444', warning: '#F59E0B', success: '#22C55E', info: '#3B82F6', diff: '#A78BFA',
},
borderRadius: { DEFAULT: '4px', md: '4px', lg: '6px' },   // flat design: 4px default
fontFamily: { sans: ['Inter','system-ui','sans-serif'], mono: ['JetBrains Mono','ui-monospace','monospace'] },
```

## 3. Typography

| Role | Font | Size / weight / line-height |
|---|---|---|
| App title | Inter | 18px / 600 / 24px |
| Panel title | Inter | 14px / 600 / 20px, uppercase tracking `0.04em`, `text-muted` |
| Body | Inter | 14px / 400 / 20px |
| Small / meta | Inter | 12px / 400 / 16px, `text-muted` |
| Numbers (scores, steps) | JetBrains Mono | 14px / 500, `tabular-nums` |
| Hashes, ids, JSON, tool calls | JetBrains Mono | 12px / 400 / 18px |

Max line length in reasoning summaries ≈ 80 characters. Truncate hashes as `3f9a…c1` with a copy button.

## 4. Layout rules

- **Spacing scale:** 4px base (`1`=4, `2`=8, `3`=12, `4`=16, `6`=24). Panel padding `p-4`; gap between panels `gap-3`.
- **Desktop grid (≥ 1280px):** fixed top bar (48px) + three columns + bottom strip.

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ TOP BAR: SENTINEL-X · Incident status · Mode [Shadow|Enforce] · KILL SWITCH│
├──────────────────────┬─────────────────────────┬─────────────────────────┤
│ LEFT 40%             │ CENTER 32%              │ RIGHT 28%               │
│ Attack graph         │ Agent timeline          │ Action Proof cards      │
│ (ACTIVE/BLOCKED/SAFE │ (steps, tool calls,     │ Approval panel (sticky  │
│  + diff highlights)  │  reasoning summaries)   │  at top when pending)   │
├──────────────────────┴─────────────────────────┴─────────────────────────┤
│ BOTTOM STRIP: current attack paths with status                            │
└──────────────────────────────────────────────────────────────────────────┘
Tabs in top bar: Incident · Evaluation · (Replay, P2)
```

- Panels scroll independently; the page itself does not scroll on desktop.
- Pending approval is **pinned to the top of the right column** with a `warning`-tinted border and a subtle 2px left accent.

## 5. Component rules

General: **flat**, 1px `border`, `rounded` (4px), no shadows except focus rings and the modal overlay. Transitions ≤ 150ms, color/opacity only.

| Component | Rules |
|---|---|
| **Button primary** | `bg-primary hover:bg-primary-hover text-white`, 32px height, 12px horizontal padding, 600 weight |
| **Button secondary** | transparent, 1px `border`, `text`, hover `bg-surface-2` |
| **Button danger** | `bg-danger text-white`; used for Deny, Kill switch |
| **Kill switch** | Always in top bar, `danger` outline when idle, filled `danger` when engaged, confirm dialog on engage, label "KILL SWITCH" |
| **Mode toggle** | Segmented control Shadow / Enforce; Enforce shows `warning` dot; admin only |
| **Badge (status/tier)** | 20px height, 12px/600 text, icon + label, tinted bg (see 2.2) |
| **Card** | `bg-surface border border-border rounded p-4` |
| **Action Proof card** | Header: tool(target) + tier badge; body: monospace key/value rows (Reason, Risk, Dry-run, Approval, Reversible, Result); footer: hash/prev hash with copy; "Undo" secondary button if reversible |
| **Risk factor bar** | 4 small horizontal bars (crit, blast, irrev, uncert) 0 to 100 with numeric labels, tier color for the total |
| **Approval panel** | Shows target, reason, risk score + factors, dry-run result, then **Approve** (primary) and **Deny** (danger). Deny requires a short reason. Keyboard: `A` approve, `D` deny only when the panel is focused |
| **Timeline item** | Left rail with phase icon (OBSERVE, REASON, PLAN, DRY-RUN, RISK, TOOL, VERIFY, REPLAN), time step, summary; tool calls in mono chips; REPLAN items use `diff` color |
| **Graph node** | 28px shapes by type (user=circle, device=square, server=rounded-square, credential/token=diamond, database=hexagon); border color = status; protected assets have a double border and a lock icon; compromised nodes have a `danger` fill ring |
| **Graph edge** | 1.5px; ACTIVE solid `danger`; BLOCKED dashed `warning`; SAFE `border` color; **new edge** (diff) dashed `diff` + pulse once |
| **Paths table** | Columns: Path id, hops (chips), Status badge, Last change; row hover `surface-2` |
| **Evaluation table** | Rows = metrics, columns = B0..B3; each cell value + 95% CI in muted small text; threshold pass/fail icon for B3; per-scenario pass/fail grid below |
| **Empty states** | Short sentence + the one action to take (e.g. "No incident running. Start one.") |
| **Toasts** | Bottom-right, 4s, used for approval results and errors |

## 6. Iconography
Lucide icons, 16px (20px in headers), stroke 1.75. Do not use emoji in the UI.

## 7. Motion
Minimal. Allowed: fade-in of new timeline rows (120ms), one pulse on a new graph edge, spinner for pending states. Respect `prefers-reduced-motion` (disable the pulse).

## 8. Responsiveness

| Breakpoint | Behavior |
|---|---|
| ≥ 1280px | Full 3-column layout as above |
| 768 to 1279px | Two columns: graph on top (full width, 320px tall), timeline + right column below side by side; bottom strip becomes a collapsible section |
| < 768px | **Read-and-approve mode**: single column with tabs (Graph · Timeline · Actions · Paths). Approval panel is a sticky bottom sheet. Evaluation table scrolls horizontally inside its container. Buttons ≥ 44px tall |

Never let the page body scroll sideways; wide tables and code scroll inside their own container.

## 9. Accessibility

- WCAG AA contrast (checked for `text`, `muted`, and badge text on tinted backgrounds).
- Visible focus ring: 2px `primary-hover` with 2px offset.
- Status = icon + label + color. Graph statuses also use line style (solid / dashed).
- All interactive elements reachable by keyboard; dialogs trap focus and close on `Esc`.
- Live regions (`aria-live="polite"`) for new pending approvals and verification results.

## 10. Content and tone
Plain, precise, present tense. Label examples: "Awaiting approval", "Verified contained", "Path B opened (new edge)", "Replanning (cycle 2 of 3)". Never anthropomorphize the agent in UI copy; show actions and evidence. Show the cause of every denial/rejection.

## 11. Do and don't

| Do | Don't |
|---|---|
| Use the tokens above via Tailwind | Hard-code hex values in components |
| Keep radius at 4px | Mix rounded-xl/pill shapes (badges may use `rounded-full` only for the status dot) |
| Use mono for ids, hashes, JSON | Use gradients, glows, glassmorphism, shadows for depth |
| Show risk factors beside any HIGH action | Hide the dry-run result behind a click |
| Provide an empty/loading/error state per panel | Leave blank panels |
