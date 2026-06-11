
// Modularized GET /api/loans endpoint (loans list)
export function loansListEndpoint(app, pool) {
  app.get('/api/loans', async (req, res) => {
    try {
     // Optionally support text filter via query param
     const { text } = req.query;
     let query = `
       SELECT
         l.loan_id,
         l.customer_id,
         cust.customer_name,
         cust.mobile_number,
         l.loan_type,
         l.issue_date,
         l.maturity_date,
         l.closing_date,
         l.issue_amount,
         l.adjustment,
         l.status,
         l.loan_status_closed,
         COALESCE(SUM(col.collection_amount), 0) AS collected_amount,
         (COALESCE(l.issue_amount, 0) - COALESCE(SUM(col.collection_amount), 0)) AS balance_amount
       FROM loans l
       LEFT JOIN customers cust ON l.customer_id = cust.customer_id
       LEFT JOIN collections col ON col.loan_id = l.loan_id
     `;
    const params = [];
     if (text) {
       query += ` WHERE l.loan_id ILIKE $1 OR l.customer_id ILIKE $1 OR cust.customer_name ILIKE $1 OR l.loan_type ILIKE $1`;
       params.push(`%${text}%`);
      }
      query += ' GROUP BY l.loan_id, l.customer_id, cust.customer_name, cust.mobile_number, l.loan_type, l.issue_date, l.maturity_date, l.closing_date, l.issue_amount, l.adjustment, l.status, l.loan_status_closed';
      query += ' ORDER BY l.loan_id DESC';
      const result = await pool.query(query, params);
      res.json(result.rows);
      } catch (err) {
     res.status(500).json({ error: err.message });
    }
  });
}
