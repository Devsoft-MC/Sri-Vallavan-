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

function getSortValue(row, column) {
  const value = row[column.key];

  if (column.numeric) return toAmount(value);
  if (column.key.includes('date')) return normalizeDate(value);

  return String(value || '').toLowerCase();
}

function formatReportCell(row, column, forExcel = false) {
  const value = row[column.key];

  if (column.numeric) return forExcel ? toAmount(value) : formatAmount(value);
  if (column.key.includes('date')) return formatDate(value);

  return value || '';
}

function getReportFileName(extension, asOnDate) {
  return `active-loan-position-${asOnDate}.${extension}`;
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
  const [sortConfig, setSortConfig] = useState({ key: 'loan_id', direction: 'asc' });
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

  const sortedRows = useMemo(() => {
    const sortColumn = columns.find(column => column.key === sortConfig.key);
    if (!sortColumn) return filteredRows;

    return [...filteredRows].sort((a, b) => {
      const aValue = getSortValue(a, sortColumn);
      const bValue = getSortValue(b, sortColumn);

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredRows, sortConfig]);

  const handleSort = (key) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const clearFilters = () => {
    setAsOnDate(today);
    setSearch('');
    setArea('');
    setLoanType('');
  };

  const exportToExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const tableRows = sortedRows.map(row => columns.map(column => formatReportCell(row, column, true)));
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['Active Loan Position As On Date'],
        ['As On Date', formatDate(asOnDate)],
        ['Active Loans', totals.activeLoans, 'Total Issued Amount', totals.issued, 'Total Collected Amount', totals.collected, 'Balance Amount', totals.balance],
        [],
        columns.map(column => column.label),
        ...tableRows,
      ]);

      worksheet['!cols'] = columns.map(column => ({ wch: column.numeric ? 18 : 16 }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Loan Report');
      XLSX.writeFile(workbook, getReportFileName('xlsx', asOnDate));
    } catch (err) {
      setError(err.message || 'Unable to export Excel report.');
    }
  };

  const exportToPDF = async () => {
    try {
      const jsPDFModule = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');
      const doc = new jsPDFModule.default({ orientation: 'landscape', unit: 'pt', format: 'a4' });

      doc.setFontSize(14);
      doc.text('Active Loan Position As On Date', 40, 36);
      doc.setFontSize(9);
      doc.text(`As On Date: ${formatDate(asOnDate)}`, 40, 54);
      doc.text(
        `Active Loans: ${totals.activeLoans.toLocaleString()}   Issued: ${formatAmount(totals.issued)}   Collected: ${formatAmount(totals.collected)}   Balance: ${formatAmount(totals.balance)}`,
        40,
        70
      );

      autoTableModule.default(doc, {
        startY: 86,
        head: [columns.map(column => column.label)],
        body: sortedRows.map(row => columns.map(column => formatReportCell(row, column))),
        styles: { fontSize: 7, cellPadding: 3, overflow: 'linebreak' },
        headStyles: { fillColor: [250, 251, 252], textColor: [31, 41, 55], fontStyle: 'bold' },
        columnStyles: {
          8: { halign: 'right' },
          9: { halign: 'right' },
          10: { halign: 'right' },
        },
        margin: { left: 24, right: 24 },
      });

      doc.save(getReportFileName('pdf', asOnDate));
    } catch (err) {
      setError(err.message || 'Unable to export PDF report.');
    }
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
        <button
          type="button"
          onClick={exportToExcel}
          disabled={loading || sortedRows.length === 0}
          style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #157347', borderRadius: 4, background: loading || sortedRows.length === 0 ? '#f2f4f7' : '#198754', color: loading || sortedRows.length === 0 ? '#98a2b3' : '#fff', cursor: loading || sortedRows.length === 0 ? 'not-allowed' : 'pointer' }}
        >
          Excel
        </button>
        <button
          type="button"
          onClick={exportToPDF}
          disabled={loading || sortedRows.length === 0}
          style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #b42318', borderRadius: 4, background: loading || sortedRows.length === 0 ? '#f2f4f7' : '#d92d20', color: loading || sortedRows.length === 0 ? '#98a2b3' : '#fff', cursor: loading || sortedRows.length === 0 ? 'not-allowed' : 'pointer' }}
        >
          PDF
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
        <SummaryCard label="Active Loans" value={totals.activeLoans.toLocaleString()} />
        <SummaryCard label="Total Issued Amount" value={formatAmount(totals.issued)} />
        <SummaryCard label="Total Collected Amount" value={formatAmount(totals.collected)} />
        <SummaryCard label="Balance Amount" value={formatAmount(totals.balance)} />
      </div>

      {error && <div style={{ color: '#b00020', marginBottom: 12 }}>{error}</div>}

      <div className="desktop-table-wrap" style={{ overflowX: 'auto', background: '#fff', boxShadow: '0 1px 4px #eee' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1180 }}>
          <thead>
            <tr>
              {columns.map(column => (
                <th key={column.key} style={{ padding: '8px 6px', borderBottom: '1px solid #ccc', textAlign: column.numeric ? 'right' : 'left', background: '#fafbfc', position: 'sticky', top: 0 }}>
                  <button
                    type="button"
                    onClick={() => handleSort(column.key)}
                    aria-sort={sortConfig.key === column.key ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                    style={{
                      width: '100%',
                      border: 0,
                      background: 'transparent',
                      padding: 0,
                      color: '#1f2937',
                      cursor: 'pointer',
                      font: 'inherit',
                      fontWeight: 700,
                      textAlign: column.numeric ? 'right' : 'left',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span>{column.label}</span>
                    <span style={{ display: 'inline-block', width: 14, marginLeft: 4, color: sortConfig.key === column.key ? '#1d4ed8' : '#98a2b3' }}>
                      {sortConfig.key === column.key ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length} style={{ padding: 12 }}>Loading...</td></tr>
            ) : sortedRows.length === 0 ? (
              <tr><td colSpan={columns.length} style={{ padding: 12 }}>No active loans found for the selected date.</td></tr>
            ) : sortedRows.map(row => (
              <tr key={row.loan_id}>
                {columns.map(column => {
                  return (
                    <td key={column.key} style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: column.numeric ? 'right' : 'left' }}>
                      {formatReportCell(row, column)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mobile-card-list">
        {loading ? (
          <div className="mobile-record-card">Loading...</div>
        ) : sortedRows.length === 0 ? (
          <div className="mobile-record-card">No active loans found for the selected date.</div>
        ) : sortedRows.map(row => (
          <div className="mobile-record-card" key={row.loan_id}>
            <div className="mobile-card-title">
              <div>
                {row.customer_name || 'Loan'}
                <div className="mobile-card-subtitle">Loan {row.loan_id} · Customer {row.customer_id}</div>
              </div>
              <span className="mobile-badge">{row.loan_type || 'Loan'}</span>
            </div>
            <div className="mobile-card-grid">
              <div className="mobile-card-field">
                <span className="mobile-card-label">Area</span>
                <span className="mobile-card-value">{row.area}</span>
              </div>
              <div className="mobile-card-field">
                <span className="mobile-card-label">Mobile</span>
                <span className="mobile-card-value">{row.mobile_number}</span>
              </div>
              <div className="mobile-card-field">
                <span className="mobile-card-label">Issue Date</span>
                <span className="mobile-card-value">{formatDate(row.issue_date)}</span>
              </div>
              <div className="mobile-card-field">
                <span className="mobile-card-label">Maturity</span>
                <span className="mobile-card-value">{formatDate(row.maturity_date)}</span>
              </div>
              <div className="mobile-card-field">
                <span className="mobile-card-label">Issued</span>
                <span className="mobile-card-value">{formatAmount(row.issue_amount)}</span>
              </div>
              <div className="mobile-card-field">
                <span className="mobile-card-label">Collected</span>
                <span className="mobile-card-value">{formatAmount(row.collected_amount)}</span>
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
    <div style={{ fontSize: 22, fontWeight: 700, color: '#1f2937' }}>{value}</div>
  </div>
);

export default ActiveLoanPositionReport;
