import { Component, inject, type OnDestroy, type OnInit } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { TranslatePipe } from '@ngx-translate/core';

/**
 * Default 404 page.
 * Note: It has handling for server with prerendering support (like Angular Universal). It won't have effect on GitHub Pages.
 */
@Component({
  selector: 'page-not-found',
  imports: [ TranslatePipe ],
  styleUrl: './page-not-found.css',
  templateUrl: './page-not-found.html',
})
export class PageNotFound implements OnInit, OnDestroy {
  private readonly meta = inject(Meta);
  private tag: HTMLMetaElement | null = null;

  ngOnInit(): void {
    // Inject additional metadata into header of page to inform.
    this.tag = this.meta.addTag({ name: 'prerender-status-code', content: '404', id: 'prerender-status-code' });
  }

  ngOnDestroy(): void {
    // Clean up metadata.
    if (this.tag) this.meta.removeTagElement(this.tag);
  }
}
