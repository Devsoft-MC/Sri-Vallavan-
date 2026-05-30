ALTER TABLE income_types
ADD COLUMN IF NOT EXISTS affects_profit BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE expense_types
ADD COLUMN IF NOT EXISTS affects_profit BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE income_types
SET affects_profit = FALSE;

UPDATE income_types
SET affects_profit = TRUE,
    is_active = TRUE,
    updated_at = NOW()
WHERE income_type_name IN (
  'Interest Received',
  'Processing Fee',
  'Penalty',
  'Document Charge'
);

UPDATE income_types
SET affects_profit = FALSE,
    updated_at = NOW()
WHERE income_type_name IN (
  'Capital',
  'Partner Capital',
  'Partner Loan',
  'Gold Pledge Cash',
  'Loan from Gold Pledge',
  'Old Shop Advance',
  'Other Receipt',
  'Other Loan Income'
);

UPDATE expense_types
SET affects_profit = TRUE;

UPDATE expense_types
SET affects_profit = FALSE
WHERE expense_type_name IN (
  'Bike Advance',
  'Cash at Bank',
  'Cash in Hand & Bank',
  'Petty Cash',
  'Room Advance',
  'Partner Capital Withdrawal',
  'Partner Loan Repayment',
  'Loan Issued to Customer',
  'Gold Pledge Principal',
  'Other Payment'
);
