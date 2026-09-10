import { Component } from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';

import { projectProp } from "@/shared/config/const";

@Component({
  selector: 'app-footer',
  imports: [ TranslatePipe ],
  templateUrl: './app-footer.html',
  styleUrl: './app-footer.css',
})
export class AppFooter {
  projectProp = projectProp;
}
