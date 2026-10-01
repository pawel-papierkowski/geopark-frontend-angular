import { Component, signal } from '@angular/core';
import { disabled, validate, form, FormField, submit, SchemaPath } from '@angular/forms/signals';

import { TranslatePipe } from '@ngx-translate/core';

import { TextBox } from '@/shared/ui/components/form/text-box/text-box';
import { CheckBox } from '@/shared/ui/components/form/check-box/check-box';
import { RadioBox } from '@/shared/ui/components/form/radio-box/radio-box';
import { ComboBox } from '@/shared/ui/components/form/combo-box/combo-box';
import { DateTimePicker } from '@/shared/ui/components/form/date-time-picker/date-time-picker';
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

/** Array of values for mode radiobox. */
export const enModeOptions: (number)[] = [EnInputMode.Standard, EnInputMode.Disabled, EnInputMode.Error, EnInputMode.DisabledError];
/** Array of values for form radiobox. */
export const enRadioBoxOptions: (string | null)[] = [null, 'a', 'b'];
/** Array of values for form combobox. */
const enComboBoxOptions: (string|null)[] = [ null, 'OPT1', 'OPT2' ];

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
  /** Versions of components with canNull enabled. */
  checkBoxNull: boolean | null;
  dateTimePickerNull: Date | null;
  datePickerNull: Date | null;
  timePickerNull: Date | null;
};

/**
 * Page that shows off all custom form components in project.
 */
@Component({
  selector: 'page-custom-components',
  imports: [ TranslatePipe, FormField, TextBox, CheckBox, RadioBox, ComboBox, DateTimePicker ],
  styleUrl: './page-custom-components.css',
  templateUrl: './page-custom-components.html',
})
export class PageCustomComponents {
  /** Custom components model. */
  private compModel = signal<CustomComponentsForm>({
    mode: EnInputMode.Standard,
    textBox: null,
    comboBox: null,
    checkBox: null,
    radioBox: null,
    dateTimePicker: null,
    datePicker: null,
    timePicker: null,
    checkBoxNull: null,
    dateTimePickerNull: null,
    datePickerNull: null,
    timePickerNull: null,
  });

  /** Custom components form. */
  public compForm = form(this.compModel, (schema) => {
    this.modeDisabled(schema.textBox, schema.mode);
    this.modeDisabled(schema.checkBox, schema.mode);
    this.modeDisabled(schema.comboBox, schema.mode);
    this.modeDisabled(schema.radioBox, schema.mode);
    this.modeDisabled(schema.dateTimePicker, schema.mode);
    this.modeDisabled(schema.datePicker, schema.mode);
    this.modeDisabled(schema.timePicker, schema.mode);
    this.modeDisabled(schema.checkBoxNull, schema.mode);
    this.modeDisabled(schema.dateTimePickerNull, schema.mode);
    this.modeDisabled(schema.datePickerNull, schema.mode);
    this.modeDisabled(schema.timePickerNull, schema.mode);
    this.modeInvalid(schema.textBox, schema.mode);
    this.modeInvalid(schema.checkBox, schema.mode);
    this.modeInvalid(schema.comboBox, schema.mode);
    this.modeInvalid(schema.radioBox, schema.mode);
    this.modeInvalid(schema.dateTimePicker, schema.mode);
    this.modeInvalid(schema.datePicker, schema.mode);
    this.modeInvalid(schema.timePicker, schema.mode);
    this.modeInvalid(schema.checkBoxNull, schema.mode);
    this.modeInvalid(schema.dateTimePickerNull, schema.mode);
    this.modeInvalid(schema.datePickerNull, schema.mode);
    this.modeInvalid(schema.timePickerNull, schema.mode);
  });

  /** Mode. */
  public enModeOptions = enModeOptions;
  /** Options for radiobox. */
  public enRadioBoxOptions = enRadioBoxOptions;
  /** Options for combobox. */
  public enComboBoxOptions = enComboBoxOptions;

  //

  /**
   * Show value as text or emoji.
   * @param value Value to show.
   * @returns Value as string.
   */
  public show(value: Date | string | boolean | null): string {
    if (value === null) return '❓';
    if (typeof value === 'boolean') return value ? '✅' : '❌';
    if (value instanceof Date) return TimeUtils.cnvFull(value) || '';
    return value;
  };

  /**
   * React on submit button press.
   */
  public handleSubmit(event: Event) {
    event.preventDefault();
    void submit(this.compForm, async (formData) => {
      // TODO: in future we will show formData values visible in browser as feedback for user
      console.log('Derp: ' + formData.radioBox().value());
    });
  }

  //

  /**
   * Determine if given field should be disabled.
   * @param field Schema for current field.
   * @param mode Schema for mode.
   */
  private modeDisabled(field: SchemaPath<unknown>, mode: SchemaPath<EnInputMode | null>) {
    disabled(field, {
      when: ({valueOf}) => valueOf(mode) === EnInputMode.Disabled || valueOf(mode) === EnInputMode.DisabledError
    });
  }

  /**
   * Determine if given field should be invalid.
   * @param field Schema for current field.
   * @param mode Schema for mode.
   */
  private modeInvalid(field: SchemaPath<unknown>, mode: SchemaPath<EnInputMode | null>) {
    validate(field, ({valueOf}) => {
      if (valueOf(mode) === EnInputMode.Error || valueOf(mode) === EnInputMode.DisabledError)
        return {kind: 'alwaysInvalid', message: 'Deliberately invalid.'};
      return null;
    });
  }
}
