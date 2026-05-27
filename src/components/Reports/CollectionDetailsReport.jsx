import React, { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import API_BASE_URL from '../../api';

const loanColumns = [
  { key: 'loan_id', label: 'Loan No' },
  { key: 'display_status', label: 'Status' },
  { key: 'loan_type', label: 'Loan Type' },
  { key: 'issue_date', label: 'Issue Date', date: true },
  { key: 'maturity_date', label: 'Maturity Date', date: true },
  { key: 'issue_amount', label: 'Issue Amount', numeric: true },
  { key: 'collected_amount', label: 'Collected Amount', numeric: true },
  { key: 'balance_amount', label: 'Balance Amount', numeric: true },
];

const collectionColumns = [
  { key: 'sl_no', label: 'Sl.No' },
  { key: 'loan_id', label: 'Loan No' },
  { key: 'collection_id', label: 'Collection ID' },
  { key: 'collection_date', label: 'Collected Date', date: true },
  { key: 'collection_amount', label: 'Amount', numeric: true },
  { key: 'collection_type', label: 'Type' },
  { key: 'collected_by_name', label: 'Collected By' },
];

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

function formatLoanType(loanType) {
  return String(loanType || '').replace(/\s*loan\s*/i, '').trim();
}

function formatLoanStatus(loan) {
  if (String(loan.status || '').toLowerCase() === 'closed'
    || loan.loan_status_closed === true
    || loan.loan_status_closed === 'true') {
    return 'Closed';
  }

  return loan.status || 'Open';
}

function isClosedLoan(loan) {
  return formatLoanStatus(loan).toLowerCase() === 'closed';
}

function normalizeWhatsAppPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length > 10 && digits.startsWith('0')) return digits.slice(1);
  return digits;
}

function formatCell(row, column) {
  const value = row[column.key];
  if (column.numeric) return formatAmount(value);
  if (column.date) return formatDate(value);
  if (column.key === 'loan_type') return formatLoanType(value);
  return value || '';
}

const CollectionDetailsReport = () => {
  const [customers, setCustomers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [collections, setCollections] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState('');
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
          throw new Error('Unable to load collection details.');
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
          setError(err.message || 'Unable to load collection details.');
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

  const customerOptions = useMemo(
    () => [...customers]
      .sort((a, b) => String(a.customer_name || '').localeCompare(String(b.customer_name || '')))
      .map(customer => ({
        value: customer.customer_id,
        label: `${customer.customer_id} - ${customer.customer_name || ''}`.trim(),
      })),
    [customers]
  );

  const selectedCustomerOption = useMemo(
    () => customerOptions.find(option => option.value === selectedCustomerId) || null,
    [customerOptions, selectedCustomerId]
  );

  const selectedCustomer = useMemo(
    () => customers.find(customer => customer.customer_id === selectedCustomerId) || null,
    [customers, selectedCustomerId]
  );

  const collectionsByLoan = useMemo(() => (
    collections.reduce((map, collection) => {
      const loanId = String(collection.loan_id || '').trim();
      if (!loanId) return map;
      if (!map.has(loanId)) map.set(loanId, []);
      map.get(loanId).push(collection);
      return map;
    }, new Map())
  ), [collections]);

  const loanRows = useMemo(() => {
    if (!selectedCustomerId) return [];

    return loans
      .filter(loan => loan.customer_id === selectedCustomerId)
      .map(loan => {
        const loanCollections = collectionsByLoan.get(String(loan.loan_id || '').trim()) || [];
        const collectedAmount = loanCollections.reduce((sum, collection) => sum + toAmount(collection.collection_amount), 0);
        const issueAmount = toAmount(loan.issue_amount);

        return {
          ...loan,
          display_status: formatLoanStatus(loan),
          collected_amount: collectedAmount,
          balance_amount: issueAmount - collectedAmount,
        };
      })
      .sort((a, b) => String(b.issue_date || '').localeCompare(String(a.issue_date || '')));
  }, [collectionsByLoan, loans, selectedCustomerId]);

  useEffect(() => {
    if (!selectedCustomerId || loanRows.length === 0) {
      setSelectedLoanId('');
      return;
    }

    const currentSelectionExists = loanRows.some(loan => String(loan.loan_id || '') === String(selectedLoanId || ''));
    if (currentSelectionExists) return;

    const defaultLoan = loanRows.find(loan => !isClosedLoan(loan)) || loanRows[0];
    setSelectedLoanId(defaultLoan ? String(defaultLoan.loan_id || '') : '');
  }, [loanRows, selectedCustomerId, selectedLoanId]);

  const selectedLoan = useMemo(
    () => loanRows.find(loan => String(loan.loan_id || '') === String(selectedLoanId || '')) || null,
    [loanRows, selectedLoanId]
  );

  const collectionRows = useMemo(() => (
    selectedLoan
      ? (collectionsByLoan.get(String(selectedLoan.loan_id || '').trim()) || [])
      .sort((a, b) => String(a.collection_date || '').localeCompare(String(b.collection_date || '')))
      .map((collection, index) => ({
        ...collection,
        sl_no: index + 1,
      }))
      .sort((a, b) => String(b.collection_date || '').localeCompare(String(a.collection_date || '')))
      : []
  ), [selectedLoan, collectionsByLoan]);

  const totalIssued = loanRows.reduce((sum, loan) => sum + toAmount(loan.issue_amount), 0);
  const totalCollected = loanRows.reduce((sum, loan) => sum + toAmount(loan.collected_amount), 0);
  const totalBalance = loanRows.reduce((sum, loan) => sum + toAmount(loan.balance_amount), 0);

  function buildWhatsAppMessage() {
    const loansForMessage = selectedLoan ? [selectedLoan] : [];
    const sections = loansForMessage.map(loan => {
      const loanCollections = (collectionsByLoan.get(String(loan.loan_id || '').trim()) || [])
        .slice()
        .sort((a, b) => String(a.collection_date || '').localeCompare(String(b.collection_date || '')));
      const collectionLines = loanCollections.length
        ? loanCollections.map((collection, index) => (
          `${index + 1}. ${formatDate(collection.collection_date)} - Rs. ${formatAmount(collection.collection_amount)} - ${collection.collection_type || '-'} - Collected by ${collection.collected_by_name || '-'}`
        )).join('\n')
        : 'No collections recorded for this loan.';

      return [
        `Loan ID: ${loan.loan_id || ''}`,
        `Loan Type: ${formatLoanType(loan.loan_type)}`,
        `Issue Amount: Rs. ${formatAmount(loan.issue_amount)}`,
        `Collected Amount: Rs. ${formatAmount(loan.collected_amount)}`,
        `Balance Amount: Rs. ${formatAmount(loan.balance_amount)}`,
        `Issue Date: ${formatDate(loan.issue_date)}`,
        `Maturity Date: ${formatDate(loan.maturity_date)}`,
        '',
        'Collection Details:',
        collectionLines,
      ].join('\n');
    });

    return [
      `Dear ${selectedCustomer?.customer_name || 'Customer'},`,
      '',
      'Your loan collection details:',
      '',
      ...sections.flatMap((section, index) => (index === 0 ? [section] : ['', section])),
      '',
      `Selected Loan: ${selectedLoan?.loan_id || '-'}`,
      `Total Collected: Rs. ${formatAmount(selectedLoan?.collected_amount || 0)}`,
      `Total Balance: Rs. ${formatAmount(selectedLoan?.balance_amount || 0)}`,
      '',
      'Thank you,',
      'Sri Vallavan Finance',
    ].join('\n');
  }

  function sendCollectionDetailsByWhatsApp() {
    if (!selectedCustomer) return;
    if (loanRows.length === 0) {
      alert('No loans found for this customer.');
      return;
    }
    if (!selectedLoan) {
      alert('Select a loan to send collection details.');
      return;
    }

    let phone = normalizeWhatsAppPhone(selectedCustomer.mobile_number);
    if (!phone) {
      const manualNumber = window.prompt('Mobile number is missing. Enter WhatsApp mobile number:');
      phone = normalizeWhatsAppPhone(manualNumber);
      if (!phone) return;
    }

    const message = encodeURIComponent(buildWhatsAppMessage());
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div>
      <h2 style={{ color: 'navy', margin: '0 0 18px' }}>Collection Details</h2>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 18 }}>
        <label style={{ fontSize: 13, color: '#444' }}>
          Customer
          <Select
            options={customerOptions}
            value={selectedCustomerOption}
            onChange={option => {
              setSelectedCustomerId(option ? option.value : '');
              setSelectedLoanId('');
            }}
            placeholder="Type code or name to search"
            isClearable
            isSearchable
            styles={{
              container: base => ({ ...base, width: 320, marginTop: 4 }),
              control: base => ({ ...base, minHeight: 36, fontSize: 13 }),
              menu: base => ({ ...base, zIndex: 10 }),
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setSelectedCustomerId('');
            setSelectedLoanId('');
          }}
          style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #cfd6e2', borderRadius: 4, background: '#fff', color: '#344054', cursor: 'pointer' }}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={sendCollectionDetailsByWhatsApp}
          disabled={loading || !selectedCustomer || loanRows.length === 0 || !selectedLoan}
          style={{
            padding: '8px 16px',
            fontSize: 13,
            border: '1px solid #1fae55',
            borderRadius: 4,
            background: loading || !selectedCustomer || loanRows.length === 0 || !selectedLoan ? '#f2f4f7' : '#25d366',
            color: loading || !selectedCustomer || loanRows.length === 0 || !selectedLoan ? '#98a2b3' : '#fff',
            cursor: loading || !selectedCustomer || loanRows.length === 0 || !selectedLoan ? 'not-allowed' : 'pointer',
          }}
        >
          WhatsApp
        </button>
      </div>

      {error && <div style={{ color: '#b00020', marginBottom: 12 }}>{error}</div>}

      {selectedCustomer && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 18 }}>
          <SummaryCard label="Customer" value={selectedCustomer.customer_name || selectedCustomer.customer_id} />
          <SummaryCard label="Mobile" value={selectedCustomer.mobile_number || '-'} />
          <SummaryCard label="Loans" value={loanRows.length.toLocaleString()} />
          <SummaryCard label="Collected" value={formatAmount(totalCollected)} />
          <SummaryCard label="Balance" value={formatAmount(totalBalance)} />
          <SummaryCard label="Selected Loan" value={selectedLoan ? `${selectedLoan.loan_id} (${formatLoanStatus(selectedLoan)})` : '-'} />
        </div>
      )}

      <div className="desktop-table-wrap" style={{ overflowX: 'auto', background: '#fff', boxShadow: '0 1px 4px #eee', marginBottom: 18 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1040 }}>
          <thead>
            <tr>
              {loanColumns.map(column => (
                <th key={column.key} style={{ padding: '8px 6px', borderBottom: '1px solid #ccc', textAlign: column.numeric ? 'right' : 'left', background: '#fafbfc', whiteSpace: 'nowrap' }}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={loanColumns.length} style={{ padding: 12 }}>Loading...</td></tr>
            ) : !selectedCustomerId ? (
              <tr><td colSpan={loanColumns.length} style={{ padding: 12 }}>Select a customer to view loans.</td></tr>
            ) : loanRows.length === 0 ? (
              <tr><td colSpan={loanColumns.length} style={{ padding: 12 }}>No loans found for this customer.</td></tr>
            ) : loanRows.map(row => {
              const isSelected = String(row.loan_id || '') === String(selectedLoanId || '');
              return (
                <tr
                  key={row.loan_id}
                  onClick={() => setSelectedLoanId(String(row.loan_id || ''))}
                  style={{ background: isSelected ? '#eaf3ff' : '#fff', cursor: 'pointer' }}
                >
                  {loanColumns.map(column => (
                    <td key={column.key} style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: column.numeric ? 'right' : 'left' }}>
                      {formatCell(row, column)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
          {loanRows.length > 0 && (
            <tfoot>
              <tr style={{ background: '#f9f9f9', fontWeight: 700 }}>
                <td colSpan={5} style={{ padding: '7px 6px', textAlign: 'right' }}>Totals:</td>
                <td style={{ padding: '7px 6px', textAlign: 'right' }}>{formatAmount(totalIssued)}</td>
                <td style={{ padding: '7px 6px', textAlign: 'right' }}>{formatAmount(totalCollected)}</td>
                <td style={{ padding: '7px 6px', textAlign: 'right' }}>{formatAmount(totalBalance)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="desktop-table-wrap" style={{ overflowX: 'auto', background: '#fff', boxShadow: '0 1px 4px #eee' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 860 }}>
          <thead>
            <tr>
              {collectionColumns.map(column => (
                <th key={column.key} style={{ padding: '8px 6px', borderBottom: '1px solid #ccc', textAlign: column.numeric ? 'right' : 'left', background: '#fafbfc', whiteSpace: 'nowrap' }}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={collectionColumns.length} style={{ padding: 12 }}>Loading...</td></tr>
            ) : !selectedCustomerId ? (
              <tr><td colSpan={collectionColumns.length} style={{ padding: 12 }}>Select a customer to view collection details.</td></tr>
            ) : !selectedLoan ? (
              <tr><td colSpan={collectionColumns.length} style={{ padding: 12 }}>Select a loan to view collection details.</td></tr>
            ) : collectionRows.length === 0 ? (
              <tr><td colSpan={collectionColumns.length} style={{ padding: 12 }}>No collections found for selected loan {selectedLoan.loan_id}.</td></tr>
            ) : collectionRows.map(row => (
              <tr key={`${row.loan_id}-${row.collection_id}`}>
                {collectionColumns.map(column => (
                  <td key={column.key} style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: column.numeric ? 'right' : 'left' }}>
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
        ) : !selectedCustomerId ? (
          <div className="mobile-record-card">Select a customer to view collection details.</div>
        ) : loanRows.length === 0 ? (
          <div className="mobile-record-card">No loans found for this customer.</div>
        ) : loanRows.map(loan => {
          const isSelected = String(loan.loan_id || '') === String(selectedLoanId || '');
          const loanCollections = (collectionsByLoan.get(String(loan.loan_id || '').trim()) || [])
            .slice()
            .sort((a, b) => String(b.collection_date || '').localeCompare(String(a.collection_date || '')));

          return (
            <div
              className="mobile-record-card"
              key={loan.loan_id}
              onClick={() => setSelectedLoanId(String(loan.loan_id || ''))}
              style={{ borderColor: isSelected ? '#1f7bd8' : undefined, background: isSelected ? '#f5faff' : undefined, cursor: 'pointer' }}
            >
              <div className="mobile-card-title">
                <div>
                  {selectedCustomer?.customer_name || 'Customer'}
                  <div className="mobile-card-subtitle">Loan {loan.loan_id} · {formatLoanType(loan.loan_type)}</div>
                </div>
                <div className="mobile-badge-stack">
                  <span className="mobile-badge">{formatLoanStatus(loan)}</span>
                  <span className="mobile-badge">Balance {formatAmount(loan.balance_amount)}</span>
                </div>
              </div>
              <div className="mobile-card-grid">
                <div className="mobile-card-field">
                  <span className="mobile-card-label">Issue Date</span>
                  <span className="mobile-card-value">{formatDate(loan.issue_date)}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">Maturity</span>
                  <span className="mobile-card-value">{formatDate(loan.maturity_date)}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">Issued</span>
                  <span className="mobile-card-value">{formatAmount(loan.issue_amount)}</span>
                </div>
                <div className="mobile-card-field">
                  <span className="mobile-card-label">Collected</span>
                  <span className="mobile-card-value">{formatAmount(loan.collected_amount)}</span>
                </div>
              </div>
              {isSelected && (
                <div className="mobile-collection-list">
                  <div className="mobile-section-title">Collections</div>
                  {loanCollections.length === 0 ? (
                    <div className="mobile-collection-empty">No collections recorded.</div>
                  ) : loanCollections.map(collection => (
                    <div className="mobile-collection-row" key={collection.collection_id || `${loan.loan_id}-${collection.collection_date}-${collection.collection_amount}`}>
                      <div>
                        <div className="mobile-collection-date">{formatDate(collection.collection_date)}</div>
                        <div className="mobile-collection-meta">{collection.collection_type || '-'} · {collection.collected_by_name || '-'}</div>
                      </div>
                      <div className="mobile-collection-amount">{formatAmount(collection.collection_amount)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value }) => (
  <div style={{ background: '#fff', border: '1px solid #e4e8ef', borderRadius: 6, padding: 14 }}>
    <div style={{ fontSize: 12, color: '#667085', marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 18, fontWeight: 700, color: '#1f2937' }}>{value}</div>
  </div>
);

export default CollectionDetailsReport;
