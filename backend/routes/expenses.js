const normalizeText = (value) => {
  const text = String(value || '').trim();
  return text || null;
};

const toPositiveAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
};

const verifyExpenseType = async (client, expenseTypeId) => {
  const result = await client.query(
    `SELECT expense_type_id, expense_type_name, COALESCE(affects_profit, true) AS affects_profit
     FROM expense_types
     WHERE expense_type_id = $1 AND COALESCE(is_active, true) = true`,
    [expenseTypeId]
  );
  return result.rows[0] || null;
};

export function expensesEndpoint(
  app,
  pool,
  requireAdmin = (req, res, next) => next(),
  requireExpenseAccess = requireAdmin
) {
  app.get('/api/expense-types', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT expense_type_id, expense_type_name, is_active, COALESCE(affects_profit, true) AS affects_profit
         FROM expense_types
         ORDER BY expense_type_name`
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/expense-types', requireAdmin, async (req, res) => {
    const expenseTypeName = normalizeText(req.body.expense_type_name);
    const affectsProfit = req.body.affects_profit !== false;
    if (!expenseTypeName) {
      return res.status(400).json({ error: 'Expense type name is required' });
    }

    try {
      const result = await pool.query(
        `INSERT INTO expense_types (expense_type_name, affects_profit)
         VALUES ($1, $2)
         ON CONFLICT (expense_type_name)
         DO UPDATE SET is_active = true, affects_profit = EXCLUDED.affects_profit
         RETURNING expense_type_id, expense_type_name, is_active, COALESCE(affects_profit, true) AS affects_profit`,
        [expenseTypeName, affectsProfit]
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/expense-types/:expense_type_id', requireAdmin, async (req, res) => {
    const { expense_type_id } = req.params;
    const expenseTypeName = normalizeText(req.body.expense_type_name);
    const isActive = req.body.is_active;
    const affectsProfit = req.body.affects_profit;

    if (!expenseTypeName) {
      return res.status(400).json({ error: 'Expense type name is required' });
    }

    try {
      const result = await pool.query(
        `UPDATE expense_types
         SET expense_type_name = $1,
             is_active = COALESCE($2, is_active),
             affects_profit = COALESCE($3, affects_profit)
         WHERE expense_type_id = $4
         RETURNING expense_type_id, expense_type_name, is_active, COALESCE(affects_profit, true) AS affects_profit`,
        [
          expenseTypeName,
          typeof isActive === 'boolean' ? isActive : null,
          typeof affectsProfit === 'boolean' ? affectsProfit : null,
          expense_type_id,
        ]
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: 'Expense type not found' });
      }

      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/expenses', requireExpenseAccess, async (req, res) => {
    try {
      const { expense_type_id, from, to, text, paid_by } = req.query;
      const where = [];
      const params = [];
      let idx = 1;

      if (expense_type_id) {
        where.push(`e.expense_type_id = $${idx++}`);
        params.push(expense_type_id);
      }
      if (from) {
        where.push(`e.expense_date >= $${idx++}`);
        params.push(from);
      }
      if (to) {
        where.push(`e.expense_date <= $${idx++}`);
        params.push(to);
      }
      if (paid_by) {
        where.push(`e.paid_by = $${idx++}`);
        params.push(paid_by);
      }
      if (text) {
        where.push(`(
          et.expense_type_name ILIKE $${idx} OR
          e.paid_to ILIKE $${idx} OR
          e.paid_by ILIKE $${idx} OR
          e.payment_mode ILIKE $${idx} OR
          e.notes ILIKE $${idx}
        )`);
        params.push(`%${text}%`);
        idx++;
      }

      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const limitClause = expense_type_id || from || to || text || paid_by ? '' : 'LIMIT 200';
      const result = await pool.query(
        `SELECT
           e.expense_id,
           e.expense_date,
           e.expense_type_id,
           et.expense_type_name,
           e.amount,
           e.paid_to,
           e.paid_by,
           e.payment_mode,
           e.notes,
           e.created_at
         FROM expenses e
         JOIN expense_types et ON et.expense_type_id = e.expense_type_id
         ${whereClause}
         ORDER BY e.expense_date DESC, e.expense_id DESC
         ${limitClause}`,
        params
      );
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/expenses', requireExpenseAccess, async (req, res) => {
    const expenseDate = normalizeText(req.body.expense_date);
    const expenseTypeId = req.body.expense_type_id;
    const amount = toPositiveAmount(req.body.amount);
    const paidTo = normalizeText(req.body.paid_to);
    const paidBy = normalizeText(req.body.paid_by) || req.user?.name || null;
    const paymentMode = normalizeText(req.body.payment_mode);
    const notes = normalizeText(req.body.notes);

    if (!expenseDate) return res.status(400).json({ error: 'Expense date is required' });
    if (!expenseTypeId) return res.status(400).json({ error: 'Expense type is required' });
    if (!amount) return res.status(400).json({ error: 'Amount must be greater than zero' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const expenseType = await verifyExpenseType(client, expenseTypeId);
      if (!expenseType) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Active expense type not found' });
      }

      const result = await client.query(
        `INSERT INTO expenses (
           expense_date,
           expense_type_id,
           amount,
           paid_to,
           paid_by,
           payment_mode,
           notes
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [expenseDate, expenseType.expense_type_id, amount, paidTo, paidBy, paymentMode, notes]
      );

      await client.query('COMMIT');
      res.status(201).json({
        ...result.rows[0],
        expense_type_name: expenseType.expense_type_name,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  app.put('/api/expenses/:expense_id', requireExpenseAccess, async (req, res) => {
    const { expense_id } = req.params;
    const expenseDate = normalizeText(req.body.expense_date);
    const expenseTypeId = req.body.expense_type_id;
    const amount = toPositiveAmount(req.body.amount);
    const paidTo = normalizeText(req.body.paid_to);
    const paidBy = normalizeText(req.body.paid_by) || req.user?.name || null;
    const paymentMode = normalizeText(req.body.payment_mode);
    const notes = normalizeText(req.body.notes);

    if (!expenseDate) return res.status(400).json({ error: 'Expense date is required' });
    if (!expenseTypeId) return res.status(400).json({ error: 'Expense type is required' });
    if (!amount) return res.status(400).json({ error: 'Amount must be greater than zero' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const expenseType = await verifyExpenseType(client, expenseTypeId);
      if (!expenseType) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Active expense type not found' });
      }

      const result = await client.query(
        `UPDATE expenses
         SET expense_date = $1,
             expense_type_id = $2,
             amount = $3,
             paid_to = $4,
             paid_by = $5,
             payment_mode = $6,
             notes = $7
         WHERE expense_id = $8
         RETURNING *`,
        [expenseDate, expenseType.expense_type_id, amount, paidTo, paidBy, paymentMode, notes, expense_id]
      );

      if (!result.rows.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Expense not found' });
      }

      await client.query('COMMIT');
      res.json({
        ...result.rows[0],
        expense_type_name: expenseType.expense_type_name,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }
  });

  app.delete('/api/expenses/:expense_id', requireExpenseAccess, async (req, res) => {
    const { expense_id } = req.params;
    try {
      const result = await pool.query(
        `DELETE FROM expenses
         WHERE expense_id = $1
         RETURNING expense_id`,
        [expense_id]
      );

      if (!result.rows.length) {
        return res.status(404).json({ error: 'Expense not found' });
      }

      res.json({ message: 'Expense deleted', expense_id });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
