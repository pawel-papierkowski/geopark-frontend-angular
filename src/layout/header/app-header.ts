import { Component } from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';

import { LangSwitcher } from '@/shared/ui/lang-switcher/lang-switcher';

@Component({
  selector: 'app-header',
  imports: [ TranslatePipe, LangSwitcher ],
  templateUrl: './app-header.html',
  styleUrl: './app-header.css',
})
export class AppHeader {
}
