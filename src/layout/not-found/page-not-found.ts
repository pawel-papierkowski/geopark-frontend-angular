import { Component, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import {TranslatePipe} from '@ngx-translate/core';

@Component({
  selector: 'page-not-found',
  imports: [ TranslatePipe ],
  styleUrl: './page-not-found.css',
  templateUrl: './page-not-found.html',
})
export class PageNotFound {
  private readonly meta = inject(Meta);

  ngOnInit(): void {
    // Inject additional metadata into header of page.
    this.meta.addTag({ name: 'prerender-status-code', content: '404' });
  }
}
