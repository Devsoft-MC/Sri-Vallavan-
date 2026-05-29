import React, { useEffect, useMemo, useState } from 'react';
import API_BASE_URL from '../../api';

const today = new Date().toISOString().slice(0, 10);
const firstDayOfYear = `${today.slice(0, 4)}-01-01`;

function normalizeDate(value) {
  return value ? String(value).slice(0, 10) : '';
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

function formatMonth(value) {
  const [year, month] = String(value || '').split('-');
  if (!year || !month) return '';
  return new Date(Number(year), Number(month) - 1, 1).toLocaleString(undefined, {
    month: 'short',
    year: 'numeric',
  });
}

const InterestReceivedReport = () => {
  const [entries, setEntries] = useState([]);
  const [loans, setLoans] = useState([]);
  const [fromDate, setFromDate] = useState(firstDayOfYear);
  const [toDate, setToDate] = useState(today);
  const [loanType, setLoanType] = useState('');
  const [viewMode, setViewMode] = useState('monthly');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadReportData() {
      setLoading(true);
      setError('');

      try {
        const [entriesRes, loansRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/loan-income?text=%25`),
          fetch(`${API_BASE_URL}/api/loans`),
        ]);

        if (!entriesRes.ok || !loansRes.ok) {
          throw new Error('Unable to load interest received report.');
        }

        const [entryData, loanData] = await Promise.all([
          entriesRes.json(),
          loansRes.json(),
        ]);

        if (!cancelled) {
          setEntries(Array.isArray(entryData) ? entryData : []);
          setLoans(Array.isArray(loanData) ? loanData : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to load interest received report.');
          setEntries([]);
          setLoans([]);
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

  const loanMap = useMemo(
    () => new Map(loans.map(loan => [loan.loan_id, loan])),
    [loans]
  );

  const loanTypes = useMemo(
    () => [...new Set(loans.map(loan => loan.loan_type).filter(Boolean))].sort(),
    [loans]
  );

  const reportRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return entries
      .filter(entry => entry.income_type_name === 'Interest Received')
      .map(entry => {
        const loan = loanMap.get(entry.loan_id) || {};
        return {
          ...entry,
          income_date: normalizeDate(entry.income_date),
          loan_type: loan.loan_type || entry.loan_type || '',
          customer_name: entry.customer_name || loan.customer_name || '',
        };
      })
      .filter(row => {
        const date = row.income_date;
        const matchesDate = (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
        const matchesLoanType = !loanType || row.loan_type === loanType;
        const matchesSearch = !query || [
          row.loan_id,
          row.customer_id,
          row.customer_name,
          row.loan_type,
          row.received_by,
          row.amount,
          row.notes,
        ].some(value => String(value || '').toLowerCase().includes(query));

        return matchesDate && matchesLoanType && matchesSearch;
      })
      .sort((a, b) => b.income_date.localeCompare(a.income_date) || String(b.loan_income_id || '').localeCompare(String(a.loan_income_id || '')));
  }, [entries, fromDate, loanMap, loanType, search, toDate]);

  const monthlyRows = useMemo(() => {
    const totals = new Map();
    reportRows.forEach(row => {
      const month = row.income_date.slice(0, 7);
      const current = totals.get(month) || { month, entries: 0, amount: 0 };
      current.entries += 1;
      current.amount += toAmount(row.amount);
      totals.set(month, current);
    });
    return Array.from(totals.values()).sort((a, b) => b.month.localeCompare(a.month));
  }, [reportRows]);

  const totalAmount = reportRows.reduce((sum, row) => sum + toAmount(row.amount), 0);

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ color: 'navy', margin: '0 0 18px' }}>Interest Received</h2>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, alignItems: 'end', marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: '#444' }}>
          From
          <input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} style={{ display: 'block', marginTop: 4, padding: 7, width: '100%', fontSize: 13 }} />
        </label>
        <label style={{ fontSize: 13, color: '#444' }}>
          To
          <input type="date" value={toDate} onChange={event => setToDate(event.target.value)} style={{ display: 'block', marginTop: 4, padding: 7, width: '100%', fontSize: 13 }} />
        </label>
        <label style={{ fontSize: 13, color: '#444' }}>
          Loan Type
          <select value={loanType} onChange={event => setLoanType(event.target.value)} style={{ display: 'block', marginTop: 4, padding: 7, width: '100%', fontSize: 13 }}>
            <option value="">All loan types</option>
            {loanTypes.map(type => <option key={type} value={type}>{type}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13, color: '#444' }}>
          View
          <select value={viewMode} onChange={event => setViewMode(event.target.value)} style={{ display: 'block', marginTop: 4, padding: 7, width: '100%', fontSize: 13 }}>
            <option value="monthly">Monthly Summary</option>
            <option value="details">Detailed Entries</option>
          </select>
        </label>
        <label style={{ fontSize: 13, color: '#444' }}>
          Search
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Loan, customer, receiver" style={{ display: 'block', marginTop: 4, padding: 7, width: '100%', fontSize: 13 }} />
        </label>
      </div>

      <div className="mobile-toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 14, color: '#555' }}>{reportRows.length} entries</span>
        <span style={{ fontSize: 14, color: '#1f2937', fontWeight: 700 }}>Total {formatAmount(totalAmount)}</span>
      </div>

      {error && <div style={{ color: '#b42318', marginBottom: 12 }}>{error}</div>}

      <div className="desktop-table-wrap">
        {viewMode === 'monthly' ? (
          <table className="fixed-header-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', boxShadow: '0 1px 4px #eee' }}>
            <thead>
              <tr>
                {['Month', 'Entries', 'Total Interest'].map(label => (
                  <th key={label} style={{ padding: '7px 6px', borderBottom: '1px solid #ccc', textAlign: label === 'Month' ? 'left' : 'right', background: '#fafbfc' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={3} style={{ padding: 12 }}>Loading...</td></tr>
              ) : monthlyRows.length === 0 ? (
                <tr><td colSpan={3} style={{ padding: 12 }}>No interest received found.</td></tr>
              ) : monthlyRows.map(row => (
                <tr key={row.month}>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{formatMonth(row.month)}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{row.entries}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 700 }}>{formatAmount(row.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="fixed-header-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', boxShadow: '0 1px 4px #eee' }}>
            <thead>
              <tr>
                {['Date', 'Loan', 'Loan Type', 'Customer', 'Amount', 'Received By'].map(label => (
                  <th key={label} style={{ padding: '7px 6px', borderBottom: '1px solid #ccc', textAlign: label === 'Amount' ? 'right' : 'left', background: '#fafbfc' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 12 }}>Loading...</td></tr>
              ) : reportRows.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 12 }}>No interest received found.</td></tr>
              ) : reportRows.map(row => (
                <tr key={row.loan_income_id}>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{formatDate(row.income_date)}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{row.loan_id}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{row.loan_type}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{row.customer_name || row.customer_id}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatAmount(row.amount)}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{row.received_by || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mobile-card-list">
        {(viewMode === 'monthly' ? monthlyRows : reportRows).map(row => (
          <div key={viewMode === 'monthly' ? row.month : row.loan_income_id} className="mobile-record-card">
            {viewMode === 'monthly' ? (
              <div className="mobile-card-title">
                <div>
                  {formatMonth(row.month)}
                  <div className="mobile-card-subtitle">{row.entries} entries</div>
                </div>
                <span className="mobile-badge">{formatAmount(row.amount)}</span>
              </div>
            ) : (
              <div className="mobile-card-title">
                <div>
                  {row.customer_name || row.customer_id}
                  <div className="mobile-card-subtitle">{row.loan_id} · {row.loan_type} · {formatDate(row.income_date)}</div>
                </div>
                <span className="mobile-badge">{formatAmount(row.amount)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default InterestReceivedReport;
