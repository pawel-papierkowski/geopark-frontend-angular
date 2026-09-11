import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppHeader } from '@/layout/header/app-header';
import { AppFooter } from '@/layout/footer/app-footer';

@Component({
  imports: [RouterOutlet, AppHeader, AppFooter],
  selector: 'dev-layout',
  styleUrl: './dev-layout.css',
  templateUrl: './dev-layout.html',
})
export class DevLayout {
}
