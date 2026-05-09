// Modularized PUT /api/collections/:collection_id endpoint for editing a collection
export function editCollectionEndpoint(app, pool) {
  app.put('/api/collections/:collection_id', async (req, res) => {
    const { collection_id } = req.params;
    const { customer_id, loan_id, collection_date, collection_amount, collection_type, collected_by_name } = req.body;
    try {
      // Fetch customer_name from customers table
      let customer_name = null;
      const customerResult = await pool.query(
        `SELECT customer_name FROM customers WHERE customer_id = $1`,
        [customer_id]
      );
      if (customerResult.rows.length > 0) {
        customer_name = customerResult.rows[0].customer_name;
      }
      if (!customer_name) {
        return res.status(400).json({ error: `Customer name not found for customer_id: ${customer_id}` });
      }
      // Convert empty string for collection_amount to null
      const collectionAmountVal = collection_amount === '' ? null : collection_amount;
      // Update the collection
      const result = await pool.query(
        `UPDATE collections SET customer_id = $1, customer_name = $2, loan_id = $3, collection_date = $4, collection_amount = $5, collection_type = $6, collected_by_name = $7 WHERE collection_id = $8 RETURNING *`,
        [customer_id, customer_name, loan_id, collection_date, collectionAmountVal, collection_type, collected_by_name, collection_id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Collection not found' });
      }
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
