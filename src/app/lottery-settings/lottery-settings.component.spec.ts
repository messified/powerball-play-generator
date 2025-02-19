import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LotterySettingsComponent } from './lottery-settings.component';

describe('LotterySettingsComponent', () => {
  let component: LotterySettingsComponent;
  let fixture: ComponentFixture<LotterySettingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LotterySettingsComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LotterySettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
