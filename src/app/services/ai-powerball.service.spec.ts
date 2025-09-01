import { TestBed } from '@angular/core/testing';

import { AiPowerballService } from './ai-powerball.service';

describe('AiPowerballService', () => {
  let service: AiPowerballService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AiPowerballService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
