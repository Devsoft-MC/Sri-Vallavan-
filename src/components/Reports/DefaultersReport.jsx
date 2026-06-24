import React, { useEffect, useMemo, useState } from 'react';
import API_BASE_URL from '../../api';
import useIsMobile from '../../hooks/useIsMobile';
import { getLoanBalance } from '../../utils/loanUtils';

const MOBILE_REPORT_LIMIT = 300;
const MOBILE_COLLECTION_LIMIT = 500;

function pad(value) {
  return String(value).padStart(2, '0');
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

function toIsoDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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

function isClosedLoan(loan) {
  return String(loan.status || '').toLowerCase() === 'closed'
    || loan.loan_status_closed === true
    || loan.loan_status_closed === 'true';
}

function isPersonalLoan(loan) {
  const loanType = String(loan.loan_type || '').toLowerCase();
  return loanType === 'pl' || loanType.includes('personal');
}

const presetDays = [7, 15, 30, 60, 90];

const DefaultersReport = () => {
  const isMobile = useIsMobile();
  const [daysBack, setDaysBack] = useState(7);
  const [customDays, setCustomDays] = useState('');
  const [customers, setCustomers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [windowCollections, setWindowCollections] = useState([]);
  const [allCollections, setAllCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const selectedDays = useMemo(() => {
    const parsed = Number(customDays);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(365, Math.max(1, parsed));
    }
    return daysBack;
  }, [customDays, daysBack]);

  const windowEnd = useMemo(() => {
    const end = new Date();
    end.setDate(end.getDate() - 1);
    return toIsoDate(end);
  }, []);

  const windowStart = useMemo(() => {
    const start = new Date(windowEnd);
    start.setDate(start.getDate() - (selectedDays - 1));
    return toIsoDate(start);
  }, [selectedDays, windowEnd]);

  useEffect(() => {
    let cancelled = false;

    async function loadReportData() {
      setLoading(true);
      setError('');

      try {
        const customerParams = new URLSearchParams();
        const loanParams = new URLSearchParams();
        const windowCollectionParams = new URLSearchParams({ from: windowStart, to: windowEnd });
        const allCollectionParams = new URLSearchParams({ text: '%' });
        if (isMobile) {
          customerParams.set('limit', String(MOBILE_REPORT_LIMIT));
          loanParams.set('limit', String(MOBILE_REPORT_LIMIT));
          windowCollectionParams.set('limit', String(MOBILE_COLLECTION_LIMIT));
          allCollectionParams.set('limit', String(MOBILE_COLLECTION_LIMIT));
        }

        const [customersRes, loansRes, windowCollectionsRes, allCollectionsRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/customers${customerParams.toString() ? `?${customerParams}` : ''}`),
          fetch(`${API_BASE_URL}/api/loans${loanParams.toString() ? `?${loanParams}` : ''}`),
          fetch(`${API_BASE_URL}/api/collections?${windowCollectionParams}`),
          fetch(`${API_BASE_URL}/api/collections?${allCollectionParams}`),
        ]);

        if (!customersRes.ok || !loansRes.ok || !windowCollectionsRes.ok || !allCollectionsRes.ok) {
          throw new Error('Unable to load defaulters report data.');
        }

        const [customerData, loanData, windowCollectionData, allCollectionData] = await Promise.all([
          customersRes.json(),
          loansRes.json(),
          windowCollectionsRes.json(),
          allCollectionsRes.json(),
        ]);

        if (!cancelled) {
          setCustomers(Array.isArray(customerData) ? customerData : []);
          setLoans(Array.isArray(loanData) ? loanData : []);
          setWindowCollections(Array.isArray(windowCollectionData) ? windowCollectionData : []);
          setAllCollections(Array.isArray(allCollectionData) ? allCollectionData : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Unable to load defaulters report data.');
          setLoans([]);
          setWindowCollections([]);
          setAllCollections([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadReportData();
    return () => {
      cancelled = true;
    };
  }, [isMobile, windowStart, windowEnd]);

  const windowCollectionsByLoan = useMemo(() => {
    const map = new Map();
    windowCollections.forEach(collection => {
      const loanId = String(collection.loan_id || '').trim();
      if (!loanId) return;

      const existing = map.get(loanId) || [];
      existing.push(collection);
      map.set(loanId, existing);
    });
    return map;
  }, [windowCollections]);

  const collectedByLoan = useMemo(() => {
    const map = new Map();
    allCollections.forEach(collection => {
      const loanId = String(collection.loan_id || '').trim();
      if (!loanId) return;

      map.set(loanId, toAmount(map.get(loanId)) + toAmount(collection.collection_amount));
    });
    return map;
  }, [allCollections]);

  const customerMap = useMemo(() => {
    const map = new Map();
    customers.forEach(customer => {
      map.set(String(customer.customer_id || '').trim(), customer.customer_name || 'Unknown');
    });
    return map;
  }, [customers]);

  const defaulterLoans = useMemo(() => {
    return loans
      .filter(loan => {
        if (isClosedLoan(loan)) return false;
        if (!isPersonalLoan(loan)) return false;
        const loanId = String(loan.loan_id || '').trim();
        return loanId && !windowCollectionsByLoan.has(loanId);
      })
      .sort((a, b) => String(a.loan_id || '').localeCompare(String(b.loan_id || '')))
      .map(loan => ({
        ...loan,
        balance: getLoanBalance(loan, collectedByLoan),
        customer_name: loan.customer_name || customerMap.get(String(loan.customer_id || '').trim()) || loan.customer_id || 'Unknown',
      }))
      .filter(loan => loan.balance > 0);
  }, [windowCollectionsByLoan, collectedByLoan, loans, customerMap]);

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ color: 'navy', margin: '0 0 12px' }}>Defaulters</h2>
      <div style={{ color: '#667085', marginBottom: 16 }}>
        Select a period from yesterday backwards and see personal loans with no collections in that window.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
          Report window
          <select
            value={daysBack}
            onChange={(event) => {
              setDaysBack(Number(event.target.value));
              setCustomDays('');
            }}
            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff' }}
          >
            {presetDays.map(value => (
              <option key={value} value={value}>{`${value} days`}</option>
            ))}
            <option value={365}>365 days</option>
          </select>
        </label>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 180 }}>
          Custom days
          <input
            type="number"
            min="1"
            max="365"
            value={customDays}
            onChange={event => setCustomDays(event.target.value)}
            placeholder="Enter days"
            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid #cbd5e1' }}
          />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 8, minWidth: 220 }}>
          <button
            type="button"
            onClick={() => {
              setDaysBack(1);
              setCustomDays('');
            }}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #0f766e',
              background: '#f0fdfa',
              color: '#0f766e',
              cursor: 'pointer',
            }}
          >
            Yesterday only
          </button>
          <div style={{ fontSize: 13, color: '#334155' }}>
            Window: <strong>{windowStart}</strong> to <strong>{windowEnd}</strong>
          </div>
          <div style={{ fontSize: 13, color: '#334155' }}>
            Included days: <strong>{selectedDays}</strong>
          </div>
        </div>
      </div>

      {selectedDays === 1 && !loading && !error && (
        <div style={{ marginBottom: 18, padding: 14, border: '1px solid #d1fae5', borderRadius: 12, background: '#f0f9ff', color: '#0f172a' }}>
          {windowCollections.length === 0 ? (
            <strong>No collections were recorded on {windowStart}.</strong>
          ) : (
            <span>
              {windowCollections.length} collection record{windowCollections.length === 1 ? '' : 's'} were recorded on {windowStart}.
            </span>
          )}
        </div>
      )}

      {!loading && !error && (
        <div style={{ marginBottom: 14, fontSize: 13, color: '#334155' }}>
          Showing {defaulterLoans.length} personal loan{defaulterLoans.length === 1 ? '' : 's'} with no collections between {windowStart} and {windowEnd}.
        </div>
      )}

      {loading ? (
        <div>Loading report...</div>
      ) : error ? (
        <div style={{ color: '#b91c1c' }}>{error}</div>
      ) : defaulterLoans.length === 0 ? (
        <div>No loans without collections found in the selected window.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>S.No</th>
                <th style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>Loan No</th>
                <th style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>Customer</th>
                <th style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>Loan Type</th>
                <th style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>Issue Date</th>
                <th style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>Maturity Date</th>
                <th style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>Balance</th>
                <th style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {defaulterLoans.map((loan, index) => (
                <tr key={`${loan.loan_id}-${index}`} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px 12px' }}>{index + 1}</td>
                  <td style={{ padding: '10px 12px' }}>{loan.loan_id}</td>
                  <td style={{ padding: '10px 12px' }}>{loan.customer_name || loan.customer_id || '-'}</td>
                  <td style={{ padding: '10px 12px' }}>{loan.loan_type || '-'}</td>
                  <td style={{ padding: '10px 12px' }}>{formatDate(loan.issue_date)}</td>
                  <td style={{ padding: '10px 12px' }}>{formatDate(loan.maturity_date)}</td>
                  <td style={{ padding: '10px 12px' }}>{formatAmount(loan.balance)}</td>
                  <td style={{ padding: '10px 12px' }}>{loan.status || 'Open'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DefaultersReport;
