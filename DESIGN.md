# VowPlan Design System

Derived with the **UI/UX Pro Max** skill (installed via `npx ui-ux-pro-max-cli init --ai codex`,
data in `.agents/skills/ui-ux-pro-max/`). Recommendations were generated with
`scripts/search.py "wedding planner dashboard event management" --design-system` and domain
searches across `typography`, `ux`, and `style`.

## Style

**Soft UI Evolution** (skill recommendation) — subtle depth, soft shadows, calm premium feel,
accessibility-first. One coherent visual language across both experiences; two intensities:

| Surface | Private planner | Public invitation |
|---|---|---|
| Feel | Premium planning studio | Editorial wedding stationery |
| Background | Warm ivory `#FAF8F4` | Theme palette (blush/ivory default) |
| Cards | White, soft shadow, 12px radius | Ornamental panels, generous whitespace |
| Motion | Restrained 150–250ms transitions | Ceremony-like reveal, skippable |

## Color (semantic tokens, CSS variables)

Skill palette "Romantic pink + elegant gold", contrast-adjusted for WCAG AA:

| Role | Hex | Token |
|---|---|---|
| Primary (deep rose) | `#9D2C4E` | `--color-primary` (4.5:1+ on white, white text on it) |
| Primary soft | `#F7E6EB` | `--color-primary-soft` |
| Accent (antique gold) | `#A16207` | `--color-accent` |
| Background | `#FAF8F4` | `--color-background` |
| Foreground | `#3B2A2E` | `--color-foreground` |
| Muted | `#8A777C` | `--color-muted-foreground` |
| Border | `#E8DFD8` | `--color-border` |
| Card | `#FFFFFF` | `--color-card` |
| Success | `#1B7A43` | `--color-success` |
| Warning | `#B45309` | `--color-warning` |
| Destructive | `#C2313E` | `--color-destructive` |

Invitation themes map onto their own palette variables (5 templates × customizable).

## Typography

| Use | Font | Notes |
|---|---|---|
| Planner UI | Inter | data-dense screens, tables, forms |
| Planner/invite display | Cormorant Garamond | elegant serif headings, ties both experiences |
| Script accents | Great Vibes | monograms, brand moments only — never body/UI text |
| Invitation body | Cormorant Garamond / template-specific (Playfair, EB Garamond, Dancing Script) | per-theme |

All fonts ship via `next/font/google` (self-hosted at build; no runtime CDN).

## UX rules applied (from skill checklist)

- Contrast ≥ 4.5:1 for text; visible 2px focus rings (`focus-visible`); skip links.
- Touch targets ≥ 44px; 8px spacing; `cursor-pointer`; loading states on async buttons.
- `prefers-reduced-motion` respected (CSS `motion-reduce:` + JS check for scroll reveals).
- Icons: Lucide only, consistent 1.5px stroke, `aria-hidden` when decorative, labels when not.
- Tables: `overflow-x-auto` wrapper; card layout fallback on mobile; zebra-free row hover.
- Forms: visible labels, inline errors near fields, helper text, submit feedback.
- Empty states: helpful message + primary action (never blank screens).
- Color never the only signal — status badges pair color + icon + text.
- Charts: legends + tooltips, palette derived from tokens, not color-alone encoding.
- One primary action per view; secondary actions subordinate.

## Invitation templates (real compositions, not color swaps)

1. **Romantic Floral** — blush/ivory, floral SVG ornaments, script monogram.
2. **Minimal Modern** — off-white, thin rules, Inter/Cormorant mix, no ornament.
3. **Classic Formal** — ivory + gold rules, EB Garamond, centered symmetric layout.
4. **Garden** — sage/cream, botanical corners, Dancing Script accents.
5. **Cinematic Editorial** — charcoal/blush, Playfair display type, full-bleed cover.
