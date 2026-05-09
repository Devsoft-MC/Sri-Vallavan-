// GET /api/loan-types - returns [{ loan_type_code, loan_type_name }]
export function loanTypesEndpoint(app, pool) {
  app.get('/api/loan-types', async (req, res) => {
    try {
      const result = await pool.query('SELECT loan_type_code, loan_type AS loan_type_name FROM loan_types ORDER BY loan_type');
      res.json(result.rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
