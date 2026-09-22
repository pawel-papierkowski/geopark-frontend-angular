import { Component, signal } from '@angular/core';
import { disabled, validate, form, FormField, submit, SchemaPath } from '@angular/forms/signals';

import {TranslatePipe} from '@ngx-translate/core';

import { CheckBox } from '@/shared/ui/components/form/check-box/check-box';
import { RadioBox } from '@/shared/ui/components/form/radio-box/radio-box';
import { TimeUtils } from '@/core/utils/TimeUtils';

/** Mode of inputs. */
export enum EnInputMode {
  /** Show inputs normally. */
  Standard,
  /** Show inputs in disabled state. */
  Disabled,
  /** Show inputs in error state. */
  Error,
  /** Show inputs in both disabled and error state. */
  DisabledError,
}

/** List of values for mode radiobox. */
export const enModeOptions: (number)[] = [EnInputMode.Standard, EnInputMode.Disabled, EnInputMode.Error, EnInputMode.DisabledError];
/** List of values for form radiobox. */
export const enRadioBoxOptions: (string | null)[] = [null, 'a', 'b'];

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
  imports: [ TranslatePipe, FormField, CheckBox, RadioBox ],
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
  compForm = form(this.compModel, (schema) => {
    this.modeDisabled(schema.textBox, schema.mode);
    this.modeDisabled(schema.checkBox, schema.mode);
    this.modeDisabled(schema.radioBox, schema.mode);
    this.modeDisabled(schema.dateTimePicker, schema.mode);
    this.modeDisabled(schema.datePicker, schema.mode);
    this.modeDisabled(schema.timePicker, schema.mode);
    this.modeInvalid(schema.textBox, schema.mode);
    this.modeInvalid(schema.checkBox, schema.mode);
    this.modeInvalid(schema.radioBox, schema.mode);
    this.modeInvalid(schema.dateTimePicker, schema.mode);
    this.modeInvalid(schema.datePicker, schema.mode);
    this.modeInvalid(schema.timePicker, schema.mode);
  });

  /** Mode. */
  enModeOptions = enModeOptions;
  /** Options for radio box. */
  enRadioBoxOptions = enRadioBoxOptions;

  //

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
  async handleSubmit(event: Event) {
    event.preventDefault();
    await submit(this.compForm, async (formData) => {
      // in future we will show actual feedback from entire form for user visible in browser
      console.log('Derp: ' + formData.radioBox().value());
    });
  }

  //

  /**
   * Determine if given field should be disabled.
   * @param field Schema for current field.
   * @param mode Schema for mode.
   */
  modeDisabled(field: SchemaPath<unknown>, mode: SchemaPath<EnInputMode | null>) {
    disabled(field, {
      when: ({valueOf}) => valueOf(mode) === EnInputMode.Disabled || valueOf(mode) === EnInputMode.DisabledError
    });
  }

  /**
   * Determine if given field should be invalid.
   * @param field Schema for current field.
   * @param mode Schema for mode.
   */
  modeInvalid(field: SchemaPath<unknown>, mode: SchemaPath<EnInputMode | null>) {
    validate(field, ({valueOf}) => {
      if (valueOf(mode) === EnInputMode.Error || valueOf(mode) === EnInputMode.DisabledError)
        return {kind: 'alwaysInvalid', message: 'Deliberately invalid.'};
      return null;
    });
  }
}
