import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';


@Component({
  selector: 'app-lottery-settings',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './lottery-settings.component.html',
  styleUrl: './lottery-settings.component.scss'
})
export class LotterySettingsComponent implements OnInit {
  /**
   * FormGroup instance for managing the lottery settings.
   */
  settingsForm!: FormGroup;
  ticketCount = 50;
  recencyExpBase = 1.03;


  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    // Initialize the form and specify default values & validators as needed
    this.settingsForm = this.fb.group({
      /**
       * Recency Exp Base:
       * - Default value is 1.03
       * - Must be required (example: make sure the user doesn’t leave it empty)
       * - Optionally, you could add more validation (e.g., min value, max value)
       */
      recencyExpBase: [1.03, [Validators.required]],

      /**
       * Ticket Count:
       * - Default value is 5
       * - Must be required
       * - Additionally, can set min=1, max=99 (or any range you prefer)
       */
      ticketCount: [50, [Validators.required, Validators.min(1)]]
    });
  }

  /**
   * Handler for form submission (ngSubmit).
   * Logs or processes the form values.
   */
  onSubmit(): void {
    if (this.settingsForm.valid) {
      const formValues = this.settingsForm.value;
      console.log('Recency Exp Base:', formValues.recencyExpBase);
      console.log('Ticket Count:', formValues.ticketCount);

      // You can now pass these values to your service or further logic
    } else {
      // Handle invalid form (show errors, etc.)
      console.warn('Form is invalid. Please check your inputs.');
    }
  }
}
