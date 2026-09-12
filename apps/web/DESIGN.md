---
name: Broadcaster Page
description: The implemented neutral, section-based monitoring interface for Twitch Integrations.
colors:
  page: "light-dark(#ffffff, #111111)"
  text: "light-dark(#202020, #f1f1f1)"
  muted: "light-dark(#595959, #b8b8b8)"
  line: "light-dark(#d4d4d4, #454545)"
  surface: "light-dark(#f5f5f5, #202020)"
  success: "light-dark(#216236, #93d3a1)"
  warning: "light-dark(#805000, #e7c275)"
  error: "light-dark(#a12b2b, #ffabab)"
  focus: "light-dark(#285aa8, #a9c8ff)"
typography:
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "16px"
    lineHeight: 1.5
  page-title:
    fontSize: "1.875rem"
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  section-title:
    fontSize: "1.125rem"
  provider-title:
    fontSize: "1rem"
  headline-state:
    fontSize: "1.5rem"
    fontWeight: 650
    lineHeight: 1.3
  count:
    fontSize: "1.75rem"
    fontWeight: 600
    lineHeight: 1.4
  status:
    fontSize: "0.875rem"
    fontWeight: 600
  metadata:
    fontSize: "0.8125rem"
rounded:
  section: "0.5rem"
  disclosure: "0.25rem"
spacing:
  compact: "0.25rem"
  metadata: "0.375rem"
  small: "0.5rem"
  medium: "0.75rem"
  gap: "1rem"
  inset-small: "1.25rem"
  inset: "1.5rem"
  large: "2rem"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.section}"
    padding: "0.5rem 1rem"
  button-active:
    backgroundColor: "{colors.line}"
  section:
    rounded: "{rounded.section}"
    padding: "{spacing.inset}"
  disclosure:
    rounded: "{rounded.disclosure}"
    padding: "0.625rem 0"
---

# Design System: Broadcaster Page

## Overview

**Creative North Star: "Simple section-based interface"**

This records the incumbent interface in `src/styles.css` and the view modules. It extends the existing Connections page with bordered monitoring sections, native controls, and inline details. No new visual world, concept seed, or imagery was introduced.

The system follows the browser's light/dark preference. Written states carry meaning; color helps the Broadcaster scan them. Route composition and refresh behavior remain in `.impeccable/surfaces/src-main-ts.md`; product scope remains in `PRODUCT.md`, with shared terminology authoritative in `../../CONTEXT.md`.

**Key Characteristics:**

- Neutral page grounds and thin section borders.
- Native buttons, forms, and detail disclosures.
- Textual states with semantic color and tabular counts.
- Wrapping content and touch-sized controls.

## Colors

### Neutral

`page` supplies the page ground, `text` the main text, and `muted` supporting facts and timestamps. `line` separates sections and entries. `surface` fills buttons. The frontmatter preserves the source's paired CSS colors rather than introducing a separate palette.

Semantic `success`, `warning`, and `error` colors distinguish authorization and monitoring states. `focus` marks keyboard focus and links. Authorization-result backgrounds mix their semantic color at 12% with the page ground.

**The Written State Rule.** Pair semantic color with explicit state or error text.

## Typography

Body text and controls inherit the system font. Counts use inherited tabular numerals. The observed hierarchy comprises the page title, section and Provider headings, prominent readiness text and counts, status labels, and smaller freshness and identifier text. Headings retain browser bold weight; code retains the browser monospace family.

The page title becomes `1.5rem` at the narrow breakpoint. No custom font asset or separate display face ships. The inherited system-font page heading is recorded as existing behavior, not a new display-font prescription for future designs.

## Layout

The centered main container has a maximum width of `84rem`, outer vertical margin of `2.5rem`, and horizontal padding of `2rem`. At `68rem` and below, margin and horizontal padding become `1.5rem`. At `40rem` and below, horizontal padding becomes `1rem` and section padding uses `inset-small`.

Sections use the shared gap and inset spacing. Flexible rows wrap headings and long values; paragraphs and identifiers can break long strings. Expanded explanatory text is bounded to `72ch`. The route brief owns the overview's column arrangement and first-viewport requirements.

## Elevation & Depth

Sections have no shadows or raised layers. Thin borders separate content on the page ground; button fills and authorization-result tints provide the implemented tonal contrast. There are no authored animations or transitions.

## Shapes

Sections and buttons share modest rounded corners and a `1px` solid line border. Disclosures have a smaller radius for their focus outline. Internal separators use the same line color without adding nested card fills.

## Components

### Buttons

Refresh, Connect, and Reconnect share one visual treatment. Buttons inherit body typography and have a minimum height of `44px`. Hover strengthens the border to the text color; active uses the line-colored fill. Disabled buttons use opacity `0.55` and a wait cursor. Authorization buttons submit native forms.

### Sections

Bordered sections group summaries and expandable details. They use the page ground with no additional background fill or shadow. Section padding reduces at the narrow breakpoint.

### Disclosures

Native `details` and `summary` preserve browser disclosure markers and keyboard behavior. Summaries have a minimum height of `44px`; hover uses the focus color. Detail lists use text, ordinary list markers, and thin separators. Technical Connection data uses compact text rather than another navigation level.

### States and focus

Status labels combine text with semantic color. Authorization results use tinted paragraphs with status semantics; failed checks use alert text beside freshness information. All focus-visible elements receive a `3px` solid focus outline with a `3px` offset.

## Do's and Don'ts

### Do:

- Do pair semantic color with written states.
- Do preserve native form and disclosure behavior.
- Do retain visible keyboard focus and minimum 44px button and summary heights.
- Do let long account names, identifiers, and Redemption inputs wrap.

### Don't:

- Don't turn semantic status color into an unlabeled health indicator.
- Don't replace the incumbent section-based interface with a separate navigation shell as part of an ordinary extension.
- Don't infer new brand colors, fonts, motion, or imagery from this documentation pass.
