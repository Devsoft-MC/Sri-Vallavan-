import React, { useEffect, useMemo, useState } from 'react';
import API_BASE_URL from '../../api';

const today = new Date().toISOString().slice(0, 10);

const statusOptions = ['All', 'Good', 'Monitor', 'Need Review'];

const columns = [
  { key: 'sl_no', label: 'Sl.No' },
  { key: 'customer_id', label: 'Customer ID' },
  { key: 'customer_name', label: 'Customer Name' },
  { key: 'mobile_number', label: 'Mobile Number' },
  { key: 'area', label: 'Area' },
  { key: 'total_loans', label: 'Total Loans', numeric: true },
  { key: 'active_loans', label: 'Active Loans', numeric: true },
  { key: 'overdue_active_loans', label: 'Overdue Active', numeric: true },
  { key: 'closed_loans', label: 'Closed Loans', numeric: true },
  { key: 'total_issued', label: 'Issued Amount', amount: true },
  { key: 'total_collected', label: 'Collected Amount', amount: true },
  { key: 'balance_amount', label: 'Balance Amount', amount: true },
  { key: 'repayment_percent', label: 'Repayment %', percent: true },
  { key: 'status', label: 'Status' },
];

function normalizeDate(value) {
  return value ? String(value).slice(0, 10) : '';
}

function parseDate(value) {
  const date = normalizeDate(value);
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function daysBetween(start, end) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) return null;
  return Math.round((endDate - startDate) / 86400000);
}

function toAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function formatAmount(value) {
  return toAmount(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatPercent(value) {
  return `${toAmount(value).toFixed(1)}%`;
}

function isClosedLoan(loan) {
  return String(loan.status || '').toLowerCase() === 'closed'
    || loan.loan_status_closed === true
    || loan.loan_status_closed === 'true';
}

function getClosingDate(loan) {
  return normalizeDate(loan.closing_date || loan.close_date);
}

function getLoanResult({ closed, maturityDate, closingDate, balanceAmount }) {
  if (closed) {
    const varianceDays = daysBetween(maturityDate, closingDate);
    if (varianceDays === null) return 'Closed';
    return varianceDays <= 0 ? 'Closed On/Before Maturity' : 'Closed After Maturity';
  }

  if (maturityDate && maturityDate < today && balanceAmount > 0) return 'Active Overdue';
  return 'Active';
}

function getCustomerStatus(row) {
  if (row.total_loans === 0) return 'Monitor';
  if (row.closed_loans === 0) return row.overdue_active_loans > 0 ? 'Need Review' : 'Monitor';
  if (row.on_time_closures === row.closed_loans) return 'Good';
  if (row.late_closures === row.closed_loans) return 'Need Review';
  return 'Monitor';
}

function formatCell(row, column) {
  const value = row[column.key];
  if (column.amount) return formatAmount(value);
  if (column.percent) return formatPercent(value);
  if (column.numeric) return toAmount(value).toLocaleString();
  return value || '';
}

const CustomerStatusReport = () => {
  const [customers, setCustomers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [collections, setCollections] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadReportData() {
      setLoading(true);
      setError('');

      try {
        const [customersRes, loansRes, collectionsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/customers`),
          fetch(`${API_BASE_URL}/api/loans`),
          fetch(`${API_BASE_URL}/api/collections?text=%25`),
        ]);

        if (!customersRes.ok || !loansRes.ok || !collectionsRes.ok) {
          throw new Error('Unable to load customer status report.');
        }

        const [customerData, loanData, collectionData] = await Promise.all([
          customersRes.json(),
          loansRes.json(),
          collectionsRes.json(),
        ]);

        if (!cancelled) {
          setCustomers(Array.isArray(customerData) ? customerData : []);
          setLoans(Array.isArray(loanData) ? loanData : []);
          setCollections(Array.isArray(collectionData) ? collectionData : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to load customer status report.');
          setCustomers([]);
          setLoans([]);
          setCollections([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReportData();
    return () => {
      cancelled = true;
    };
  }, []);

  const reportRows = useMemo(() => {
    const customerMap = new Map(customers.map(customer => [customer.customer_id, customer]));
    const collectedByLoan = collections.reduce((map, collection) => {
      const loanId = String(collection.loan_id || '').trim();
      if (!loanId) return map;
      map.set(loanId, (map.get(loanId) || 0) + toAmount(collection.collection_amount));
      return map;
    }, new Map());

    const grouped = new Map();

    customers.forEach(customer => {
      grouped.set(customer.customer_id, {
        customer_id: customer.customer_id,
        customer_name: customer.customer_name || '',
        mobile_number: customer.mobile_number || '',
        area: customer.area_name || customer.area || '',
        total_loans: 0,
        closed_loans: 0,
        on_time_closures: 0,
        late_closures: 0,
        active_loans: 0,
        overdue_active_loans: 0,
        total_issued: 0,
        total_collected: 0,
        balance_amount: 0,
      });
    });

    loans.forEach(loan => {
      const customer = customerMap.get(loan.customer_id) || {};
      if (!grouped.has(loan.customer_id)) {
        grouped.set(loan.customer_id, {
          customer_id: loan.customer_id,
          customer_name: loan.customer_name || '',
          mobile_number: customer.mobile_number || '',
          area: customer.area_name || customer.area || '',
          total_loans: 0,
          closed_loans: 0,
          on_time_closures: 0,
          late_closures: 0,
          active_loans: 0,
          overdue_active_loans: 0,
          total_issued: 0,
          total_collected: 0,
          balance_amount: 0,
        });
      }

      const row = grouped.get(loan.customer_id);
      row.customer_name = row.customer_name || loan.customer_name || customer.customer_name || '';
      row.mobile_number = row.mobile_number || customer.mobile_number || '';
      row.area = row.area || customer.area_name || customer.area || '';

      const issuedAmount = toAmount(loan.issue_amount);
      const collectedAmount = collectedByLoan.get(String(loan.loan_id || '').trim()) || 0;
      const balanceAmount = issuedAmount - collectedAmount;
      const closed = isClosedLoan(loan);
      const closingDate = getClosingDate(loan);
      const maturityDate = normalizeDate(loan.maturity_date);
      const loanResult = getLoanResult({ closed, maturityDate, closingDate, balanceAmount });

      row.total_loans += 1;
      row.total_issued += issuedAmount;
      row.total_collected += collectedAmount;
      row.balance_amount += balanceAmount;

      if (closed) {
        row.closed_loans += 1;
        const varianceDays = daysBetween(maturityDate, closingDate);
        if (varianceDays !== null && varianceDays <= 0) row.on_time_closures += 1;
        if (varianceDays !== null && varianceDays > 0) row.late_closures += 1;
      } else {
        row.active_loans += 1;
        if (loanResult === 'Active Overdue') row.overdue_active_loans += 1;
      }
    });

    return Array.from(grouped.values())
      .map(row => ({
        ...row,
        repayment_percent: row.total_issued > 0
          ? Math.min(100, (row.total_collected / row.total_issued) * 100)
          : 0,
        status: getCustomerStatus(row),
      }))
      .sort((a, b) => {
        const statusOrder = { 'Need Review': 0, Monitor: 1, Good: 2 };
        const statusCompare = statusOrder[a.status] - statusOrder[b.status];
        if (statusCompare !== 0) return statusCompare;
        return String(a.customer_name || '').localeCompare(String(b.customer_name || ''));
      });
  }, [collections, customers, loans]);

  const filteredRows = useMemo(() => {
    const searchText = search.trim().toLowerCase();
    return reportRows
      .filter(row => statusFilter === 'All' || row.status === statusFilter)
      .filter(row => !searchText || [
        row.customer_id,
        row.customer_name,
        row.mobile_number,
        row.area,
        row.status,
      ].some(value => String(value || '').toLowerCase().includes(searchText)))
      .map((row, index) => ({ ...row, sl_no: index + 1 }));
  }, [reportRows, search, statusFilter]);

  const statusCounts = useMemo(() => (
    reportRows.reduce((counts, row) => {
      counts[row.status] = (counts[row.status] || 0) + 1;
      return counts;
    }, { Good: 0, Monitor: 0, 'Need Review': 0 })
  ), [reportRows]);

  return (
    <div>
      <h2 style={{ color: 'navy', margin: '0 0 18px' }}>Customer Status</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(130px, 1fr))', gap: 12, marginBottom: 18 }}>
        <SummaryCard label="Total Customers" value={reportRows.length.toLocaleString()} />
        <SummaryCard label="Good" value={statusCounts.Good.toLocaleString()} />
        <SummaryCard label="Monitor" value={statusCounts.Monitor.toLocaleString()} />
        <SummaryCard label="Need Review" value={statusCounts['Need Review'].toLocaleString()} />
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 18 }}>
        <label style={{ fontSize: 13, color: '#444' }}>
          Search
          <input
            type="text"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Customer, mobile, area..."
            style={{ display: 'block', marginTop: 4, padding: 7, fontSize: 13, width: 260 }}
          />
        </label>
        <label style={{ fontSize: 13, color: '#444' }}>
          Status
          <select
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value)}
            style={{ display: 'block', marginTop: 4, padding: 7, fontSize: 13, width: 170 }}
          >
            {statusOptions.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => {
            setSearch('');
            setStatusFilter('All');
          }}
          style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #cfd6e2', borderRadius: 4, background: '#fff', color: '#344054', cursor: 'pointer' }}
        >
          Clear
        </button>
      </div>

      {error && <div style={{ color: '#b00020', marginBottom: 12 }}>{error}</div>}

      <div className="desktop-table-wrap" style={{ overflowX: 'auto', background: '#fff', boxShadow: '0 1px 4px #eee' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1280 }}>
          <thead>
            <tr>
              {columns.map(column => (
                <th key={column.key} style={{ padding: '8px 6px', borderBottom: '1px solid #ccc', textAlign: column.numeric || column.amount || column.percent ? 'right' : 'left', background: '#fafbfc', whiteSpace: 'nowrap' }}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length} style={{ padding: 12 }}>Loading...</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={columns.length} style={{ padding: 12 }}>No customers found.</td></tr>
            ) : filteredRows.map(row => (
              <tr key={row.customer_id}>
                {columns.map(column => (
                  <td key={column.key} style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: column.numeric || column.amount || column.percent ? 'right' : 'left' }}>
                    {formatCell(row, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-card-list">
        {loading ? (
          <div className="mobile-record-card">Loading...</div>
        ) : filteredRows.length === 0 ? (
          <div className="mobile-record-card">No customers found.</div>
        ) : filteredRows.map(row => (
          <div className="mobile-record-card" key={row.customer_id}>
            <div className="mobile-card-title">
              <div>
                {row.customer_name || 'Customer'}
                <div className="mobile-card-subtitle">{row.customer_id} · {row.mobile_number || ''}</div>
              </div>
              <span className="mobile-badge">{row.status}</span>
            </div>
            <div className="mobile-card-grid">
              <div className="mobile-card-field">
                <span className="mobile-card-label">Total Loans</span>
                <span className="mobile-card-value">{row.total_loans}</span>
              </div>
              <div className="mobile-card-field">
                <span className="mobile-card-label">Active</span>
                <span className="mobile-card-value">{row.active_loans}</span>
              </div>
              <div className="mobile-card-field">
                <span className="mobile-card-label">Overdue</span>
                <span className="mobile-card-value">{row.overdue_active_loans}</span>
              </div>
              <div className="mobile-card-field">
                <span className="mobile-card-label">Repayment</span>
                <span className="mobile-card-value">{formatPercent(row.repayment_percent)}</span>
              </div>
              <div className="mobile-card-field full">
                <span className="mobile-card-label">Balance</span>
                <span className="mobile-card-value">{formatAmount(row.balance_amount)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value }) => (
  <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: 6, padding: 14 }}>
    <div style={{ fontSize: 12, color: '#667085', marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: '#1f2937' }}>{value}</div>
  </div>
);

export default CustomerStatusReport;
