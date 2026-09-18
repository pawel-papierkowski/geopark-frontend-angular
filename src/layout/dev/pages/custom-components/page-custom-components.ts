import { Component, signal } from '@angular/core';
import { form, FormField, submit } from '@angular/forms/signals';

import {TranslatePipe} from '@ngx-translate/core';

import { CheckBox } from '@/shared/ui/components/form/check-box/check-box';
import { TimeUtils } from '@/core/utils/TimeUtils';

/** Mode of inputs. */
export enum EnInputMode {
  /** Show inputs normally. */
  Standard,
  /** Show inputs in disabled state. */
  Disabled,
  /** Show inputs in error state. */
  Error,
}

/** List of values for mode radiobox. */
export const enModeOptions: (number | null)[] = [EnInputMode.Standard, EnInputMode.Disabled, EnInputMode.Error];

/** Custom components type. */
export type CustomComponentsForm = {
  mode: EnInputMode | null;
  textBox: string | null;
  comboBox: string | null;
  checkBox: boolean | null;
  radioBox: string | null;
  dateTimePicker: Date | null;
  datePicker: Date | null;
  timePicker: Date | null;
};

/**
 * Page that shows off all custom form components in project.
 */
@Component({
  selector: 'page-custom-components',
  imports: [ TranslatePipe, FormField, CheckBox ],
  styleUrl: './page-custom-components.css',
  templateUrl: './page-custom-components.html',
})
export class PageCustomComponents {
  /** Custom components model. */
  compModel = signal<CustomComponentsForm>({
    mode: EnInputMode.Standard,
    textBox: null,
    comboBox: null,
    checkBox: null,
    radioBox: null,
    dateTimePicker: null,
    datePicker: null,
    timePicker: null,
  });
  /** Custom components form. */
  compForm = form(this.compModel);

  /**
   * Show value as text or emoji.
   * @param value Value to show.
   * @returns Value as string.
   */
  show(value: Date | string | boolean | null): string {
    if (value === null) return '❓';
    if (typeof value === 'boolean') return value ? '✅' : '❌';
    if (value instanceof Date) return TimeUtils.cnvFull(value) || '';
    return value;
  };

  /**
   * React on submit button press.
   */
  onSubmit = submit(this.compForm , async (formData) => {
    // formData is the resolved model value
    console.log('Derp: '+formData.checkBox().value());
  });
}
