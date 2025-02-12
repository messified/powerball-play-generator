import { TestBed } from '@angular/core/testing';

import { PickCheckerService } from './pick-checker.service';

describe('PickCheckerService', () => {
  let service: PickCheckerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PickCheckerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
