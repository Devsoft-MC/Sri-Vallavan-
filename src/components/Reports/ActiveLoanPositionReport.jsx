import React, { useEffect, useMemo, useState } from 'react';
import API_BASE_URL from '../../api';

const today = new Date().toISOString().slice(0, 10);

const columns = [
  { key: 'loan_id', label: 'Loan No' },
  { key: 'customer_id', label: 'Customer ID' },
  { key: 'customer_name', label: 'Customer Name' },
  { key: 'mobile_number', label: 'Mobile Number' },
  { key: 'area', label: 'Area' },
  { key: 'loan_type', label: 'Loan Type' },
  { key: 'issue_date', label: 'Issue Date' },
  { key: 'maturity_date', label: 'Maturity Date' },
  { key: 'issue_amount', label: 'Issue Amount', numeric: true },
  { key: 'collected_amount', label: 'Collected As On Date', numeric: true },
  { key: 'balance_amount', label: 'Balance Amount', numeric: true },
];

function normalizeDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
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

function formatDate(value) {
  const date = normalizeDate(value);
  if (!date) return '';
  const [year, month, day] = date.split('-');
  return `${day}-${month}-${year}`;
}

function isLoanActiveAsOn(loan, asOnDate) {
  const issueDate = normalizeDate(loan.issue_date);
  const closingDate = normalizeDate(loan.closing_date || loan.close_date);
  const status = String(loan.status || '').toLowerCase();

  if (!issueDate || issueDate > asOnDate) return false;
  if (closingDate) return closingDate > asOnDate;

  return status !== 'closed' && loan.loan_status_closed !== true;
}

const ActiveLoanPositionReport = () => {
  const [asOnDate, setAsOnDate] = useState(today);
  const [loans, setLoans] = useState([]);
  const [collections, setCollections] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [area, setArea] = useState('');
  const [loanType, setLoanType] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadReportData() {
      setLoading(true);
      setError('');

      try {
        const [loansRes, collectionsRes, customersRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/loans`),
          fetch(`${API_BASE_URL}/api/collections?to=${encodeURIComponent(asOnDate)}`),
          fetch(`${API_BASE_URL}/api/customers`),
        ]);

        if (!loansRes.ok || !collectionsRes.ok || !customersRes.ok) {
          throw new Error('Unable to load report data.');
        }

        const [loansData, collectionsData, customersData] = await Promise.all([
          loansRes.json(),
          collectionsRes.json(),
          customersRes.json(),
        ]);

        if (!cancelled) {
          setLoans(Array.isArray(loansData) ? loansData : []);
          setCollections(Array.isArray(collectionsData) ? collectionsData : []);
          setCustomers(Array.isArray(customersData) ? customersData : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to load report data.');
          setLoans([]);
          setCollections([]);
          setCustomers([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReportData();
    return () => {
      cancelled = true;
    };
  }, [asOnDate]);

  const reportRows = useMemo(() => {
    const customerMap = new Map(customers.map(customer => [customer.customer_id, customer]));
    const collectedByLoan = collections.reduce((map, collection) => {
      const collectionDate = normalizeDate(collection.collection_date);
      if (collectionDate && collectionDate <= asOnDate) {
        const currentAmount = map.get(collection.loan_id) || 0;
        map.set(collection.loan_id, currentAmount + toAmount(collection.collection_amount));
      }
      return map;
    }, new Map());

    return loans
      .filter(loan => isLoanActiveAsOn(loan, asOnDate))
      .map(loan => {
        const customer = customerMap.get(loan.customer_id) || {};
        const issuedAmount = toAmount(loan.issue_amount);
        const collectedAmount = collectedByLoan.get(loan.loan_id) || 0;
        const maturityDate = normalizeDate(loan.maturity_date);

        return {
          loan_id: loan.loan_id,
          customer_id: loan.customer_id,
          customer_name: loan.customer_name || customer.customer_name || '',
          mobile_number: customer.mobile_number || '',
          area: customer.area_name || customer.area || '',
          loan_type: loan.loan_type || '',
          issue_date: normalizeDate(loan.issue_date),
          maturity_date: maturityDate,
          issue_amount: issuedAmount,
          collected_amount: collectedAmount,
          balance_amount: issuedAmount - collectedAmount,
        };
      });
  }, [asOnDate, collections, customers, loans]);

  const areas = useMemo(
    () => [...new Set(reportRows.map(row => row.area).filter(Boolean))].sort(),
    [reportRows]
  );

  const loanTypes = useMemo(
    () => [...new Set(reportRows.map(row => row.loan_type).filter(Boolean))].sort(),
    [reportRows]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return reportRows.filter(row => {
      const matchesSearch = !query || [
        row.loan_id,
        row.customer_id,
        row.customer_name,
        row.mobile_number,
        row.area,
        row.loan_type,
      ].some(value => String(value || '').toLowerCase().includes(query));

      return matchesSearch
        && (!area || row.area === area)
        && (!loanType || row.loan_type === loanType);
    });
  }, [area, loanType, reportRows, search]);

  const totals = useMemo(() => filteredRows.reduce((acc, row) => ({
    activeLoans: acc.activeLoans + 1,
    issued: acc.issued + row.issue_amount,
    collected: acc.collected + row.collected_amount,
    balance: acc.balance + row.balance_amount,
  }), { activeLoans: 0, issued: 0, collected: 0, balance: 0 }), [filteredRows]);

  const clearFilters = () => {
    setAsOnDate(today);
    setSearch('');
    setArea('');
    setLoanType('');
  };

  return (
    <div>
      <h2 style={{ color: 'navy', margin: '0 0 18px' }}>Active Loan Position As On Date</h2>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 18 }}>
        <label style={{ fontSize: 13, color: '#444' }}>
          As On Date
          <input
            type="date"
            value={asOnDate}
            onChange={event => setAsOnDate(event.target.value)}
            style={{ display: 'block', marginTop: 4, padding: 7, fontSize: 13 }}
          />
        </label>
        <label style={{ fontSize: 13, color: '#444' }}>
          Search
          <input
            type="text"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Loan, customer, mobile..."
            style={{ display: 'block', marginTop: 4, padding: 7, fontSize: 13, width: 220 }}
          />
        </label>
        <label style={{ fontSize: 13, color: '#444' }}>
          Area
          <select value={area} onChange={event => setArea(event.target.value)} style={{ display: 'block', marginTop: 4, padding: 7, fontSize: 13, width: 170 }}>
            <option value="">All Areas</option>
            {areas.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13, color: '#444' }}>
          Loan Type
          <select value={loanType} onChange={event => setLoanType(event.target.value)} style={{ display: 'block', marginTop: 4, padding: 7, fontSize: 13, width: 150 }}>
            <option value="">All Types</option>
            {loanTypes.map(value => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={clearFilters}
          style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #cfd6e2', borderRadius: 4, background: '#fff', color: '#344054', cursor: 'pointer' }}
        >
          Clear
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
        <SummaryCard label="Active Loans" value={totals.activeLoans.toLocaleString()} />
        <SummaryCard label="Total Issued Amount" value={formatAmount(totals.issued)} />
        <SummaryCard label="Total Collected Amount" value={formatAmount(totals.collected)} />
        <SummaryCard label="Balance Amount" value={formatAmount(totals.balance)} />
      </div>

      {error && <div style={{ color: '#b00020', marginBottom: 12 }}>{error}</div>}

      <div style={{ overflowX: 'auto', background: '#fff', boxShadow: '0 1px 4px #eee' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1180 }}>
          <thead>
            <tr>
              {columns.map(column => (
                <th key={column.key} style={{ padding: '8px 6px', borderBottom: '1px solid #ccc', textAlign: column.numeric ? 'right' : 'left', background: '#fafbfc', position: 'sticky', top: 0 }}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length} style={{ padding: 12 }}>Loading...</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={columns.length} style={{ padding: 12 }}>No active loans found for the selected date.</td></tr>
            ) : filteredRows.map(row => (
              <tr key={row.loan_id}>
                {columns.map(column => {
                  const rawValue = row[column.key];
                  const value = column.numeric
                    ? formatAmount(rawValue)
                    : column.key.includes('date')
                      ? formatDate(rawValue)
                      : rawValue;

                  return (
                    <td key={column.key} style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: column.numeric ? 'right' : 'left' }}>
                      {value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value }) => (
  <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: 6, padding: 14 }}>
    <div style={{ fontSize: 12, color: '#667085', marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 700, color: '#1f2937' }}>{value}</div>
  </div>
);

export default ActiveLoanPositionReport;
