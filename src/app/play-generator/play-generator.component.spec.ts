import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlayGeneratorComponent } from './play-generator.component';

describe('PlayGeneratorComponent', () => {
  let component: PlayGeneratorComponent;
  let fixture: ComponentFixture<PlayGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlayGeneratorComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PlayGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
