
import path from 'path';
import fs from 'fs';
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pkg from 'pg';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
const { Pool } = pkg;

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_change_me';
const JWT_EXPIRES_IN = '8h';

// Auth middleware
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  try {
    req.user = jwt.verify(authHeader.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

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
app.use('/favicon.ico', express.static(path.join(process.cwd(), 'favicon.ico')));
// Root route for health check or friendly message
app.get('/', (req, res) => {
  res.send('Backend is running!');
});

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: false, // Hostinger VPS usually does not require SSL for localhost/VPS connections
});

// (Removed duplicate /api/collections endpoint. Only the paginated/filtering endpoint remains below.)

import { addCollectionEndpoint } from './routes/addCollection.js';
import { addLoanEndpoint } from './routes/addLoan.js';
import { editCollectionEndpoint } from './routes/editCollection.js';
import { deleteCollectionEndpoint } from './routes/deleteCollection.js';
import { loansListEndpoint } from './routes/loansList.js';
import { loanTypesEndpoint } from './routes/loanTypes.js';
import { updateLoanStatusEndpoint } from './routes/updateLoanStatus.js';
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

// Endpoint to get payment status breakdown (On Time / Delayed / Bad)
app.get('/api/loans-payment-status', async (req, res) => {
  try {
    const result = await pool.query(`
      WITH loan_balances AS (
        SELECT
          l.loan_id,
          l.issue_date,
          l.maturity_date,
          l.closing_date,
          LOWER(COALESCE(l.status, CASE WHEN COALESCE(l.loan_status_closed, false) THEN 'closed' ELSE 'open' END)) AS loan_status,
          (COALESCE(l.issue_amount, 0) - COALESCE(SUM(c.collection_amount), 0)) AS balance_amount
        FROM loans l
        LEFT JOIN collections c ON c.loan_id = l.loan_id
        GROUP BY l.loan_id, l.issue_date, l.maturity_date, l.closing_date, l.status, l.loan_status_closed, l.issue_amount
      )
      SELECT
        CASE
          WHEN loan_status = 'closed'
            AND issue_date IS NOT NULL
            AND closing_date IS NOT NULL
            AND (closing_date - issue_date) < 115 THEN 'On Time Payment'
          WHEN loan_status = 'closed'
            AND issue_date IS NOT NULL
            AND closing_date IS NOT NULL
            AND (closing_date - issue_date) BETWEEN 115 AND 130 THEN 'Delayed Payment'
          WHEN loan_status = 'closed'
            AND issue_date IS NOT NULL
            AND closing_date IS NOT NULL
            AND (closing_date - issue_date) > 130 THEN 'Bad Payment'

          WHEN loan_status = 'open'
            AND issue_date IS NOT NULL
            AND maturity_date IS NOT NULL
            AND balance_amount = 0
            AND CURRENT_DATE <= maturity_date THEN 'On Time Payment'
          WHEN loan_status = 'open'
            AND issue_date IS NOT NULL
            AND balance_amount <> 0
            AND (CURRENT_DATE - issue_date) > 115
            AND (CURRENT_DATE - issue_date) <= 130 THEN 'Delayed Payment'
          WHEN loan_status = 'open'
            AND issue_date IS NOT NULL
            AND balance_amount <> 0
            AND (CURRENT_DATE - issue_date) > 130 THEN 'Bad Payment'
        END AS payment_status,
        COUNT(*)::int AS count
      FROM loan_balances
      GROUP BY payment_status
    `);
    const statusOrder = ['On Time Payment', 'Delayed Payment', 'Bad Payment'];
    const map = {};
    result.rows.forEach(row => { if (row.payment_status) map[row.payment_status] = parseInt(row.count, 10); });
    const statuses = statusOrder.filter(s => map[s] !== undefined);
    const counts = statuses.map(s => map[s]);
    res.json({ statuses, counts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to get open loans for a specific customer (for Add Collection form)
app.get('/api/loans-by-customer/:customer_id', async (req, res) => {
  const { customer_id } = req.params;
  try {
    const result = await pool.query(
      `SELECT
        l.loan_id,
        l.loan_type,
        l.issue_date,
        l.maturity_date,
        l.issue_amount,
        l.loan_status_closed,
        l.status,
        COALESCE(SUM(c.collection_amount), 0) AS total_collected_amount
      FROM loans l
      LEFT JOIN collections c ON c.loan_id = l.loan_id
      WHERE l.customer_id = $1
        AND COALESCE(l.loan_status_closed, false) = false
        AND LOWER(COALESCE(l.status, 'Open')) = 'open'
      GROUP BY l.loan_id, l.loan_type, l.issue_date, l.maturity_date, l.issue_amount, l.loan_status_closed, l.status
      ORDER BY l.issue_date DESC NULLS LAST, l.loan_id DESC`,
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
    const { from, to, text, collected_by, loan_id } = req.query;
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
    if (loan_id) {
      where.push(`loan_id = $${idx++}`);
      params.push(loan_id);
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
      // If any filter is applied (including loan_id), return all matching records
      // If no filter, return only latest 100 records
      limitClause = (from || to || text || collected_by || loan_id) ? '' : 'LIMIT 100';
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

// NEW ENDPOINT: Get all areas (for dropdown in customer form)
app.get('/api/areas', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT area_id, area_name FROM areas ORDER BY area_name'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/customers/next-id', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT last_number FROM serials WHERE code = 'C'`
    );

    if (!result.rows.length) {
      return res.status(500).json({ error: "Serial code 'C' not found" });
    }

    const lastNumber = parseInt(result.rows[0].last_number, 10) || 0;
    res.json({ customer_id: `C${lastNumber + 1}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATED ENDPOINT: Get all customers with area details (JOIN with areas table)
app.get('/api/customers', async (req, res) => {
  try {
    const { text } = req.query;
    let query, params = [];
    if (text && text.trim()) {
      query = `
        SELECT 
          c.*,
          COALESCE(a.area_name, c.area) AS area_name
        FROM customers c
        LEFT JOIN areas a ON c.area_id = a.area_id
        WHERE
          c.customer_id ILIKE $1 OR 
          c.customer_name ILIKE $1 OR 
          c.customer_category ILIKE $1 OR
          a.area_name ILIKE $1
        ORDER BY c.customer_name
      `;
      params = [`%${text.trim()}%`];
    } else {
      query = `
        SELECT 
          c.*,
          COALESCE(a.area_name, c.area) AS area_name
        FROM customers c
        LEFT JOIN areas a ON c.area_id = a.area_id
        ORDER BY c.customer_name
      `;
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/customers', async (req, res) => {
  const {
    customer_name,
    date_of_birth,
    mobile_number,
    area_id,
    city,
    occupation,
    customer_category,
    address,
    guarantor_name,
    customer_adhar_number,
    guarantor_adhar_number,
    notes,
  } = req.body;

  if (!customer_name || !customer_name.trim()) {
    return res.status(400).json({ error: 'Customer name is required' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const serialResult = await client.query(
      `SELECT last_number FROM serials WHERE code = 'C' FOR UPDATE`
    );

    if (!serialResult.rows.length) {
      throw new Error("Serial code 'C' not found");
    }

    const lastNumber = parseInt(serialResult.rows[0].last_number, 10) || 0;
    const nextNumber = lastNumber + 1;
    const customerId = `C${nextNumber}`;

    let areaName = null;
    if (area_id) {
      const areaResult = await client.query(
        `SELECT area_name FROM areas WHERE area_id = $1`,
        [area_id]
      );

      if (!areaResult.rows.length) {
        throw new Error('Selected area not found');
      }

      areaName = areaResult.rows[0].area_name;
    }

    await client.query(
      `INSERT INTO customers (
        customer_id,
        customer_name,
        mobile_number,
        area,
        customer_category,
        occupation,
        address,
        city,
        guarantor_name,
        notes,
        date_of_birth,
        guarantor_adhar_number,
        customer_adhar_number,
        area_id,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW()
      )`,
      [
        customerId,
        customer_name.trim(),
        mobile_number || null,
        areaName,
        customer_category || null,
        occupation || null,
        address || null,
        city || null,
        guarantor_name || null,
        notes || null,
        date_of_birth || null,
        guarantor_adhar_number || null,
        customer_adhar_number || null,
        area_id || null,
      ]
    );

    await client.query(
      `UPDATE serials SET last_number = $1 WHERE code = 'C'`,
      [nextNumber]
    );

    const result = await client.query(
      `SELECT c.*, COALESCE(a.area_name, c.area) AS area_name
       FROM customers c
       LEFT JOIN areas a ON c.area_id = a.area_id
       WHERE c.customer_id = $1`,
      [customerId]
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

// UPDATED ENDPOINT: Update customer (now uses area_id instead of area text)
app.put('/api/customers/:customer_id', async (req, res) => {
  const { customer_id } = req.params;
  const {
    customer_name,
    date_of_birth,
    mobile_number,
    area_id,
    city,
    occupation,
    customer_category,
    address,
    guarantor_name,
    customer_adhar_number,
    guarantor_adhar_number,
    notes,
  } = req.body;

  try {
    let areaName = null;
    if (area_id) {
      const areaResult = await pool.query(
        `SELECT area_name FROM areas WHERE area_id = $1`,
        [area_id]
      );

      if (!areaResult.rows.length) {
        return res.status(400).json({ error: 'Selected area not found' });
      }

      areaName = areaResult.rows[0].area_name;
    }

    await pool.query(
      `UPDATE customers
       SET customer_name = $1,
           date_of_birth = $2,
           mobile_number = $3,
           area_id = $4,
           area = $5,
           city = $6,
           occupation = $7,
           customer_category = $8,
           address = $9,
           guarantor_name = $10,
           customer_adhar_number = $11,
           guarantor_adhar_number = $12,
           notes = $13,
           updated_at = NOW()
       WHERE customer_id = $14`,
      [
        customer_name || null,
        date_of_birth || null,
        mobile_number || null,
        area_id || null,
        areaName,
        city || null,
        occupation || null,
        customer_category || null,
        address || null,
        guarantor_name || null,
        customer_adhar_number || null,
        guarantor_adhar_number || null,
        notes || null,
        customer_id,
      ]
    );

    const result = await pool.query(
      `SELECT c.*, COALESCE(a.area_name, c.area) AS area_name
       FROM customers c
       LEFT JOIN areas a ON c.area_id = a.area_id
       WHERE c.customer_id = $1`,
      [customer_id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// NEW ENDPOINT: Add area (for creating new areas)
app.post('/api/areas', async (req, res) => {
  const { area_name } = req.body;

  if (!area_name || area_name.trim() === '') {
    return res.status(400).json({ error: 'Area name is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO areas (area_name) 
       VALUES ($1)
       ON CONFLICT (area_name) DO NOTHING
       RETURNING area_id, area_name`,
      [area_name.trim()]
    );

    if (!result.rows.length) {
      return res.status(400).json({ error: 'Area already exists' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// NEW ENDPOINT: Get customers by area
app.get('/api/customers-by-area/:area_id', async (req, res) => {
  const { area_id } = req.params;

  try {
    const result = await pool.query(
      `
        SELECT 
          c.*,
          a.area_name
        FROM customers c
        LEFT JOIN areas a ON c.area_id = a.area_id
        WHERE c.area_id = $1
        ORDER BY c.customer_name
      `,
      [area_id]
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// NEW ENDPOINT: Get area statistics (for collection agent assignment)
app.get('/api/area-statistics', async (req, res) => {
  try {
    const result = await pool.query(
      `
        SELECT 
          a.area_id,
          a.area_name,
          COUNT(DISTINCT c.customer_id) as customer_count,
          COUNT(DISTINCT l.loan_id) as open_loan_count,
          SUM(CASE WHEN l.loan_status_closed = false THEN l.issue_amount ELSE 0 END) as open_loan_amount
        FROM areas a
        LEFT JOIN customers c ON a.area_id = c.area_id
        LEFT JOIN loans l ON c.customer_id = l.customer_id
        GROUP BY a.area_id, a.area_name
        ORDER BY customer_count DESC, a.area_name
      `
    );

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
      const result = await pool.query(
        `
        SELECT
          e.employee_id,
          e.employee_name,
          e.email,
          e.mobile_phone,
          e.designation,
          e.role,
          e.employment_status,
          e.can_collect,
          e.can_create_loans,
          e.can_manage_customers,
          e.created_at,
          e.updated_at,
          ea.login_email,
          ea.is_active AS login_active,
          ea.last_login_at,
          ea.password_reset_required
        FROM employees e
        LEFT JOIN employee_auth ea ON ea.employee_id = e.employee_id
        ORDER BY e.employee_id
        `
      );
      return res.json(result.rows);
    }

    const result = await pool.query('SELECT employee_name FROM employees ORDER BY employee_name');
    res.json(result.rows.map(row => row.employee_name));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to get full employee details for Employees screen
app.get('/api/employees-details', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT
        e.employee_id,
        e.employee_name,
        e.email,
        e.mobile_phone,
        e.designation,
        e.role,
        e.employment_status,
        e.can_collect,
        e.can_create_loans,
        e.can_manage_customers,
        e.created_at,
        e.updated_at,
        ea.login_email,
        ea.is_active AS login_active,
        ea.last_login_at,
        ea.password_reset_required
      FROM employees e
      LEFT JOIN employee_auth ea ON ea.employee_id = e.employee_id
      ORDER BY e.employee_id
      `
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create employee + auth login (Admin only)
app.post('/api/employees-details', requireAuth, requireRole('Admin'), async (req, res) => {
  const {
    employee_name,
    email,
    mobile_phone,
    designation,
    role,
    employment_status,
    can_collect,
    can_create_loans,
    can_manage_customers,
    login_email,
    login_active,
    password_reset_required,
    temporary_password,
  } = req.body || {};

  if (!employee_name || !email || !role || !login_email) {
    return res.status(400).json({ error: 'employee_name, email, role and login_email are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const serialResult = await client.query(
      `SELECT last_number FROM serials WHERE code = 'E' FOR UPDATE`
    );

    if (!serialResult.rows.length) {
      throw new Error("Serial code 'E' not found");
    }

    const lastNumber = parseInt(serialResult.rows[0].last_number, 10) || 0;
    const nextNumber = lastNumber + 1;
    const newEmployeeId = `E${nextNumber}`;

    const loginEmail = String(login_email).trim().toLowerCase();
    const defaultPassword = temporary_password || 'SriVallavan@123';
    const passwordHash = await bcrypt.hash(defaultPassword, 12);

    await client.query(
      `
      INSERT INTO employees (
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
        password_reset_required
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `,
      [
        newEmployeeId,
        employee_name,
        email,
        mobile_phone || null,
        designation || null,
        role,
        employment_status || 'Active',
        can_collect !== false,
        !!can_create_loans,
        !!can_manage_customers,
        password_reset_required !== false,
      ]
    );

    await client.query(
      `
      INSERT INTO employee_auth (
        login_email,
        employee_id,
        password_hash,
        is_active,
        password_reset_required,
        failed_login_count,
        locked_until
      ) VALUES ($1,$2,$3,$4,$5,0,NULL)
      `,
      [
        loginEmail,
        newEmployeeId,
        passwordHash,
        login_active !== false,
        password_reset_required !== false,
      ]
    );

    await client.query(
      `UPDATE serials SET last_number = $1 WHERE code = 'E'`,
      [nextNumber]
    );

    await client.query('COMMIT');
    res.status(201).json({ success: true, employee_id: newEmployeeId });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Employee ID, email, or login email already exists' });
    }
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Update employee fields (Admin only)
app.put('/api/employees-details/:employeeId', requireAuth, requireRole('Admin'), async (req, res) => {
  const { employeeId } = req.params;
  const {
    employee_name,
    email,
    mobile_phone,
    designation,
    role,
    employment_status,
    can_collect,
    can_create_loans,
    can_manage_customers,
    login_email,
    login_active,
    password_reset_required,
  } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `
      UPDATE employees
      SET
        employee_name = $1,
        email = $2,
        mobile_phone = $3,
        designation = $4,
        role = $5,
        employment_status = $6,
        can_collect = $7,
        can_create_loans = $8,
        can_manage_customers = $9,
        password_reset_required = $10
      WHERE employee_id = $11
      `,
      [
        employee_name,
        email,
        mobile_phone || null,
        designation || null,
        role,
        employment_status,
        !!can_collect,
        !!can_create_loans,
        !!can_manage_customers,
        !!password_reset_required,
        employeeId,
      ]
    );

    await client.query(
      `
      UPDATE employee_auth
      SET
        login_email = $1,
        is_active = $2,
        password_reset_required = $3
      WHERE employee_id = $4
      `,
      [String(login_email || email || '').trim().toLowerCase(), login_active !== false, !!password_reset_required, employeeId]
    );

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email or login email already exists' });
    }
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Deactivate employee (soft delete, Admin only)
app.delete('/api/employees-details/:employeeId', requireAuth, requireRole('Admin'), async (req, res) => {
  const { employeeId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `
      UPDATE employees
      SET employment_status = 'Inactive'
      WHERE employee_id = $1
      `,
      [employeeId]
    );
    await client.query(
      `
      UPDATE employee_auth
      SET is_active = false
      WHERE employee_id = $1
      `,
      [employeeId]
    );
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Reset employee password (Admin only)
app.post('/api/employees-details/:employeeId/reset-password', requireAuth, requireRole('Admin'), async (req, res) => {
  const { employeeId } = req.params;
  const { new_password } = req.body || {};
  const nextPassword = new_password || 'SriVallavan@123';
  if (nextPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }
  try {
    const passwordHash = await bcrypt.hash(nextPassword, 12);
    await pool.query(
      `
      UPDATE employee_auth
      SET
        password_hash = $1,
        password_reset_required = true,
        failed_login_count = 0,
        locked_until = NULL,
        last_password_changed_at = NOW()
      WHERE employee_id = $2
      `,
      [passwordHash, employeeId]
    );
    await pool.query(
      `
      UPDATE employees
      SET password_reset_required = true
      WHERE employee_id = $1
      `,
      [employeeId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;

// ── Auth ─────────────────────────────────────────────────────────────────────

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  try {
    const authRow = await pool.query(
      'SELECT * FROM employee_auth WHERE login_email = $1', [email.trim().toLowerCase()]
    );
    if (authRow.rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });
    const auth = authRow.rows[0];

    // Check lock
    if (auth.locked_until && new Date(auth.locked_until) > new Date()) {
      return res.status(403).json({ error: 'Account temporarily locked. Try again later.' });
    }

    if (!auth.is_active) return res.status(403).json({ error: 'Account is disabled' });

    const valid = await bcrypt.compare(password, auth.password_hash);
    if (!valid) {
      const newCount = auth.failed_login_count + 1;
      const lockUntil = newCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await pool.query(
        'UPDATE employee_auth SET failed_login_count=$1, locked_until=$2 WHERE login_email=$3',
        [newCount, lockUntil, auth.login_email]
      );
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Reset failed count, update last login
    await pool.query(
      'UPDATE employee_auth SET failed_login_count=0, locked_until=NULL, last_login_at=NOW() WHERE login_email=$1',
      [auth.login_email]
    );

    // Get employee info
    const empRow = await pool.query(
      'SELECT employee_id, employee_name, email, role, designation, employment_status, can_collect, can_create_loans, can_manage_customers FROM employees WHERE employee_id=$1',
      [auth.employee_id]
    );
    const emp = empRow.rows[0];

    const token = jwt.sign(
      { employee_id: emp.employee_id, email: emp.email, role: emp.role, name: emp.employee_name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      password_reset_required: auth.password_reset_required,
      employee: emp,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/login
// Compatibility endpoint for the React login screen, which submits username/password.
app.post('/api/login', async (req, res) => {
  const { username = '', password = '' } = req.body || {};
  const loginName = String(username).trim();

  if (!loginName || !password) {
    return res.status(400).json({ error: 'User name and password required' });
  }

  try {
    let emp = null;

    const adminUser = process.env.AUTH_USER || 'admin';
    const adminPassword = process.env.AUTH_PASSWORD || 'admin123';
    if (loginName === adminUser && password === adminPassword) {
      const empRow = await pool.query(
        `
        SELECT employee_id, employee_name, email, role, designation, employment_status, can_collect, can_create_loans, can_manage_customers
        FROM employees
        WHERE employee_id = COALESCE($1, employee_id)
          AND role = 'Admin'
          AND employment_status = 'Active'
        ORDER BY employee_id
        LIMIT 1
        `,
        [process.env.AUTH_EMPLOYEE_ID || null]
      );
      emp = empRow.rows[0];
    } else {
      const authRow = await pool.query(
        'SELECT * FROM employee_auth WHERE login_email = $1',
        [loginName.toLowerCase()]
      );

      if (authRow.rows.length > 0) {
        const auth = authRow.rows[0];

        if (auth.locked_until && new Date(auth.locked_until) > new Date()) {
          return res.status(403).json({ error: 'Account temporarily locked. Try again later.' });
        }

        if (!auth.is_active) return res.status(403).json({ error: 'Account is disabled' });

        const valid = await bcrypt.compare(password, auth.password_hash);
        if (!valid) {
          const newCount = auth.failed_login_count + 1;
          const lockUntil = newCount >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
          await pool.query(
            'UPDATE employee_auth SET failed_login_count=$1, locked_until=$2 WHERE login_email=$3',
            [newCount, lockUntil, auth.login_email]
          );
          return res.status(401).json({ error: 'Invalid user name or password' });
        }

        await pool.query(
          'UPDATE employee_auth SET failed_login_count=0, locked_until=NULL, last_login_at=NOW() WHERE login_email=$1',
          [auth.login_email]
        );

        const empRow = await pool.query(
          'SELECT employee_id, employee_name, email, role, designation, employment_status, can_collect, can_create_loans, can_manage_customers FROM employees WHERE employee_id=$1',
          [auth.employee_id]
        );
        emp = empRow.rows[0];
      }
    }

    if (!emp) return res.status(401).json({ error: 'Invalid user name or password' });

    const token = jwt.sign(
      { employee_id: emp.employee_id, email: emp.email, role: emp.role, name: emp.employee_name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        username: loginName,
        employee_id: emp.employee_id,
        name: emp.employee_name,
        role: emp.role,
      },
      employee: emp,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me  (validate token & return current user)
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const empRow = await pool.query(
      'SELECT employee_id, employee_name, email, role, designation, employment_status, can_collect, can_create_loans, can_manage_customers FROM employees WHERE employee_id=$1',
      [req.user.employee_id]
    );
    if (empRow.rows.length === 0) return res.status(404).json({ error: 'Employee not found' });
    res.json({ employee: empRow.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/change-password
app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) return res.status(400).json({ error: 'Both fields required' });
  if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
  try {
    const authRow = await pool.query('SELECT * FROM employee_auth WHERE employee_id=$1', [req.user.employee_id]);
    if (authRow.rows.length === 0) return res.status(404).json({ error: 'Auth record not found' });
    const valid = await bcrypt.compare(current_password, authRow.rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    const newHash = await bcrypt.hash(new_password, 12);
    await pool.query(
      'UPDATE employee_auth SET password_hash=$1, password_reset_required=false, last_password_changed_at=NOW() WHERE employee_id=$2',
      [newHash, req.user.employee_id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────

// ── Customer Documents ────────────────────────────────────────────────────────
const UPLOADS_DIR = path.join(process.cwd(), 'uploads', 'customers');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(UPLOADS_DIR, req.params.customerId);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.docType}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error('Only PDF and image files are allowed'), false);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// GET /api/customers/:customerId/documents
app.get('/api/customers/:customerId/documents', async (req, res) => {
  try {
    const { customerId } = req.params;
    const result = await pool.query(
      'SELECT doc_type, file_name, file_path, uploaded_at FROM customer_documents WHERE customer_id = $1',
      [customerId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers/:customerId/documents/:docType
app.post('/api/customers/:customerId/documents/:docType', (req, res) => {
  const { customerId, docType } = req.params;
  const validTypes = ['customer_adhar', 'guarantor_adhar', 'customer_photo'];
  if (!validTypes.includes(docType)) {
    return res.status(400).json({ error: 'Invalid document type' });
  }
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = `/uploads/customers/${customerId}/${req.file.filename}`;
    try {
      await pool.query(
        `INSERT INTO customer_documents (customer_id, doc_type, file_name, file_path)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (customer_id, doc_type) DO UPDATE SET file_name=$3, file_path=$4, uploaded_at=NOW()`,
        [customerId, docType, req.file.originalname, filePath]
      );
      res.json({ success: true, file_path: filePath, file_name: req.file.originalname });
    } catch (dbErr) {
      res.status(500).json({ error: dbErr.message });
    }
  });
});

// DELETE /api/customers/:customerId/documents/:docType
app.delete('/api/customers/:customerId/documents/:docType', async (req, res) => {
  try {
    const { customerId, docType } = req.params;
    const result = await pool.query(
      'DELETE FROM customer_documents WHERE customer_id=$1 AND doc_type=$2 RETURNING file_path',
      [customerId, docType]
    );
    if (result.rows.length > 0) {
      const absPath = path.join(process.cwd(), result.rows[0].file_path);
      if (fs.existsSync(absPath)) fs.unlinkSync(absPath);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// ─────────────────────────────────────────────────────────────────────────────

const startServer = (port) => {
  const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      const nextPort = Number(port) + 1;
      console.warn(`Port ${port} is in use, retrying on ${nextPort}...`);
      startServer(nextPort);
      return;
    }
    throw err;
  });
};

startServer(PORT);

app.get('/api/customer-categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT name FROM customercategory ORDER BY name');
    console.log('DEBUG categories:', result.rows);
    res.json(result.rows.map(row => row.name));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
