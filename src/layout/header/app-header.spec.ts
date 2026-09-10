import { TestBed } from '@angular/core/testing';
import { AppHeader } from './app-header';

describe('AppHeader', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppHeader],
    })
      .compileComponents();
  });


  it('should render content', async () => {
    const fixture = TestBed.createComponent(AppHeader);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header')?.textContent).toContain('GeoPark');
  });
});
