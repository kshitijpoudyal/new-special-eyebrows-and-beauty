# Design System Document: High-End Editorial Experience

 

## 1. Overview & Creative North Star

**Creative North Star: The Ethereal Atelier**

 

This design system is not a template; it is a digital manifestation of luxury, precision, and curated beauty. We are moving away from the rigid, boxy structures of traditional web design to embrace an editorial, high-fashion layout. The experience should feel like flipping through a high-end beauty magazine—airy, intentional, and expensive.

 

We achieve this through **Intentional Asymmetry**. Do not center-align everything. Use the whitespace as a functional element to draw the eye toward the "New Special Eyebrows & Beauty" artistry. By overlapping typography with image containers and using tonal shifts instead of borders, we create a sense of depth that feels organic and premium.

 

---

 

## 2. Colors

The palette is a sophisticated blend of warmth and depth, utilizing the provided Material Design tokens to create a harmonious, high-contrast environment.

 

*   **Primary (`#a82a55`) & Secondary (`#775a19`):** These represent the "Signature Pink" and "Rich Gold." Use these sparingly for focal points, high-level CTAs, and decorative accents.

*   **Tertiary (`#7d4c6f`):** This deep purple/brown provides the editorial weight. It should be used for body text on light backgrounds or as a dramatic background for high-conversion sections.

*   **The "No-Line" Rule:** Explicitly prohibit the use of 1px solid borders for sectioning or containment. Boundaries must be defined through background color shifts. For example, a `surface-container-low` section should sit directly against a `surface` background to define its start and end.

*   **Surface Hierarchy:** Treat the UI as layers of fine paper. 

    *   Base: `surface` (#fcf9f7)

    *   Nested Content: `surface-container-low` (#f6f3f1) or `surface-container-high` (#eae8e6)

*   **The Glass & Gradient Rule:** For floating navigation or mobile menus, use Glassmorphism. Apply `surface` at 80% opacity with a `backdrop-blur` of 12px. For primary action buttons, use a subtle gradient from `primary` (#a82a55) to `primary_container` (#c9446d) at a 135-degree angle to provide a "lit from within" soul.

 

---

 

## 3. Typography

The typography is the voice of the brand. We use a high-contrast pairing to balance heritage (Serif) with modernity (Sans-Serif).

 

*   **Display & Headlines (Noto Serif):** This is our "Editorial Voice." Large-scale Noto Serif headings should feel authoritative. Use `display-lg` (3.5rem) for hero statements with tight letter-spacing (-0.02em) to evoke a premium, custom feel.

*   **Body & Titles (Manrope):** This is our "Functional Voice." Manrope provides clean, technical clarity. It balances the romanticism of the serif with a modern, clinical precision necessary for a beauty salon.

*   **Hierarchy Note:** Always maintain a significant scale gap between headlines and body text. If a headline is `display-md`, ensure the body follows with plenty of `padding-top` to let the heading "breathe."

 

---

 

## 4. Elevation & Depth

In this system, depth is a whisper, not a shout. We use **Tonal Layering** rather than structural shadows.

 

*   **The Layering Principle:** Stacking surface tiers creates a soft, natural lift. A card using `surface_container_lowest` (#ffffff) placed on a `surface_container` (#f0edeb) background creates a "raised" effect without a single drop shadow.

*   **Ambient Shadows:** If a floating element (like a booking modal) requires a shadow, it must be an "Ambient Shadow." Use the `on_surface` color at 5% opacity with a blur of 40px and a Y-offset of 20px. It should feel like a soft glow, not a dark edge.

*   **The Ghost Border:** If a boundary is required for accessibility, use the `outline_variant` token at 15% opacity. This "Ghost Border" provides a hint of structure without breaking the airy, minimalist aesthetic.

*   **Glassmorphism:** Use semi-transparent `surface` colors for elements that need to feel light and modern, allowing the rich gold and pink tones of the imagery to bleed through the UI.

 

---

 

## 5. Components

 

### Buttons

*   **Primary:** Rounded-full (`9999px`). Background: `primary` to `primary_container` gradient. Text: `on_primary`. No border.

*   **Secondary (Gold):** Rounded-full. Background: `surface_container_lowest`. Border: 1px "Ghost Border" of `secondary`. Text: `secondary`.

*   **Tertiary:** Text-only in `primary`. Use an underlined style that transitions on hover to a `secondary` gold color.

 

### Cards & Service Items

*   **Layout:** No dividers. Use `surface_container_low` for the card background. 

*   **Imagery:** Use `lg` (1rem) corner radius. Images should be slightly desaturated to allow the `primary` pink accents in the UI to pop.

*   **Separation:** Use vertical spacing from the scale (e.g., 4rem between service categories) rather than lines.

 

### Input Fields

*   **Style:** Minimalist. No background color—only a bottom border using `outline_variant` at 40% opacity. 

*   **Focus State:** The bottom border transforms into a 2px solid `secondary` gold line. Label moves to `label-sm` in `primary` pink.

 

### Booking Chips

*   **Selection:** Use `secondary_fixed` (#ffdea5) for selected states with `on_secondary_fixed` text. This brings the gold "premium" feel into the user's active choices.

 

---

 

## 6. Do's and Don'ts

 

### Do:

*   **Do** use asymmetrical layouts where text blocks overlap the edges of images slightly (using negative margins).

*   **Do** use `surface_bright` for the main canvas to ensure the "airy" feel requested by the client.

*   **Do** utilize the `full` roundedness scale for interactive elements to mimic the organic curves of eyebrows and facial features.

 

### Don't:

*   **Don't** use black (#000000). Always use `on_background` (#1b1c1b) or `tertiary` (#7d4c6f) for dark text to maintain tonal softness.

*   **Don't** use standard 1px gray dividers. They cheapen the "editorial" look. Use whitespace or a `surface_container` shift.

*   **Don't** crowd the layout. If you think there is enough whitespace, add 20% more. Premium brands are defined by what they *don't* show.

*   **Don't** use hard-edged shadows. If the shadow is visible as a "line," it is too heavy. It must be a soft, ambient bloom.
