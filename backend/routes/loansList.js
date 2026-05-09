
// Modularized GET /api/loans endpoint (loans list)
export function loansListEndpoint(app, pool) {
  app.get('/api/loans', async (req, res) => {
    try {
     // Optionally support text filter via query param
     const { text } = req.query;
     let query = `
       SELECT l.loan_id, l.customer_id, c.customer_name, l.loan_type, l.issue_date, l.maturity_date, l.close_date AS closing_date, l.issue_amount, l.interest_received, l.adjustment, l.status
       FROM loans l
       LEFT JOIN customers c ON l.customer_id = c.customer_id
     `;
    const params = [];
     if (text) {
       query += ` WHERE l.loan_id ILIKE $1 OR l.customer_id ILIKE $1 OR c.customer_name ILIKE $1 OR l.loan_type ILIKE $1`;
       params.push(`%${text}%`);
      }
      query += ' ORDER BY l.loan_id DESC';
      const result = await pool.query(query, params);
      res.json(result.rows);
      } catch (err) {
     res.status(500).json({ error: err.message });
    }
  });
}
