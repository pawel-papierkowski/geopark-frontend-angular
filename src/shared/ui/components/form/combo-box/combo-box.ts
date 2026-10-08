import { Component, effect, inject, model, input, output, computed, linkedSignal, signal, viewChild, ElementRef, DestroyRef, DOCUMENT, Injector } from '@angular/core';
import { FormValueControl } from '@angular/forms/signals';
import { TranslateService } from '@ngx-translate/core';

import { forRender } from '@/shared/utils/render/after-render';
import { IdService } from '@/shared/utils/id/id-service';
import { warnDanglingLabel } from '@/shared/utils/a11y/warn-dangling-label';
import { stretchPanelPlacement } from '@/shared/ui/components/form/popup-panel/popup-panel-placement';
import { PanelPositioning } from '@/shared/ui/components/form/popup-panel/popup-panel-positioning';
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
export class ComboBox implements FormValueControl<number | string | null> {
  private readonly translateService = inject(TranslateService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly idService = inject(IdService);

  /** Value held by component. */
  public value = model<number | string | null>(null);
  /** Identifier for this component. */
  public ident = input<string>('');
  /** Resolved identifier: `ident` when provided, otherwise a generated `combo-box-N`.
   * Public, so consumers can reference it (e.g. `<label [for]>` or tests). */
  public readonly resolvedIdent = linkedSignal(() => this.idService.next(this.ident(), 'combo-box'));
  /** Label reference: id of an external element (usually `<label>`) used for `aria-labelledby`.
   * The id must match an element in the document - a dangling reference silently empties this
   * combobox's accessible name (there is no `aria-label` fallback), so dev mode warns on the
   * console (see `warnDanglingLabel`). */
  public label = input<string>('');
  /** Array of options. String, number (so also enum) and null allowed. */
  public options = input<(number | string | null)[]>([]);
  /** Prefix, used for auto-translating entries in the list. If empty, options will be shown as is without translation. */
  public langPrefix = input<string>('');
  /** Translation key to use if nothing is selected. Treated as raw text if langPrefix is empty. Optional, not used if options have null entry. */
  public placeholder = input<string>('');
  /** Is component required? */
  public readonly required = input<boolean>(false);
  /** Is component disabled? */
  public readonly disabled = input<boolean>(false);
  /** Is component invalid? */
  public readonly invalid = input<boolean>(false);
  /** Informs that user blurred out of component. */
  public touch = output<void>();

  /** Indicates visibility of combobox list. */
  public isOpen = signal(false);
  /** Label-activation coordination (focus-opens marker + forwarded-click decision, `closed`
   * for this component) plus the document guard; see `LabelActivation` for the full contract. */
  private readonly labelActivation = new LabelActivation<'closed'>();
  /** Index of currently highlighted option. -1 means none highlighted. */
  public highlightedIndex = signal(-1);
  /**
   * Placement state of the options list: inline insets plus the reset-baseline-before-measure
   * contract (see `PanelPositioning` and `stretchPanelPlacement`). Bound to the list's inline
   * style; reset on every open before measuring.
   */
  private readonly positioning = new PanelPositioning(stretchPanelPlacement);
  /** Inline style of the options list; alias of `positioning.containerStyle`. */
  public readonly containerStyle = this.positioning.containerStyle;
  /** Number of the most recent open - drops stale placement work from an earlier open. */
  private positionSession = 0;
  /** Typeahead search buffer: consecutive printable keystrokes merged into one prefix search. */
  private typeaheadBuffer = '';
  /** Timestamp (ms) of the last typeahead keystroke; decides when the buffer restarts. */
  private typeaheadLastKeyAt = 0;
  /** How long (ms) consecutive typeahead keystrokes keep merging into one search string. */
  private static readonly typeaheadBufferMs = 500;
  /** Root focusable element (role=combobox). */
  private comboRef = viewChild.required<ElementRef<HTMLDivElement>>('comboRef');
  /** Reference to the options list popup. */
  private optionsRef = viewChild.required<ElementRef<HTMLDivElement>>('optionsRef');

  constructor() {
    // Watch `disabled` field: close open list when component becomes disabled.
    effect(() => {
      if (this.disabled() && this.isOpen()) this.hidePanel();
    });

    // Clamp a highlight left dangling by options shrinking while the list is open (async or
    // replaced options): a stale index would point aria-activedescendant at a removed option
    // and make Enter resolve `options()[stale]` to undefined, selecting null instead.
    effect(() => {
      const optionCount = this.options().length;
      const highlighted = this.highlightedIndex();
      if (highlighted >= optionCount) this.highlightedIndex.set(optionCount > 0 ? optionCount - 1 : -1);
    });

    // Dev-only: catch a `label` id that matches no element. A dangling aria-labelledby would
    // leave this combobox with no accessible name (no aria-label fallback), which no app test
    // catches; re-runs whenever label or ident changes (see `warnDanglingLabel`).
    effect(() => {
      warnDanglingLabel(this.document, this.label(), this.resolvedIdent(), 'combo-box');
    });

    // Document-level guard for label activation: resets the interaction markers, cancels the
    // focus steal when the press lands on this component's own label and closes the options
    // list when the press lands outside the component entirely (mechanics and rationale in
    // `LabelActivation.installDocumentGuard`).
    this.labelActivation.installDocumentGuard({
      document: this.document,
      destroyRef: this.destroyRef,
      ident: () => this.resolvedIdent(),
      boundary: () => this.comboRef().nativeElement,
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

  // GENERAL FUNCTIONS

  /**
   * Get option element ID for aria-activedescendant.
   * @param index Index of option element.
   */
  public optionId(index: number): string {
    return `${this.resolvedIdent()}_option_${index}`;
  }

  /**
   * Open list.
   * @param top If true, set highlight on top, false on bottom, null - do not change highlight. Ignored if highlight already set.
   */
  private openList(top: boolean | null = null) {
    // Reset placement to the baseline (below the anchor, stretched) BEFORE the list renders,
    // so the measurement below always runs under this known alignment - measuring the list
    // as left over from the previous open would judge alignment by the OLD placement.
    this.positioning.resetBaseline();
    const session = ++this.positionSession;
    this.isOpen.set(true);
    void this.positionOptionsPanel(session);

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
   * Resolve the options list placement so it does not overflow the viewport.
   * Runs once per open, right after the list rendered under the baseline - the measurement
   * contract, viewport and margin details are documented on `WindowUtils.resolvePanelPlacement`.
   * Work from a superseded open (list closed or reopened before the render settled) is dropped,
   * so the measurement can never run under a placement other than the baseline.
   * The same pass resets the list's own scroll to the top and reveals the highlighted option,
   * so a stale offset from a previous open never hides the freshly seeded highlight.
   * @param session Placement session captured when the list was opened.
   */
  private async positionOptionsPanel(session: number): Promise<void> {
    await forRender(this.injector);

    if (session !== this.positionSession || !this.isOpen()) return;
    this.positioning.resolve(this.comboRef().nativeElement, this.optionsRef().nativeElement);
    this.optionsRef().nativeElement.scrollTop = 0;
    this.scrollHighlightedIntoView();
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
    const list = this.optionsRef().nativeElement;
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
   * User clicked on combobox option.
   * @param option Clicked option.
   */
  public selectOption(option: number | string | null) {
    if (this.disabled()) return;

    this.value.set(option);
    this.isOpen.set(false);
    this.typeaheadBuffer = '';
    this.resetInteractionState();
  }

  /**
   * Show value of option if selected. Placeholder text will be shown under these conditions:
   * - there is no selection (null value)
   * - and that null is not on list of options
   * @param option Option to show.
   * @returns Value of option.
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
   * the root's (blur) fire when the user later leaves the component.
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
    this.comboRef().nativeElement.focus(options);
  }

  /**
   * Handle blur. Focus moves within the component (root to hidden label button and back) are not
   * a real blur, so they must neither close the list nor emit touch.
   * @param e Focus event carrying the element focus moved to.
   */
  public handleBlur(e: FocusEvent) {
    const next = e.relatedTarget;
    if (next instanceof Node && this.comboRef().nativeElement.contains(next)) return;
    // Focus really left the component: a click decision recorded by a focus-first engine's
    // (Chromium/Firefox) label activation - whose click runs last - is now obsolete.
    this.labelActivation.setDecision('none');
    this.hidePanel();
    if (this.disabled()) return; // Programmatic close (disabled while focused), not a user blur.
    this.touch.emit();
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
    this.isOpen.update((currVal) => !currVal);
    if (this.isOpen()) {
      // Record the decision so a focus-first-paired focus handler (WebKit forwards the click
      // BEFORE focusing the hidden button) does not toggle again right after this one.
      this.labelActivation.setDecision('open');
      this.openList();
    } else {
      this.labelActivation.setDecision('closed');
      this.highlightedIndex.set(-1);
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

  /**
   * Hide panel with list of options.
   */
  private hidePanel() {
    if (!this.isOpen()) return; // already hidden

    this.isOpen.set(false);
    this.highlightedIndex.set(-1);
    this.typeaheadBuffer = '';
    this.resetInteractionState();
  }
}
