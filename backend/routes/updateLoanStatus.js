// POST /api/loans/status - update loan status
export function updateLoanStatusEndpoint(app, pool, requireCreateLoans = (req, res, next) => next()) {
  app.post('/api/loans/close', requireCreateLoans, async (req, res) => {
    const { loan_id, close_date, remarks } = req.body;
    if (!loan_id || !close_date) {
      return res.status(400).json({ error: 'loan_id and close_date are required' });
    }

    try {
      const result = await pool.query(
        `UPDATE loans
         SET status = $1, closing_date = $2, remarks = $3, loan_status_closed = true
         WHERE loan_id = $4
         RETURNING *`,
        ['CLOSED', close_date, remarks || null, loan_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Loan not found' });
      }

      res.json({ success: true, loan_id, loan: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: 'Database error', details: err.message });
    }
  });

  app.post('/api/loans/status', requireCreateLoans, async (req, res) => {
    const { loan_id, status, adjustment } = req.body;
    const closeDate = req.body.close_date || req.body.closing_date;
    if (!loan_id || !status) {
      return res.status(400).json({ error: 'loan_id and status are required' });
    }
    // If closing, require close_date
    if (String(status).toLowerCase() === 'closed' && (!closeDate || closeDate === '')) {
      return res.status(400).json({ error: 'close_date is required when closing a loan' });
    }
    try {
      // Convert empty string to null for numeric fields
      const adjVal = adjustment === '' ? null : adjustment;
      let query, params;
      if (status.toLowerCase() === 'closed') {
        query = 'UPDATE loans SET status = $1, adjustment = $2, loan_status_closed = true, closing_date = $3 WHERE loan_id = $4 RETURNING *';
        params = [status, adjVal, closeDate, loan_id];
      } else {
        query = 'UPDATE loans SET status = $1, adjustment = $2, loan_status_closed = false, closing_date = null WHERE loan_id = $3 RETURNING *';
        params = [status, adjVal, loan_id];
      }
      const result = await pool.query(query, params);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Loan not found' });
      }
      res.json({ success: true, loan: result.rows[0] });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
