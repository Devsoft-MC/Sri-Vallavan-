// Modularized POST /api/collections endpoint
export function addCollectionEndpoint(app, pool) {
  app.post('/api/collections', async (req, res) => {
    const { customer_id, loan_id, collection_date, collection_amount, collection_type, collected_by_name } = req.body;
    try {
      // Get the last_number for code 'RV' from serials table
      const serialResult = await pool.query(
        `SELECT last_number FROM serials WHERE code = 'RV'`
      );
      if (serialResult.rows.length === 0) {
        return res.status(500).json({ error: "Serial code 'RV' not found" });
      }
      const lastNumber = parseInt(serialResult.rows[0].last_number, 10) || 0;
      const nextNumber = lastNumber + 1;
      const collection_id = `RV00${nextNumber.toString().padStart(4, '0')}`;


      // Fetch customer_name from customers table
      let customer_name = null;
      console.log('DEBUG: Fetching customer_name for customer_id:', customer_id);
      const customerResult = await pool.query(
        `SELECT customer_name FROM customers WHERE customer_id = $1`,
        [customer_id]
      );
      console.log('DEBUG: customerResult.rows:', customerResult.rows);
      if (customerResult.rows.length > 0) {
        customer_name = customerResult.rows[0].customer_name;
      }
      console.log('DEBUG: customer_name to insert:', customer_name);
      if (!customer_name) {
        return res.status(400).json({ error: `Customer name not found for customer_id: ${customer_id}` });
      }

      // Convert empty string for collection_amount to null
      const collectionAmountVal = collection_amount === '' ? null : collection_amount;
      // Insert the new collection with generated collection_id and customer_name
      const result = await pool.query(
        `INSERT INTO collections (collection_id, customer_id, customer_name, loan_id, collection_date, collection_amount, collection_type, collected_by_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [collection_id, customer_id, customer_name, loan_id, collection_date, collectionAmountVal, collection_type, collected_by_name]
      );

      // Update the serials table with the new last_number
      await pool.query(
        `UPDATE serials SET last_number = $1 WHERE code = 'RV'`,
        [nextNumber]
      );

      res.status(201).json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
