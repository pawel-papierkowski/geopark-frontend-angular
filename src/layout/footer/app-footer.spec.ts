import { TestBed } from '@angular/core/testing';
import { AppFooter } from './app-footer';

describe('AppFooter', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppFooter],
    })
      .compileComponents();
  });


  it('should render content', async () => {
    const fixture = TestBed.createComponent(AppFooter);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('footer')?.textContent).toContain('https://github.com/pawel-papierkowski/geopark-frontend-angular');
  });
});
