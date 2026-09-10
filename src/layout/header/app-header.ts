import { Component } from '@angular/core';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
  selector: 'app-header',
  imports: [ TranslatePipe ],
  templateUrl: './app-header.html',
  styleUrl: './app-header.css',
})
export class AppHeader {
}
