BEGIN;

ALTER TABLE income_types
  ADD COLUMN IF NOT EXISTS requires_loan BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE income_types
SET requires_loan = CASE
  WHEN income_type_name = 'Interest Received' THEN TRUE
  ELSE FALSE
END;

UPDATE income_types
SET income_type_name = 'Other Receipt',
    updated_at = NOW()
WHERE income_type_name = 'Other Loan Income'
  AND NOT EXISTS (
    SELECT 1
    FROM income_types existing
    WHERE existing.income_type_name = 'Other Receipt'
  );

UPDATE income_types
SET is_active = FALSE,
    updated_at = NOW()
WHERE income_type_name = 'Other Loan Income';

INSERT INTO income_types (income_type_name, requires_loan)
VALUES
  ('Interest Received', TRUE),
  ('Processing Fee', FALSE),
  ('Penalty', FALSE),
  ('Partner Capital', FALSE),
  ('Partner Loan', FALSE),
  ('Gold Pledge Cash', FALSE),
  ('Other Receipt', FALSE)
ON CONFLICT (income_type_name)
DO UPDATE SET
  requires_loan = EXCLUDED.requires_loan,
  is_active = TRUE,
  updated_at = NOW();

ALTER TABLE loan_income
  ALTER COLUMN loan_id DROP NOT NULL,
  ALTER COLUMN customer_id DROP NOT NULL;

COMMIT;
