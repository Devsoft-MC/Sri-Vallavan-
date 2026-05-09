const formatDate = (dateObj) => dateObj.toISOString().slice(0, 10);

const parseDate = (value) => {
  if (!value) return null;
  const dateObj = new Date(value);
  return Number.isNaN(dateObj.getTime()) ? null : dateObj;
};

const addDaysUtc = (dateObj, days) => {
  const d = new Date(dateObj);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

const addMonthsUtc = (dateObj, months) => {
  const d = new Date(dateObj);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
};

const resolveLoanTypeCode = (loanType = '') => {
  const type = String(loanType).toLowerCase();
  if (type.includes('personal') || type === 'pl') return 'PL';
  if (type.includes('vehicle') || type === 'vl') return 'VL';
  if (type.includes('gold') || type === 'gl') return 'GL';
  return null;
};

const calculateDefaultMaturityDate = (loanTypeCode, issueDateObj) => {
  if (loanTypeCode === 'PL') return formatDate(addDaysUtc(issueDateObj, 100));
  if (loanTypeCode === 'VL') return formatDate(addDaysUtc(issueDateObj, 365));
  if (loanTypeCode === 'GL') return formatDate(addMonthsUtc(issueDateObj, 3));
  return null;
};

// Modularized loan endpoints.
export function addLoanEndpoint(app, pool) {
  app.get('/api/loans/maturity-preview', async (req, res) => {
    const { loan_type, issue_date } = req.query;
    const issueDateObj = parseDate(issue_date);
    if (!issueDateObj) {
      return res.status(400).json({ error: 'Valid issue_date is required' });
    }

    const loanTypeCode = resolveLoanTypeCode(loan_type);
    if (!loanTypeCode) {
      return res.status(400).json({ error: 'Valid loan_type is required (Personal, Vehicle, or Gold)' });
    }

    res.json({
      loan_type,
      loan_type_code: loanTypeCode,
      issue_date: formatDate(issueDateObj),
      maturity_date: calculateDefaultMaturityDate(loanTypeCode, issueDateObj),
    });
  });

  app.post('/api/loans', async (req, res) => {
    const { customer_id, loan_type, issue_date, issue_amount, interest_received, maturity_date } = req.body;
    const issueDateObj = parseDate(issue_date);
    if (!issueDateObj) {
      return res.status(400).json({ error: 'Valid issue_date is required' });
    }

    const requestedMaturityDateObj = maturity_date ? parseDate(maturity_date) : null;
    if (maturity_date && !requestedMaturityDateObj) {
      return res.status(400).json({ error: 'Valid maturity_date is required' });
    }

    const loanTypeCode = resolveLoanTypeCode(loan_type);
    if (!loanTypeCode) {
      return res.status(400).json({ error: `Only Personal, Vehicle, or Gold loans are supported. Got: ${loan_type}` });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const serialResult = await client.query(
        `SELECT last_number FROM serials WHERE code = 'loan_id' FOR UPDATE`
      );
      if (serialResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(500).json({ error: `Serial code 'loan_id' not found` });
      }

      const typeResult = await client.query(
        `SELECT loan_type_code FROM loan_types WHERE loan_type_code = $1`,
        [loanTypeCode]
      );
      if (typeResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Invalid loan type: ${loan_type}` });
      }

      const lastNumber = parseInt(serialResult.rows[0].last_number, 10) || 0;
      const nextNumber = lastNumber + 1;
      const loan_id = `${loanTypeCode}${nextNumber}`;
      const finalMaturityDate = requestedMaturityDateObj
        ? formatDate(requestedMaturityDateObj)
        : calculateDefaultMaturityDate(loanTypeCode, issueDateObj);

      const result = await client.query(
        `INSERT INTO loans (loan_id, customer_id, loan_type, issue_date, issue_amount, interest_received, maturity_date, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          loan_id,
          customer_id,
          loan_type,
          formatDate(issueDateObj),
          issue_amount,
          interest_received === undefined || interest_received === '' ? null : interest_received,
          finalMaturityDate,
          'Open'
        ]
      );

      await client.query(
        `UPDATE serials SET last_number = $1 WHERE code = 'loan_id'`,
        [nextNumber]
      );

      await client.query('COMMIT');
      res.status(201).json(result.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });
}
