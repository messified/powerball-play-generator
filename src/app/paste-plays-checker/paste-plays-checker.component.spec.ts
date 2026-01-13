import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PastePlaysCheckerComponent } from './paste-plays-checker.component';

describe('PastePlaysCheckerComponent', () => {
  let component: PastePlaysCheckerComponent;
  let fixture: ComponentFixture<PastePlaysCheckerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PastePlaysCheckerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PastePlaysCheckerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
