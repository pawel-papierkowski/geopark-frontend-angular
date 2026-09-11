import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { AppHeader } from '@/layout/header/app-header';
import { AppFooter } from '@/layout/footer/app-footer';

@Component({
  imports: [RouterOutlet, AppHeader, AppFooter],
  selector: 'public-layout',
  styleUrl: './public-layout.css',
  templateUrl: './public-layout.html',
})
export class PublicLayout {
}
