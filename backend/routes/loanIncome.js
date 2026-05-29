const toPositiveAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const normalizeText = (value) => {
  const text = String(value || '').trim();
  return text || null;
};

const verifyIncomeType = async (client, incomeTypeId) => {
  const result = await client.query(
    `SELECT income_type_id, income_type_name
     FROM income_types
     WHERE income_type_id = $1 AND COALESCE(is_active, true) = true`,
    [incomeTypeId]
  );
  return result.rows[0] || null;
};

const getLoanCustomer = async (client, loanId) => {
  const result = await client.query(
    `SELECT l.loan_id, l.customer_id, c.customer_name
     FROM loans l
     LEFT JOIN customers c ON c.customer_id = l.customer_id
     WHERE l.loan_id = $1`,
    [loanId]
  );
  return result.rows[0] || null;
};

export function loanIncomeEndpoint(
  app,
  pool,
  requireCollect = (req, res, next) => next(),
  requireCreateLoans = (req, res, next) => next()
) {
  app.get('/api/income-types', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT income_type_id, income_type_name, is_active
         FROM income_types
         ORDER BY income_type_name`
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/income-types', requireCreateLoans, async (req, res) => {
    const incomeTypeName = normalizeText(req.body.income_type_name);
    if (!incomeTypeName) {
      return res.status(400).json({ error: 'Income type name is required' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO income_types (income_type_name)
         VALUES ($1)
         ON CONFLICT (income_type_name)
         DO UPDATE SET is_active = true, updated_at = NOW()
         RETURNING income_type_id, income_type_name, is_active`,
        [incomeTypeName]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/income-types/:income_type_id', requireCreateLoans, async (req, res) => {
    const { income_type_id } = req.params;
    const incomeTypeName = normalizeText(req.body.income_type_name);
    const isActive = req.body.is_active;

    if (!incomeTypeName) {
      return res.status(400).json({ error: 'Income type name is required' });
    }

    try {
      const result = await pool.query(
        `UPDATE income_types
         SET income_type_name = $1,
             is_active = COALESCE($2, is_active),
             updated_at = NOW()
         WHERE income_type_id = $3
         RETURNING income_type_id, income_type_name, is_active`,
        [incomeTypeName, typeof isActive === 'boolean' ? isActive : null, income_type_id]
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: 'Income type not found' });
      }

      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/loan-income', async (req, res) => {
    try {
      const { loan_id, customer_id, income_type_id, from, to, text } = req.query;
      const where = [];
      const params = [];
      let idx = 1;

      if (loan_id) {
        where.push(`li.loan_id = $${idx++}`);
        params.push(loan_id);
      }
      if (customer_id) {
        where.push(`li.customer_id = $${idx++}`);
        params.push(customer_id);
      }
      if (income_type_id) {
        where.push(`li.income_type_id = $${idx++}`);
        params.push(income_type_id);
      }
      if (from) {
        where.push(`li.income_date >= $${idx++}`);
        params.push(from);
      }
      if (to) {
        where.push(`li.income_date <= $${idx++}`);
        params.push(to);
      }
      if (text) {
        where.push(`(
          li.loan_id ILIKE $${idx} OR
          li.customer_id ILIKE $${idx} OR
          c.customer_name ILIKE $${idx} OR
          it.income_type_name ILIKE $${idx} OR
          li.received_by ILIKE $${idx} OR
          li.notes ILIKE $${idx}
        )`);
        params.push(`%${text}%`);
        idx++;
      }

      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const result = await pool.query(
        `SELECT
           li.loan_income_id,
           li.loan_id,
           li.customer_id,
           c.customer_name,
           l.loan_type,
           li.income_type_id,
           it.income_type_name,
           li.income_date,
           li.amount,
           li.received_by,
           li.notes,
           li.created_at,
           li.updated_at
         FROM loan_income li
         JOIN income_types it ON it.income_type_id = li.income_type_id
         LEFT JOIN loans l ON l.loan_id = li.loan_id
         LEFT JOIN customers c ON c.customer_id = li.customer_id
         ${whereClause}
         ORDER BY li.income_date DESC, li.loan_income_id DESC`,
        params
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/loan-income', requireCollect, async (req, res) => {
    const loanId = normalizeText(req.body.loan_id);
    const incomeTypeId = req.body.income_type_id;
    const incomeDate = normalizeText(req.body.income_date);
    const amount = toPositiveAmount(req.body.amount);
    const receivedBy = normalizeText(req.body.received_by) || req.user?.name || null;
    const notes = normalizeText(req.body.notes);

    if (!loanId) return res.status(400).json({ error: 'Loan ID is required' });
    if (!incomeTypeId) return res.status(400).json({ error: 'Income type is required' });
    if (!incomeDate) return res.status(400).json({ error: 'Income date is required' });
    if (!amount) return res.status(400).json({ error: 'Amount must be greater than zero' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const loan = await getLoanCustomer(client, loanId);
      if (!loan) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Loan not found: ${loanId}` });
      }

      const incomeType = await verifyIncomeType(client, incomeTypeId);
      if (!incomeType) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Active income type not found' });
      }

      const result = await client.query(
        `INSERT INTO loan_income (
           loan_id,
           customer_id,
           income_type_id,
           income_date,
           amount,
           received_by,
           notes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [loan.loan_id, loan.customer_id, incomeType.income_type_id, incomeDate, amount, receivedBy, notes]
      );

      await client.query('COMMIT');
      res.status(201).json({
        ...result.rows[0],
        customer_name: loan.customer_name,
        income_type_name: incomeType.income_type_name,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  app.put('/api/loan-income/:loan_income_id', requireCollect, async (req, res) => {
    const { loan_income_id } = req.params;
    const loanId = normalizeText(req.body.loan_id);
    const incomeTypeId = req.body.income_type_id;
    const incomeDate = normalizeText(req.body.income_date);
    const amount = toPositiveAmount(req.body.amount);
    const receivedBy = normalizeText(req.body.received_by) || req.user?.name || null;
    const notes = normalizeText(req.body.notes);

    if (!loanId) return res.status(400).json({ error: 'Loan ID is required' });
    if (!incomeTypeId) return res.status(400).json({ error: 'Income type is required' });
    if (!incomeDate) return res.status(400).json({ error: 'Income date is required' });
    if (!amount) return res.status(400).json({ error: 'Amount must be greater than zero' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const loan = await getLoanCustomer(client, loanId);
      if (!loan) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Loan not found: ${loanId}` });
      }

      const incomeType = await verifyIncomeType(client, incomeTypeId);
      if (!incomeType) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Active income type not found' });
      }

      const result = await client.query(
        `UPDATE loan_income
         SET loan_id = $1,
             customer_id = $2,
             income_type_id = $3,
             income_date = $4,
             amount = $5,
             received_by = $6,
             notes = $7,
             updated_at = NOW()
         WHERE loan_income_id = $8
         RETURNING *`,
        [loan.loan_id, loan.customer_id, incomeType.income_type_id, incomeDate, amount, receivedBy, notes, loan_income_id]
      );

      if (!result.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Loan income entry not found' });
      }

      await client.query('COMMIT');
      res.json({
        ...result.rows[0],
        customer_name: loan.customer_name,
        income_type_name: incomeType.income_type_name,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  app.delete('/api/loan-income/:loan_income_id', requireCollect, async (req, res) => {
    const { loan_income_id } = req.params;
    try {
      const result = await pool.query(
        `DELETE FROM loan_income
         WHERE loan_income_id = $1
         RETURNING loan_income_id`,
        [loan_income_id]
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: 'Loan income entry not found' });
      }

      res.json({ message: 'Loan income entry deleted', loan_income_id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
