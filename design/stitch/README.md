# Stitch designs

The three screens were designed in Google Stitch before they were built.

- Project: `projects/1176547400537705527` ("PromptFlight", private to the owner)
- Design system: `assets/6431637660052900736` (light; the dark tokens are in the design notes below and in `src/app/globals.css`)

| Screen | Stitch screen id | Device |
|---|---|---|
| Cases: table, filter chips, dataset panel, ticket drawer with raw output per variant | `e9940c6f2b3a41b4a89ad4451b895386` | desktop |
| Prompts: version history, editor, schema preview, read-only save bar | `1877ccc08fc14956ac2b8c814a65b0b0` | desktop |
| Experiments: stacked KPI cards, comparison tiles, matrix scrolling inside its card | `08c3bd48d0ec4b149777f6c75dcfa929` | mobile |
| Experiments: run picker, KPI cards, 2x2 comparison grid, confusion matrix, injection bars | not returned by the API (two generations finished without a screen id) | desktop |

The Stitch screens use made-up rows for illustration. The built pages read only real run folders.
To export images: open the project in Stitch, select a screen, Export.

## What the build takes from the designs
- Warm paper canvas, white cards with a 1px line and 8px radius, one blue accent, Geist headings, Inter body, JetBrains Mono for numbers and ids.
- Each variant is a colored dot plus its name in monospace, always in the order zero-json, zero-strict, few-json, few-strict.
- Intervals sit next to the value as `[lo, hi]` in muted monospace.
- Experiments: a run picker with a manifest strip; one KPI card per variant; a 2x2 grid of comparison tiles with paired counts, the difference with its interval, p and Holm p, and a "not shown" or "shown" badge; a category/priority switch.
- Cases: a collapsible "About this dataset" panel; split as a segmented control; slice, disagreement and all-wrong chips with counts; a table with a check or cross per variant and the predicted label under it; a drawer with the full ticket, the gold label, and per variant the raw output, failure code, tokens, latency and a cache tag.
- Prompts: a version list per variant with frozen and restore actions; an editor with System and User tabs; output mode and examples selects; a schema preview; a save bar that shows "read-only" when saving is off, and the CLI command to run a version.
- Wide content (the matrix, the table) scrolls inside its card, never the page.

## Not taken from the designs
Profile avatars, settings buttons, "confidence" fields and invented categories in the sample rows: PromptFlight has no accounts and the model returns no confidence.

---

# v2: "Afterglow Ops" (31 Oct 2026)

The first UI read as generic. v2 is redesigned from three references the owner picked:
1. a dark "Production Command" ops dashboard (huge hero number, status pills, health bars, incident cards, mobile bottom tabs);
2. an "AI Assistant" dashboard (left sidebar, top search, glass cards over a violet-blue glow, donut rings, small area charts);
3. "Aura AI Afterglow" (violet glow, light-weight display type, pill chips, thin-bordered rounded cards).

## Design systems
| Theme | Stitch asset |
|---|---|
| Dark | `assets/18202162895111375579` |
| Light | `assets/1966164970992536036` |

## Tokens
| Token | Dark | Light |
|---|---|---|
| canvas | `#0a0b14` + violet glow 18%, blue glow 10% | `#f5f5fb` + the same glows at 8% |
| card | white 4%, 1px white 8% border, blur 16px | `#ffffff`, 1px `#e6e6f0`, soft shadow |
| text / muted | `#eef0f8` / `#9aa1b5` | `#12131c` / `#5d6275` |
| good (shown, clean) | teal `#2dd4bf` | ink `#0f766e` on `#e6f7f4` |
| bad | coral `#f87171` | ink `#b4232a` on `#fde8e8` |
| warning | amber `#fbbf24` | ink `#8a5300` on `#fdf3dc` |
| brand (pre-registered) | violet `#a78bfa` | ink `#5b3fd6` on `#efebff` |
| zero-json / zero-strict / few-json / few-strict | `#f5a524` / `#38bdf8` / `#2dd4bf` / `#a78bfa` | same fills; ink `#8a5300` / `#0369a1` / `#0f766e` / `#5b3fd6` |

Radius 20px for cards, 12px inside. Display numbers in Geist Light with tabular numerals; 11px uppercase micro labels; Inter body; JetBrains Mono for ids.

## Approved v2 screens (31 Oct 2026)
The owner compared two concepts and chose a mix: concept B on top (centered light headline, one card per prompt, verdict strip) and concept A below (flow diagram, three "What we found" incident cards).

| Screen | Dark | Light |
|---|---|---|
| Overview | `47597c004cea4da9a5f70c8fc45b0e5c` | `dd32dcd07ac64b49b0dd6247d2028e3c` |
| Results | `88afdc4a5e7c41478b5ceb13e23b5bb6` | `5f8720acea244f94b2a85f561d54f1f9` |
| Tickets | `474bca83e9934306a96f98e11578718b` | `62e4c45998bb439584e43bc91e7ef0a7` |
| Prompts | `d3e529a2723c4493b60ac0cf85ff2153` | `91cda7c6a03a4d35bd983de022a9fa46` |
| Phone Overview / Results | `7605d88270a14282b38e4556f3ada886` / `ed2416ee5e324b7dba17c626225fe135` | — |

Concepts: A `ed84e34ab401465fa9caa32d59db82e7`, B `a2131aabec0c4f259e955193a6f9f7bb`.

**Copy rule.** Every prompt to Stitch carried the exact text and numbers, and forbade avatars, dates and claims. Where Stitch still invented something (a footnote, a "live" tag, red/green split bars, made-up card numbers on the first light Results), the build uses only the run files: split bars use each prompt's own color, and the per-type charts are bars of real accuracy on clear / ambiguous / injection / noisy tickets.

The model `GEMINI_3_5_FLASH_LITE` was used; the default model timed out.

## Built (31 Oct 2026)
The v2 screens are built; the README images in `docs/img/` are captured from the real holdout run by `e2e/screenshots.spec.ts`. Where the build differs from Stitch:
- The per-prompt area curves became four small bars with their values: four points do not make a trend.
- A comparison card shows the difference, McNemar p and Holm p, the split of tickets only one prompt got right, and a link to those tickets.
- Pages keep the top pill tabs on tablets; below 768 px the tabs move to a bottom bar.
- Under reduced motion the fade-in is off entirely.
