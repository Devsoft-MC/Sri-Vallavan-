import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pkg from 'pg';
const { Pool } = pkg;

const app = express();
app.use(cors({
  origin: [
    'https://sahiproducts.com',
    'https://www.sahiproducts.com',
    'http://localhost:3000'
  ],
  credentials: true
}));
app.use(express.json());

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: false, // Hostinger VPS usually does not require SSL for localhost/VPS connections
});

// Endpoint to get all unique customer categories
app.get('/api/customer-categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT name FROM customercategory ORDER BY name');
    console.log('DEBUG /api/customer-categories result:', result.rows);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to get all areas
app.get('/api/areas', async (req, res) => {
  try {
    const result = await pool.query('SELECT area_name FROM areas ORDER BY area_name');
    console.log('DEBUG /api/areas result.rows:', result.rows);
    res.json(result.rows);
  } catch (err) {
    console.error('DEBUG /api/areas error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to get all collections (no filters, no limit)
app.get('/api/collections/all', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT collection_id, customer_id, customer_name, loan_id, collection_date, collection_amount, collection_type, collected_by_name
      FROM collections
      ORDER BY collection_date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// (Removed duplicate /api/collections endpoint. Only the paginated/filtering endpoint remains below.)

import { addCollectionEndpoint } from './routes/addCollection.js';
import { addLoanEndpoint } from './routes/addLoan.js';
import { editCollectionEndpoint } from './routes/editCollection.js';
import { deleteCollectionEndpoint } from './routes/deleteCollection.js';
import { loansListEndpoint } from './routes/loansList.js';
import { loanTypesEndpoint } from './routes/loanTypes.js';
import { updateLoanStatusEndpoint } from './routes/updateLoanStatus.js';

// Add New Customer endpoint with serial logic
app.post('/api/customers', async (req, res) => {
  console.log('DEBUG new customer req.body:', req.body);
  const { customer_name, date_of_birth, mobile_number, area, occupation, customer_category, city } = req.body;
  console.log('DEBUG extracted area:', area);
  try {
    // Get last_number for code 'C' from serials table
    const serialResult = await pool.query(
      `SELECT last_number FROM serials WHERE code = 'C'`
    );
    if (serialResult.rows.length === 0) {
      return res.status(500).json({ error: "Serial code 'C' not found" });
    }
    const lastNumber = parseInt(serialResult.rows[0].last_number, 10) || 0;
    const nextNumber = lastNumber + 1;
    const customer_id = `C${nextNumber}`;

    // Debug log before insert
    console.log('Inserting customer:', { customer_id, customer_name, date_of_birth, mobile_number, area, occupation, customer_category, city });
    // Insert new customer
    const insertResult = await pool.query(
      `INSERT INTO customers (customer_id, customer_name, date_of_birth, mobile_number, area, occupation, customer_category, city)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [customer_id, customer_name, date_of_birth, mobile_number, area, occupation, customer_category, city]
    );

    // Update serials table
    await pool.query(
      `UPDATE serials SET last_number = $1 WHERE code = 'C'`,
      [nextNumber]
    );

    res.status(201).json(insertResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Register the addCollection, editCollection, and deleteCollection endpoints after app and pool are initialized
addCollectionEndpoint(app, pool);
addLoanEndpoint(app, pool);
editCollectionEndpoint(app, pool);
deleteCollectionEndpoint(app, pool);
loansListEndpoint(app, pool);
loanTypesEndpoint(app, pool);
updateLoanStatusEndpoint(app, pool);

app.get('/api/loans-by-type', async (req, res) => {
  try {
    const result = await pool.query("SELECT loan_type, COUNT(*) as loan_count FROM loans WHERE loan_type <> 'PL' AND loan_status_closed = false GROUP BY loan_type");
    const types = result.rows.map(row => row.loan_type);
    const counts = result.rows.map(row => parseInt(row.loan_count, 10));
    res.json({ types, counts });
  } catch (err) {
    console.error('Error in /api/collections:', err);
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to get open loans for a specific customer (for Add Collection form)
app.get('/api/loans-by-customer/:customer_id', async (req, res) => {
  const { customer_id } = req.params;
  try {
    const result = await pool.query(
      "SELECT loan_id, loan_type FROM loans WHERE customer_id = $1 AND loan_status_closed = false",
      [customer_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint for customer count by category
app.get('/api/customers-by-category', async (req, res) => {
  try {
    const result = await pool.query("SELECT customer_category, COUNT(*) as customer_count FROM customers GROUP BY customer_category");
    const categories = result.rows.map(row => row.customer_category);
    const counts = result.rows.map(row => parseInt(row.customer_count, 10));
    res.json({ categories, counts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint for total loans issued amount in last 6 months (by month)
app.get('/api/loans-issued-last-6-months', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT TO_CHAR(DATE_TRUNC('month', issue_date), 'YYYY-MM') AS month,
             SUM(issue_amount) AS total_amount
      FROM loans
      WHERE issue_date >= (CURRENT_DATE - INTERVAL '6 months')
      GROUP BY month
      ORDER BY month
    `);
    // Always return last 6 months in 'YYYY-MM' format
    const now = new Date();
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(d.toISOString().slice(0, 7));
    }
    const dataMap = {};
    result.rows.forEach(row => { dataMap[row.month] = parseFloat(row.total_amount); });
    const amounts = months.map(m => dataMap[m] || 0);
    res.json({ months, amounts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ time: result.rows[0].now });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint for fetching latest 100 collections or filtered collections
app.get('/api/collections', async (req, res) => {
  try {
    const { from, to, text, collected_by } = req.query;
    let where = [];
    let params = [];
    let idx = 1;
    if (from) {
      where.push(`collection_date >= $${idx++}`);
      params.push(from);
    }
    if (to) {
      where.push(`collection_date <= $${idx++}`);
      params.push(to);
    }
    if (text) {
      where.push(`(
        collection_id ILIKE $${idx} OR
        customer_id ILIKE $${idx} OR
        customer_name ILIKE $${idx} OR
        loan_id ILIKE $${idx} OR
        collection_type ILIKE $${idx} OR
        collected_by_name ILIKE $${idx}
      )`);
      params.push(`%${text}%`);
      idx++;
    }
    if (collected_by) {
      where.push(`collected_by_name = $${idx++}`);
      params.push(collected_by);
    }
    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
    // Special case: if text === '%', treat as request for all records (no limit, no filter)
    let limitClause = '';
    let finalWhereClause = whereClause;
    if (text === '%') {
      // Remove all filters and params for full export
      finalWhereClause = '';
      limitClause = '';
      params = [];
    } else {
      // If any filter is applied, return all matching records
      // If no filter, return only latest 100 records
      limitClause = (from || to || text || collected_by) ? '' : 'LIMIT 100';
    }
    const query = `
      SELECT collection_id, customer_id, customer_name, loan_id, collection_date, collection_amount, collection_type, collected_by_name
      FROM collections
      ${finalWhereClause}
      ORDER BY collection_date DESC
      ${limitClause}
    `;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to get all customers (for Add Collection form)
app.get('/api/customers', async (req, res) => {
  try {
    const result = await pool.query('SELECT customer_id, customer_name, date_of_birth, mobile_number, area, occupation, customer_category, city FROM customers ORDER BY customer_name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to get all collection types (for Add Collection form)
app.get('/api/collection-types', async (req, res) => {
  try {
    const result = await pool.query('SELECT collection_type FROM collection_types');
    res.json(result.rows.map(row => row.collection_type));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to get employee names, or full employee details with ?details=1
app.get('/api/employees', async (req, res) => {
  try {
    if (req.query.details === '1') {
      const result = await pool.query(`
        SELECT
          employee_id,
          employee_name,
          email,
          mobile_phone,
          designation,
          role,
          employment_status,
          can_collect,
          can_create_loans,
          can_manage_customers,
          password_reset_required,
          created_at,
          updated_at
        FROM employees
        ORDER BY employee_name
      `);
      return res.json(result.rows);
    }

    const result = await pool.query(`
      SELECT employee_name
      FROM employees
      ORDER BY employee_name
    `);
    res.json(result.rows.map(row => row.employee_name));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Simple test route to verify server is running
app.get('/ping', (req, res) => {
  res.send('pong');
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
