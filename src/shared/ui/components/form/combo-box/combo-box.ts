import { Component, effect, inject, input, computed, linkedSignal, signal, DestroyRef } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { IdService } from '@/shared/utils/id/id-service';
import { stretchPanelPlacement } from '@/shared/ui/components/form/popup-panel/popup-panel-placement';
import { PopupPanelBase } from '@/shared/ui/components/form/popup-panel/popup-panel-base';
import { LabelActivation } from '@/shared/ui/components/form/popup-panel/popup-label-activation';

/** Custom combobox implementation. Needed because <select> and <option> have very poor CSS support for dropdown lists
 * across all browsers.
 * Designed to be used with signal-based forms.
 *
 * Features:
 * - Accept number (so also enums), string or null (not set) value.
 * - You provide a list of options. Can use null value as option.
 * - Can disable or mark as invalid.
 * - Component is integrated with i18n.
 * - Keyboard navigation supported via arrows. Enter/space selects option and closes list.
 *   Tab closes open list and moves focus to next component (options are not tab stops).
 *   Typing a printable character jumps to the first matching option (typeahead: characters
 *   typed within 500 ms merge into one prefix search, Backspace deletes the last one).
 * - Supports <label>.
 * - Supports WAI-ARIA.
 *
 * Template binding:
 * - formField - use field from form data, in same way as standard input: `<input [formField]="someForm.someField" />`.
 *
 * Inputs:
 * - ident - Used for identification and id attribute in focusable element (so <label> etc. work properly). Optional. If omitted, unique `combo-box-N` is generated; provide it explicitly for `<label for>` pairing or a stable test id.
 * - label - For `aria-labelledby`. Optional; dev mode warns when the id matches no element.
 * - options - Array of options, will be shown after user clicks on component. Can contain null value for 'unselected'.
 * - langPrefix - Prefix, used for auto-translating entries in dropdown list. If empty, options and placeholder will be shown as is without translation.
 * - placeholder - Translation key to use if nothing is selected. Treated as raw text if langPrefix is empty. Optional, not used if options have null entry.
 *
 * Outputs:
 * - touch - Informs that user blurred out of component.
 *
 * Special (set indirectly):
 * - required - If true, component is required. Default is false.
 * - disabled - If true, acts as disabled component. Default is false.
 * - invalid - If true, shows component as having invalid state. Visual only. Default is false.
 *
 * Notes:
 * - Null value is supported as option. Example: const enUserStatus: (string|null)[] = [ null, 'PENDING', 'ACTIVE' ];
 * - Popup is still shown via click/keys when there are zero options, so dev can see they forgot to add options to combobox.
 */
@Component({
  selector: 'combo-box',
  imports: [ ],
  styleUrl: './combo-box.css',
  templateUrl: './combo-box.html',
})
export class ComboBox extends PopupPanelBase<number | string> {
  private readonly translateService = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly idService = inject(IdService);

  /** Resolved identifier: `ident` when provided, otherwise a generated `combo-box-N`.
   * Public, so consumers can reference it (e.g. `<label [for]>` or tests). */
  public readonly resolvedIdent = linkedSignal(() => this.idService.next(this.ident(), 'combo-box'));
  /** Array of options. String, number (so also enum) and null allowed. */
  public options = input<(number | string | null)[]>([]);
  /** Prefix, used for auto-translating entries in the list. If empty, options will be shown as is without translation. */
  public langPrefix = input<string>('');
  /** Translation key to use if nothing is selected. Treated as raw text if langPrefix is empty. Optional, not used if options have null entry. */
  public placeholder = input<string>('');

  /** Indicates visibility of combobox list; domain-named alias of the shared `panelVisible` (see `PopupPanelBase`). */
  public readonly isOpen = this.panelVisible;
  /** Label-activation coordination (focus-opens marker + forwarded-click decision, `closed`
   * for this component) plus the document guard; see `LabelActivation` for the full contract. */
  private readonly labelActivation = new LabelActivation<'closed'>();
  /** Index of currently highlighted option. -1 means none highlighted. */
  public highlightedIndex = signal(-1);
  /** Name of this component for dev-only diagnostics (see `PopupPanelBase.componentName`). */
  protected readonly componentName = 'combo-box';
  /** Highlight seed direction queued by `openList` for the next open (true = top, false =
   * bottom, null = keep the selection-derived seed); consumed by `prepareOpen`. */
  private pendingSeed: boolean | null = null;
  /** Typeahead search buffer: consecutive printable keystrokes merged into one prefix search. */
  private typeaheadBuffer = '';
  /** Timestamp (ms) of the last typeahead keystroke; decides when the buffer restarts. */
  private typeaheadLastKeyAt = 0;
  /** How long (ms) consecutive typeahead keystrokes keep merging into one search string. */
  private static readonly typeaheadBufferMs = 500;

  constructor() {
    super(stretchPanelPlacement);

    // Clamp a highlight left dangling by options shrinking while the list is open (async or
    // replaced options): a stale index would point aria-activedescendant at a removed option
    // and make Enter resolve `options()[stale]` to undefined, selecting null instead.
    effect(() => {
      const optionCount = this.options().length;
      const highlighted = this.highlightedIndex();
      if (highlighted >= optionCount) this.highlightedIndex.set(optionCount > 0 ? optionCount - 1 : -1);
    });

    // Document-level guard for label activation: resets the interaction markers, cancels the
    // focus steal when the press lands on this component's own label and closes the options
    // list when the press lands outside the component entirely (mechanics and rationale in
    // `LabelActivation.installDocumentGuard`).
    this.labelActivation.installDocumentGuard({
      document: this.document,
      destroyRef: this.destroyRef,
      ident: () => this.resolvedIdent(),
      boundary: () => this.pickerRef().nativeElement,
      onOutsidePress: () => {
        if (this.isOpen()) this.hidePanel();
      },
    });
  }

  // COMPUTED

  /** Class of decorative arrow on right. */
  public arrowClass = computed(() => ({ open: this.isOpen() }));
  /** Compute identifier for listbox used by aria-controls. */
  public listboxId = computed(() => {
    return `${this.resolvedIdent()}_listbox`;
  });
  /** Display text of the current selection (translated option value or placeholder).
   * Computed so the template renders it without re-running `showOption` on every change
   * detection; translation lookups inside `instant` are reactive, so a language change
   * recomputes it. */
  public readonly selectedText = computed(() => this.showOption(this.value()));
  /** Display views (raw option value + precomputed display text) for the list. Keeps the raw
   * value available for selection while the text is computed once per change instead of once
   * per option per change detection. */
  public readonly optionViews = computed(() =>
    this.options().map((option) => ({ option, text: this.showOption(option) })),
  );

  // PANEL HOOKS (PopupPanelBase)

  /**
   * Seed the highlight on every open, BEFORE the list first renders: the open path reveals the
   * highlighted option after placement (see `afterPlacement`), so it must exist right away.
   * Uses the direction queued by `openList` when the caller asked for top/bottom seeding
   * (ArrowUp/Down, Home/End); a plain open seeds from the current selection.
   */
  protected prepareOpen(): void {
    const top = this.pendingSeed;
    this.pendingSeed = null;

    // Yes, a popup window with a list is opened even if no options exist.
    if (this.options().length === 0) return;

    // Set visually selected entry, if any. Works with null selection.
    this.highlightedIndex.set(this.options().findIndex((o) => o === this.value()));

    if (this.highlightedIndex() === -1 && top !== null) {
      // Still nothing highlighted and we want to highlight either beginning or end of list.
      this.highlightedIndex.set(top ? 0 : this.options().length - 1);
    }
  }

  /**
   * ARIA combobox pattern: keyboard focus stays on the root and options are reached through
   * aria-activedescendant, so nothing inside the list ever takes DOM focus on open.
   * @returns Always null - the open path skips its focus move.
   */
  protected focusPanelTarget(): HTMLElement | null {
    return null;
  }

  /**
   * Reset the highlight and the typing session when the list hides (see `PopupPanelBase.hidePanel`):
   * the closed combobox must not keep aria-activedescendant pointing into the display:none
   * list, and the next open re-seeds the highlight from the (possibly changed) selection.
   */
  protected resetOnClose(): void {
    this.highlightedIndex.set(-1);
    this.typeaheadBuffer = '';
    this.resetInteractionState();
  }

  /**
   * Same pass as the placement measurement, still on the open path: reset the list's own
   * scroll to the top and reveal the highlighted option, so a stale offset from a previous
   * open never hides the freshly seeded highlight.
   */
  protected override afterPlacement(): void {
    this.panelRef().nativeElement.scrollTop = 0;
    this.scrollHighlightedIntoView();
  }

  /**
   * Focus really left the component (see `PopupPanelBase.onFocusLeft`): a click decision
   * recorded by a focus-first engine's (Chromium/Firefox) label activation - whose click runs
   * last - is now obsolete.
   */
  protected override onFocusLeft(): void {
    this.labelActivation.setDecision('none');
  }

  /** Reported ident of the dev-only dangling-label diagnostics: the RESOLVED one, so the
   * warning points at the id a generated-ident consumer's `<label for>` actually references. */
  protected override diagnosticsIdent(): string {
    return this.resolvedIdent();
  }

  // GENERAL FUNCTIONS

  /**
   * Get option element ID for aria-activedescendant.
   * @param index Index of option element.
   */
  public optionId(index: number): string {
    return `${this.resolvedIdent()}_option_${index}`;
  }

  /**
   * Open list (no-op when already open or disabled, via `PopupPanelBase.showPanel`).
   * @param top If true, set highlight on top, false on bottom, null - do not change highlight. Ignored if highlight already set.
   */
  private openList(top: boolean | null = null) {
    this.pendingSeed = top;
    // ShowPanel waits for renders internally; template event bindings never await the handler,
    // so the work is deliberately fire-and-forget (`void` marks it as such).
    void this.showPanel();
  }

  /**
   * Scroll the options list so the highlighted option is fully visible inside the list's own
   * viewport (the list is `max-height` capped with `overflow-y: auto`, so the highlight can sit
   * below its fold). Only the list's `scrollTop` is written - deliberately never
   * `scrollIntoView()`, which aligns against the window and would scroll every scrollable
   * ancestor, including the page (same contract as the time-picker's column scrolling).
   * No-op when the list is closed, nothing is highlighted or the option is already visible.
   */
  private scrollHighlightedIntoView(): void {
    if (!this.isOpen()) return;
    const index = this.highlightedIndex();
    if (index < 0) return;
    const list = this.panelRef().nativeElement;
    const option = list.querySelector<HTMLElement>(`[id="${this.optionId(index)}"]`);
    if (option === null) return;

    const listRect = list.getBoundingClientRect();
    const optionRect = option.getBoundingClientRect();
    // Option offsets relative to the unscrolled list content: adding the current scroll keeps
    // them valid wherever the list currently sits.
    const optionTop = list.scrollTop + (optionRect.top - listRect.top);
    const optionBottom = optionTop + optionRect.height;
    if (optionTop < list.scrollTop) {
      // Option sits above the viewport: align it with the top edge. Lower bound is clamped
      // here (browsers clamp it natively, upper bound is clamped natively as well).
      list.scrollTop = Math.max(0, optionTop);
    } else if (optionBottom > list.scrollTop + list.clientHeight) {
      // Option sits below the viewport: align its bottom with the viewport bottom.
      list.scrollTop = Math.max(0, optionBottom - list.clientHeight);
    }
  }

  /**
   * Handle typeahead: printable characters search the option display texts (case-insensitive
   * prefix match, forward from the current highlight with wraparound) and Backspace deletes the
   * last buffered character. Consecutive keystrokes merge into one search string for
   * `typeaheadBufferMs`, then the buffer restarts. Space stays reserved for selection (handled
   * by the switch in `handleKeydown`) and modifier combinations pass through to the browser.
   * @param e Keyboard event.
   * @returns True when the event was consumed as typeahead.
   */
  private handleTypeahead(e: KeyboardEvent): boolean {
    if (e.ctrlKey || e.altKey || e.metaKey) return false;

    if (e.key === 'Backspace') {
      if (this.typeaheadBuffer === '') return false;
      e.preventDefault();
      this.typeaheadBuffer = this.typeaheadBuffer.slice(0, -1);
      this.typeaheadLastKeyAt = Date.now();
      this.searchTypeahead();
      return true;
    }

    // Space (also length 1) is reserved for the select-and-close case in handleKeydown.
    if (e.key.length !== 1 || e.key === ' ') return false;

    e.preventDefault();
    const now = Date.now();
    if (now - this.typeaheadLastKeyAt > ComboBox.typeaheadBufferMs) this.typeaheadBuffer = '';
    this.typeaheadLastKeyAt = now;
    this.typeaheadBuffer += e.key;
    this.searchTypeahead();
    return true;
  }

  /**
   * Move the highlight to the first option whose display text starts with the typeahead buffer,
   * searching forward from the current highlight and wrapping; opens the closed list first so
   * the match is visible (like ArrowDown does). No match keeps the current highlight - the
   * buffer may still complete a match on the next keystroke.
   */
  private searchTypeahead() {
    if (!this.isOpen()) this.openList(null);
    if (this.typeaheadBuffer === '') return;
    const buffer = this.typeaheadBuffer.toLowerCase();
    const views = this.optionViews();
    const start = this.highlightedIndex() + 1;
    for (let offset = 0; offset < views.length; offset++) {
      const index = (start + offset) % views.length;
      const text = String(views[index].text ?? '').toLowerCase();
      if (text.startsWith(buffer)) {
        this.highlightedIndex.set(index);
        this.scrollHighlightedIntoView();
        return;
      }
    }
  }

  /**
   * User selected a combobox option (click, or Enter/Space in the keyboard handler).
   * @param option Selected option.
   */
  public selectOption(option: number | string | null) {
    if (this.disabled()) return;

    this.value.set(option);
    // Close through hidePanel: it also resets the highlight, so aria-activedescendant never
    // stays on the closed combobox pointing into the display:none list.
    this.hidePanel();
  }

  /**
   * Display text for an option - rendered for the current selection and for every entry in
   * the list. Placeholder text will be shown under these conditions:
   * - there is no selection (null value)
   * - and that null is not on list of options
   * @param option Option to show.
   * @returns Display text of the option (translated when langPrefix is set).
   */
  public showOption(option: number | string | null): number | string | null {
    // When to show placeholder text? Note that if null IS in list of options, placeholder text is never used.
    if (option === null && !this.options().includes(option)) {
      if (this.langPrefix()) return this.translateService.instant(this.placeholder());
      return this.placeholder();
    }
    // Show actual option value (either translated or as is).
    if (this.langPrefix()) return this.translateService.instant(this.langPrefix() + '.' + option);
    return option;
  }

  // EVENTS

  /** Track new pointer interaction: cancel any pending focus-open so click can toggle. */
  public handleMousedown() {
    this.resetInteractionState();
  }

  /** Handle focus: handles direct clicks, label clicks, and Tab. */
  public handleFocus() {
    if (this.disabled()) return;
    if (this.labelActivation.consumeDecision() !== 'none') {
      // Click-first engine (WebKit): the activation's forwarded click already toggled the list,
      // the following focus only steered it back from the hidden button - the decision was
      // consumed above, so the list stays exactly as the click left it (open stays open,
      // closed stays closed).
      return;
    }
    if (!this.isOpen()) {
      this.openList();
      this.labelActivation.focusOpened.set(true);
    }
  }

  /**
   * Move focus from hidden label target to the combobox root. Label activation focuses the hidden
   * button; redirecting keeps DOM focus on the element that owns aria-activedescendant and makes
   * the root's (focusout) fire when the user later leaves the component.
   */
  public focusRoot() {
    this.focus();
  }

  /**
   * Focus the combobox root on behalf of the signal-forms `Field` directive (the optional
   * `FormUiControl.focus` contract - e.g. "focus first invalid field"). Delegates to the root,
   * whose focus handler auto-opens the list, exactly like Tab does. No-op when disabled.
   * @param options Native focus options (e.g. `preventScroll`), forwarded to the root.
   */
  public focus(options?: FocusOptions): void {
    if (this.disabled()) return;
    this.pickerRef().nativeElement.focus(options);
  }

  /** Handle click: both from normal mouse click and label click. */
  public handleClick() {
    if (this.disabled()) return;

    if (this.labelActivation.focusOpened()) {
      // Focus already opened the list (label or Tab). Suppress any synthetic click.
      this.resetInteractionState();
      return;
    }

    // Toggle for direct clicks and programmatic clicks. Handles both real browser
    // clicks (preceded by mousedown) and test/programmatic clicks (no mousedown).
    if (this.isOpen()) {
      // Record the decision so the focus handler paired with this click-first activation
      // (WebKit forwards the click BEFORE focusing the hidden button) does not toggle again
      // right after this one. hidePanel also resets the highlight (see resetOnClose).
      this.labelActivation.setDecision('closed');
      this.hidePanel();
    } else {
      this.labelActivation.setDecision('open');
      this.openList();
    }
  }

  /**
   * Handle keyboard events for accessibility.
   * Arrow keys navigate options, Enter/Space select, Escape closes.
   * @param e Keyboard event.
   */
  public handleKeydown(e: KeyboardEvent) {
    if (this.disabled()) return;

    // Printable characters and Backspace run through typeahead; any other key (Space, arrows,
    // Tab, Escape, ...) ends the current typing session, so a later typing burst starts a
    // fresh search instead of merging with characters typed before the interruption.
    if (this.handleTypeahead(e)) return;
    this.typeaheadBuffer = '';

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        if (!this.isOpen()) {
          this.openList(true);
        } else {
          if (this.options().length === 0) break;
          // Wraparound to top.
          this.highlightedIndex.update((currVal) => {
            if (currVal === -1) return 0;
            return (currVal + 1) % this.options().length;
          });
          this.scrollHighlightedIntoView();
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        if (!this.isOpen()) {
          this.openList(false);
        } else {
          if (this.options().length === 0) break;
          // Wraparound to bottom.
          this.highlightedIndex.update((currVal) => {
            if (currVal === -1) return this.options().length - 1;
            return (currVal - 1 + this.options().length) % this.options().length;
          });
          this.scrollHighlightedIntoView();
        }
        break;
      }
      case 'Home': {
        e.preventDefault();
        if (!this.isOpen()) {
          this.openList(true);
        } else {
          if (this.options().length === 0) break;
          // Select first option.
          this.highlightedIndex.set(0);
          this.scrollHighlightedIntoView();
        }
        break;
      }
      case 'End': {
        e.preventDefault();
        if (!this.isOpen()) {
          this.openList(false);
        } else {
          if (this.options().length === 0) break;
          // Select last option.
          this.highlightedIndex.set(this.options().length - 1);
          this.scrollHighlightedIntoView();
        }
        break;
      }
      case 'Enter':
      case ' ': {
        e.preventDefault();
        if (this.isOpen() && this.highlightedIndex() >= 0) {
          this.selectOption(this.options()[this.highlightedIndex()] ?? null);
        } else if (!this.isOpen()) {
          this.openList();
        }
        break;
      }
      case 'Escape': {
        e.preventDefault();
        this.hidePanel();
        break;
      }
    }
  }

  // UTILITIES

  /** Reset interaction state (must be called when any interaction completes). */
  private resetInteractionState() {
    this.labelActivation.focusOpened.set(false);
  }
}
