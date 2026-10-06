import type { PanelPlacement } from '@/core/utils/WindowUtils';

/**
 * Placement of an input-anchored popup panel (clock, calendar) relative to its input - single
 * source of truth for both the baseline reset on open and the flip decision (see
 * `WindowUtils.resolvePanelPlacement` and `PanelPositioning`).
 * `flipY` anchors the panel's BOTTOM to the input's TOP (`bottom: 100%`), NOT `bottom: 0`:
 * `bottom: 0` would pin the panel's bottom to the input's bottom, so the panel would sit
 * ON TOP of the input and intercept its clicks.
 * The anchor is the picker root - it is the positioned ancestor the panel's `top/bottom`
 * percentages resolve against. When the panel fits on neither side of the root, it stays
 * below (baseline) so the user can scroll down to it.
 * Note: both flips rely on the panel container having zero right/bottom margins
 * (`--datetimepicker-clock-offset` / `--datetimepicker-calendar-offset` in
 * styles/var/components-custom.css).
 */
export const popupPanelPlacement: PanelPlacement = {
  baseline: { top: '100%', bottom: 'auto', left: '0', right: 'auto' },
  flipX: { left: 'auto', right: '0' },
  flipY: { top: 'auto', bottom: '100%' },
};

/**
 * Placement of an options list anchored to its component root - like `popupPanelPlacement`,
 * except the baseline STRETCHES the list to the anchor width (`left: 0; right: 0`), matching
 * the combobox CSS. Anchor and flip semantics are documented on `popupPanelPlacement`.
 * Note: both flips rely on `.combobox-options` having zero right/bottom margins.
 */
export const stretchPanelPlacement: PanelPlacement = {
  baseline: { top: '100%', bottom: 'auto', left: '0', right: '0' },
  flipX: { left: 'auto', right: '0' },
  flipY: { top: 'auto', bottom: '100%' },
};
