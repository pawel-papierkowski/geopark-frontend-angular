import { TestBed } from '@angular/core/testing';

import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        App
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    // Assert: Application exists.
    expect(app).toBeTruthy();
  });

  it('should render title', async () => {
    // Arrange: Create component.
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    // Assert: Application contains correct data.
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('p')?.textContent).toContain('TEXT');
  });
});
