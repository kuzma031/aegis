---
name: Golden Gorgoneion
colors:
  surface: '#fbf9f6'
  surface-dim: '#dbdad7'
  surface-bright: '#fbf9f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f0'
  surface-container: '#efeeeb'
  surface-container-high: '#eae8e5'
  surface-container-highest: '#e4e2df'
  on-surface: '#1b1c1a'
  on-surface-variant: '#564338'
  inverse-surface: '#30312f'
  inverse-on-surface: '#f2f0ed'
  outline: '#897267'
  outline-variant: '#ddc1b3'
  surface-tint: '#9b4500'
  primary: '#903f00'
  on-primary: '#ffffff'
  primary-container: '#b45309'
  on-primary-container: '#fff1eb'
  inverse-primary: '#ffb68e'
  secondary: '#515f74'
  on-secondary: '#ffffff'
  secondary-container: '#d5e3fd'
  on-secondary-container: '#57657b'
  tertiary: '#854600'
  on-tertiary: '#ffffff'
  tertiary-container: '#a95b00'
  on-tertiary-container: '#fff1e9'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffdbca'
  primary-fixed-dim: '#ffb68e'
  on-primary-fixed: '#331200'
  on-primary-fixed-variant: '#763300'
  secondary-fixed: '#d5e3fd'
  secondary-fixed-dim: '#b9c7e0'
  on-secondary-fixed: '#0d1c2f'
  on-secondary-fixed-variant: '#3a485c'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#fbf9f6'
  on-background: '#1b1c1a'
  surface-variant: '#e4e2df'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 30px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: 0em
  timer-display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '500'
    lineHeight: 52px
    letterSpacing: -0.03em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 0.75rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1rem
  space-xl: 1.5rem
---

## Brand & Style

Wardfocus's design system embodies an ancient, protective mantle cast not in sterile corporate armor, but in warm oiled slate and embossed sun-warmed gold. Designed for high-agency knowledge workers, scholars, and creators, this system rejects anxiety-driven, punitive productivity metrics (red banners, harsh locks, shame-inducing trackers). Instead, it acts as a dignified, calm focus sanctuary that quietly deflects cognitive clutter.

The visual style merges **warm classical tactility** with **rigorous modern minimalism**. Elements evoke heavy parchment, honed alabaster stone, and burnished bronze accents. Interactions feel weighted, intentional, and reassuring. Space is generous and unhurried; typography prioritizes effortless legibility; visual depth relies on delicate, warm ambient drop shadows, chamfered rim highlights, and fine-line borders reminiscent of numismatic relief carvings.

## Colors

The palette is tuned around warm light reflection, stone surfaces, and metallic amber resonance:

- **Primary (`#B45309`) & Tertiary Amber Accent (`#D97706`)**: Grounded ochre and burnished golds representing active cognitive agency, deep focus states, and key focal anchors. Used for active progress indicators, state highlights, primary action triggers, and subtle inner glow rims.
- **Secondary Slate (`#334155`, `#1E293B`)**: Oiled slate shield tones representing boundary defense, structural integrity, and calm permanence. Applied to headers, control toggles, and contextual badge shells.
- **Surface Foundations**:
  - `Base / Canvas`: Warm Marble Alabaster (`#FAF8F5`)
  - `Surface Dim / Low`: Muted Honed Stone (`#F3EFEA` down to `#EAE4DC`) for inset zones, wells, and inactive tab tracks.
  - `Surface Card / Elevated`: Pure Off-White Container (`#FFFFFF`) to float foreground modules cleanly over the alabaster ground.
- **Text & Contrast**:
  - `Text Primary`: Smoked Charcoal (`#191A1D`) providing deep, soot-ink contrast without the harshness of pitch black.
  - `Text Secondary`: Warm Stone (`#57534E`) for metadata, subheadings, and secondary notes.
- **Tonal Accent & Strokes**:
  - `Accent Tint`: Soft Amber Glow (`#FEF3C7`) for subtle active pill fills, timer halos, and focus chips.
  - `Border / Stroke`: Natural Alabaster Edge (`#E7DFD5` and `#E7E1D8`) for whisper-thin perimeter definition.

## Typography

The typography centers on **Inter**, tuned to strip away browser latency and provide instantaneous technical clarity. 

- **Tabular Figures & Metrics**: All numerical counters, countdown timers, session clocks, and telemetry figures must strictly enable OpenType tabular numbers (`font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1`). This eliminates character twitching as timers tick down.
- **Headlines & Crest Weights**: Weight 600 headlines provide an authoritative, scholarly presence without requiring heavy decorative serifs. Negative letter spacing (`-0.01em` to `-0.03em`) on sizes above 20px anchors display elements crisply within compact extension viewports.
- **Labels**: Micro labels (`label-sm`) adopt subtle uppercase styling with generous letter spacing (`+0.04em`) to simulate inscriptions carved upon stone plinths.

## Layout & Spacing

Designed for the fixed spatial economy of browser extension popups (standard width: `380px` to `420px`; max height: `600px`), full-page focus overlays, and side-panel drawers.

- **Grid Architecture**: Single-column flexible stack for extension popup views; 4-to-6 column fluid grid for expansive dashboard or overlay screens.
- **Rhythm**: Standard 4px base increment. Vertical stacking prioritizes airy internal breathing space inside cards (`space-lg`), with tight atomic couplings (`space-xs` to `space-sm`) between icon-label pairs and micro-indicators.
- **Extension Viewport Safety**: Popups enforce a strict outer boundary margin of `margin: 1rem` (16px) with an unyielding scroll lock on the root canvas to prevent awkward dual scrollbars. Internal scroll areas use subtle, narrow pill scrollbars matching `#E7DFD5`.

## Elevation & Depth

Visual hierarchy uses a refined **warm relief and ambient diffusion** model, rejecting cold drop shadows in favor of stone-and-parchment physics:

- **Level 0 (Recessed Base)**: Flat `#FAF8F5` surface with optional inset shadow for recessed wells, toggle tracks, and search fields: `inset 0 1px 2px rgba(25, 26, 29, 0.04), inset 0 0 0 1px #E7DFD5`.
- **Level 1 (Card / Resting Tile)**: Pure `#FFFFFF` resting over alabaster. Surface defined by a dual-boundary technique: a warm whisper border (`1px solid #E7E1D8`) paired with an ambient warm-tinted shadow (`0 2px 6px -1px rgba(87, 83, 78, 0.06), 0 1px 3px rgba(87, 83, 78, 0.04)`).
- **Level 2 (Active Context / Shield Raised)**: Elevated active session cards or hovered interactive modules: `0 8px 20px -4px rgba(180, 83, 9, 0.08), 0 3px 8px -2px rgba(87, 83, 78, 0.06)`, bounded by a crisp gold-tinted border (`#E7DFD5`).
- **Level 3 (Modals / Overlays / Flyouts)**: Deep focus dialogs and dropdown menus: `0 16px 32px -6px rgba(30, 41, 59, 0.12), 0 6px 12px -3px rgba(30, 41, 59, 0.06)`, framed by a solid `1px solid #EAE4DC`.
- **Gilded Rim Glow**: Dedicated active components display a sub-surface amber radiance via an internal highlight ring: `box-shadow: 0 0 0 1px #B45309, 0 0 16px -2px rgba(217, 119, 6, 0.25)`.

## Shapes

The design system employs a calm, continuous curvature profile (`roundedness: 2` with standard radii between 12px and 16px):

- **Primary Cards & Context Shields**: Fixed radius of `14px` (`0.875rem`) to create smooth, non-aggressive architectural modules.
- **Interactive Action Buttons & Pills**: Full pill geometry (`rounded-full` / `9999px`) or `12px` roundedness to provide soft, comforting touch targets.
- **Input Fields & Inset Slates**: `12px` roundedness, ensuring internal alignment when nested inside `14px` or `16px` parent containers.
- **Micro Chips & Badges**: Symmetrical `9999px` capsule silhouettes.

## Components

### Buttons
- **Primary ("Golden Crest")**: Pill-shaped (`rounded-full`), `#B45309` base with subtle top-edge chamfer highlight (`inset 0 1px 0 rgba(255, 255, 255, 0.25)`). Text in white (`#FFFFFF`) with medium weight. Hover shifts to `#D97706` with ambient golden glow (`0 4px 12px rgba(180, 83, 9, 0.24)`). Active state applies a gentle 0.98 scale compression.
- **Secondary ("Slate Shield")**: Pill-shaped, background `#1E293B`, text `#FAF8F5`. Provides balanced authority for switching contexts or accessing systemic configuration without competing with gold accents.
- **Ghost / Tertiary**: Transparent base, text `#57534E`, border `1px solid transparent`. On hover, background shifts to `#FEF3C7` tint and text to `#B45309`.

### Focus Context Cards
- Containers formed in `#FFFFFF` with `14px` border radius, bordered in `1px solid #E7E1D8`.
- Inactive state: Resting card with neutral Slate header and subtle `#FAF8F5` status dot.
- Active "In Shield" state: Framed with a 1.5px `#B45309` border, carrying an inner ambient wash of `#FEF3C7` (5% opacity) and a live glowing amber indicator.

### Timer & Chrono Display
- Centerpiece display utilizing `timer-display` typography with tabular figures.
- Housed within an oiled slate inset ring or clean marble circle.
- Progress track uses a 4px stroke in `#EAE4DC`, while the active progress sweep is rendered in solid `#D97706` with a soft blurred radial tip.

### Chips & Context Badges
- Capsule pills (`rounded-full`) with vertical padding of 4px and horizontal padding of 10px.
- Idle: `#F3EFEA` background with `#57534E` text.
- Active Context: `#FEF3C7` amber glow background with `#B45309` text and a 1px border of `rgba(180, 83, 9, 0.2)`.

### Form Inputs & Search
- Recessed slate-alabaster fills (`#F3EFEA`) with `12px` corner radii. Border `1px solid #E7DFD5`.
- Smoked charcoal text (`#191A1D`) with `#57534E` placeholder.
- Focus state: Surface turns pure white (`#FFFFFF`), border becomes `#B45309`, accompanied by a subtle amber ring shadow (`0 0 0 3px rgba(217, 119, 6, 0.15)`).

### Checkboxes & Toggle Switches
- **Toggles**: Smooth pill track (`40px x 22px`). Inactive track uses `#EAE4DC`; active track illuminates in `#B45309`. Thumb is pure white `#FFFFFF` with a crisp ambient drop shadow, sliding with standard ease-out transitions (`200ms cubic-bezier(0.16, 1, 0.3, 1)`).
- **Checkboxes**: `18px x 18px` squares with `5px` corner radius. Filled with `#B45309` on check, bearing a crisp white mythic checkmark icon.

### Interruption Sanctuary (Overlay / Shield Mode)
- Full-viewport intervention view presented when opening blacklisted tabs during deep focus.
- Instead of harsh error banners, a full `#FAF8F5` marble backdrop displays a centered, warm slate crest (`#1E293B`) and golden typography (`#B45309`), asking the user to breathe and confirm deliberate context transition without penalizing red warnings.