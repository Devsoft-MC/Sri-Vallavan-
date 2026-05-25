import React, { useEffect, useMemo, useState } from 'react';
import API_BASE_URL from '../../api';

const today = new Date().toISOString().slice(0, 10);

const summaryColumns = [
  { key: 'customer_id', label: 'Customer ID' },
  { key: 'customer_name', label: 'Customer Name' },
  { key: 'mobile_number', label: 'Mobile Number' },
  { key: 'area', label: 'Area' },
  { key: 'total_loans', label: 'Total Loans', numeric: true },
  { key: 'closed_loans', label: 'Closed Loans', numeric: true },
  { key: 'on_time_closures', label: 'Closed On/Before Maturity', numeric: true },
  { key: 'late_closures', label: 'Closed After Maturity', numeric: true },
  { key: 'active_loans', label: 'Active Loans', numeric: true },
  { key: 'overdue_active_loans', label: 'Overdue Active', numeric: true },
  { key: 'total_issued', label: 'Issued Amount', numeric: true },
  { key: 'total_collected', label: 'Collected Amount', numeric: true },
  { key: 'balance_amount', label: 'Balance Amount', numeric: true },
  { key: 'repayment_percent', label: 'Repayment %', numeric: true },
  { key: 'on_time_closure_percent', label: 'On/Before Maturity %', numeric: true },
  { key: 'analysis_status', label: 'Status' },
];

const loanColumns = [
  { key: 'loan_id', label: 'Loan No' },
  { key: 'loan_type', label: 'Loan Type' },
  { key: 'issue_date', label: 'Issue Date', date: true },
  { key: 'maturity_date', label: 'Maturity Date', date: true },
  { key: 'closing_date', label: 'Closing Date', date: true },
  { key: 'issue_amount', label: 'Issue Amount', numeric: true },
  { key: 'collected_amount', label: 'Collected Amount', numeric: true },
  { key: 'balance_amount', label: 'Balance Amount', numeric: true },
  { key: 'loan_result', label: 'Loan Result' },
];

function normalizeDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
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

function formatDate(value) {
  const date = normalizeDate(value);
  if (!date) return '';
  const [year, month, day] = date.split('-');
  return `${day}-${month}-${year}`;
}

function formatPercent(value) {
  return `${toAmount(value).toFixed(1)}%`;
}

function formatNumber(value) {
  return toAmount(value).toLocaleString(undefined, { maximumFractionDigits: 1 });
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

function getAnalysisStatus(row) {
  if (row.total_loans === 0) return 'New Customer';
  if (row.closed_loans === 0) return row.overdue_active_loans > 0 ? 'Needs Review' : 'Monitor';
  if (row.on_time_closures === row.closed_loans) return 'Good';
  if (row.late_closures === row.closed_loans) return 'Needs Review';
  return 'Monitor';
}

function formatCell(row, column, forExcel = false) {
  const value = row[column.key];

  if (column.date) return forExcel ? normalizeDate(value) : formatDate(value);

  if (['total_issued', 'total_collected', 'balance_amount', 'issue_amount', 'collected_amount'].includes(column.key)) {
    return forExcel ? toAmount(value) : formatAmount(value);
  }

  if (['repayment_percent', 'on_time_closure_percent'].includes(column.key)) {
    return forExcel ? toAmount(value) : formatPercent(value);
  }

  if (column.numeric) return forExcel ? toAmount(value) : formatNumber(value);
  return value || '';
}

function getReportFileName(extension, customerId) {
  return `customer-analysis-${customerId || 'customer'}-${today}.${extension}`;
}

const CustomerAnalysisReport = () => {
  const [loans, setLoans] = useState([]);
  const [collections, setCollections] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
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
          fetch(`${API_BASE_URL}/api/collections?text=%25`),
          fetch(`${API_BASE_URL}/api/customers`),
        ]);

        if (!loansRes.ok || !collectionsRes.ok || !customersRes.ok) {
          throw new Error('Unable to load customer analysis data.');
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
          setError(err.message || 'Unable to load customer analysis data.');
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
  }, []);

  const customerOptions = useMemo(
    () => [...customers].sort((a, b) => String(a.customer_name || '').localeCompare(String(b.customer_name || ''))),
    [customers]
  );

  const reportRows = useMemo(() => {
    const customerMap = new Map(customers.map(customer => [customer.customer_id, customer]));
    const collectedByLoan = collections.reduce((map, collection) => {
      const currentAmount = map.get(collection.loan_id) || 0;
      map.set(collection.loan_id, currentAmount + toAmount(collection.collection_amount));
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
        loan_history: [],
      });
    });

    loans.forEach(loan => {
      const customer = customerMap.get(loan.customer_id) || {};
      if (!grouped.has(loan.customer_id)) {
        grouped.set(loan.customer_id, {
          customer_id: loan.customer_id,
          customer_name: loan.customer_name || '',
          mobile_number: '',
          area: '',
          total_loans: 0,
          closed_loans: 0,
          on_time_closures: 0,
          late_closures: 0,
          active_loans: 0,
          overdue_active_loans: 0,
          total_issued: 0,
          total_collected: 0,
          balance_amount: 0,
          loan_history: [],
        });
      }

      const row = grouped.get(loan.customer_id);
      row.customer_name = row.customer_name || loan.customer_name || customer.customer_name || '';
      row.mobile_number = row.mobile_number || customer.mobile_number || '';
      row.area = row.area || customer.area_name || customer.area || '';

      const issuedAmount = toAmount(loan.issue_amount);
      const collectedAmount = collectedByLoan.get(loan.loan_id) || 0;
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

      row.loan_history.push({
        loan_id: loan.loan_id,
        loan_type: loan.loan_type || '',
        issue_date: normalizeDate(loan.issue_date),
        maturity_date: maturityDate,
        closing_date: closingDate,
        issue_amount: issuedAmount,
        collected_amount: collectedAmount,
        balance_amount: balanceAmount,
        loan_result: loanResult,
      });
    });

    return Array.from(grouped.values()).map(row => {
      const repaymentPercent = row.total_issued > 0
        ? Math.min(100, (row.total_collected / row.total_issued) * 100)
        : 0;
      const onTimeClosurePercent = row.closed_loans > 0
        ? (row.on_time_closures / row.closed_loans) * 100
        : 0;
      const finalRow = {
        ...row,
        repayment_percent: repaymentPercent,
        on_time_closure_percent: onTimeClosurePercent,
        loan_history: [...row.loan_history].sort((a, b) => String(b.issue_date).localeCompare(String(a.issue_date))),
      };

      return {
        ...finalRow,
        analysis_status: getAnalysisStatus(finalRow),
      };
    });
  }, [collections, customers, loans]);

  const selectedRow = useMemo(
    () => reportRows.find(row => row.customer_id === selectedCustomerId) || null,
    [reportRows, selectedCustomerId]
  );

  const selectedRows = selectedRow ? [selectedRow] : [];
  const selectedLoanRows = selectedRow ? selectedRow.loan_history : [];

  const exportToExcel = async () => {
    if (!selectedRow) return;

    try {
      const XLSX = await import('xlsx');
      const summaryRows = selectedRows.map(row => summaryColumns.map(column => formatCell(row, column, true)));
      const loanRows = selectedLoanRows.map(row => loanColumns.map(column => formatCell(row, column, true)));
      const worksheet = XLSX.utils.aoa_to_sheet([
        ['Customer Analysis Report'],
        ['Customer', `${selectedRow.customer_id} - ${selectedRow.customer_name}`, 'Status', selectedRow.analysis_status],
        [],
        summaryColumns.map(column => column.label),
        ...summaryRows,
        [],
        ['Loan History'],
        loanColumns.map(column => column.label),
        ...loanRows,
      ]);

      worksheet['!cols'] = [...summaryColumns, ...loanColumns].slice(0, summaryColumns.length).map(column => ({ wch: column.numeric ? 18 : 22 }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Customer Analysis');
      XLSX.writeFile(workbook, getReportFileName('xlsx', selectedCustomerId));
    } catch (err) {
      setError(err.message || 'Unable to export Excel report.');
    }
  };

  const exportToPDF = async () => {
    if (!selectedRow) return;

    try {
      const jsPDFModule = await import('jspdf');
      const autoTableModule = await import('jspdf-autotable');
      const doc = new jsPDFModule.default({ orientation: 'landscape', unit: 'pt', format: 'a4' });

      doc.setFontSize(14);
      doc.text('Customer Analysis Report', 40, 36);
      doc.setFontSize(9);
      doc.text(`${selectedRow.customer_id} - ${selectedRow.customer_name}   Status: ${selectedRow.analysis_status}`, 40, 54);
      doc.text(
        `Loans: ${selectedRow.total_loans}   Closed On/Before Maturity: ${selectedRow.on_time_closures}   Closed After Maturity: ${selectedRow.late_closures}   Balance: ${formatAmount(selectedRow.balance_amount)}`,
        40,
        70
      );

      autoTableModule.default(doc, {
        startY: 88,
        head: [loanColumns.map(column => column.label)],
        body: selectedLoanRows.map(row => loanColumns.map(column => formatCell(row, column))),
        styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
        headStyles: { fillColor: [250, 251, 252], textColor: [31, 41, 55], fontStyle: 'bold' },
        margin: { left: 24, right: 24 },
      });

      doc.save(getReportFileName('pdf', selectedCustomerId));
    } catch (err) {
      setError(err.message || 'Unable to export PDF report.');
    }
  };

  return (
    <div>
      <h2 style={{ color: 'navy', margin: '0 0 18px' }}>Customer Analysis</h2>

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 18 }}>
        <label style={{ fontSize: 13, color: '#444' }}>
          Customer
          <select
            value={selectedCustomerId}
            onChange={event => setSelectedCustomerId(event.target.value)}
            style={{ display: 'block', marginTop: 4, padding: 7, fontSize: 13, width: 320 }}
          >
            <option value="">Select Customer</option>
            {customerOptions.map(customer => (
              <option key={customer.customer_id} value={customer.customer_id}>
                {customer.customer_id} - {customer.customer_name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setSelectedCustomerId('')}
          style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #cfd6e2', borderRadius: 4, background: '#fff', color: '#344054', cursor: 'pointer' }}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={exportToExcel}
          disabled={loading || !selectedRow}
          style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #157347', borderRadius: 4, background: loading || !selectedRow ? '#f2f4f7' : '#198754', color: loading || !selectedRow ? '#98a2b3' : '#fff', cursor: loading || !selectedRow ? 'not-allowed' : 'pointer' }}
        >
          Excel
        </button>
        <button
          type="button"
          onClick={exportToPDF}
          disabled={loading || !selectedRow}
          style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #b42318', borderRadius: 4, background: loading || !selectedRow ? '#f2f4f7' : '#d92d20', color: loading || !selectedRow ? '#98a2b3' : '#fff', cursor: loading || !selectedRow ? 'not-allowed' : 'pointer' }}
        >
          PDF
        </button>
      </div>

      {error && <div style={{ color: '#b00020', marginBottom: 12 }}>{error}</div>}

      {selectedRow && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(140px, 1fr))', gap: 12, marginBottom: 18 }}>
          <SummaryCard label="Status" value={selectedRow.analysis_status} />
          <SummaryCard label="Total Loans" value={selectedRow.total_loans.toLocaleString()} />
          <SummaryCard label="Closed On/Before" value={selectedRow.on_time_closures.toLocaleString()} />
          <SummaryCard label="Closed After" value={selectedRow.late_closures.toLocaleString()} />
          <SummaryCard label="Balance Amount" value={formatAmount(selectedRow.balance_amount)} />
        </div>
      )}

      <div className="desktop-table-wrap" style={{ overflowX: 'auto', background: '#fff', boxShadow: '0 1px 4px #eee', marginBottom: 18 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1550 }}>
          <thead>
            <tr>
              {summaryColumns.map(column => (
                <th key={column.key} style={{ padding: '8px 6px', borderBottom: '1px solid #ccc', textAlign: column.numeric ? 'right' : 'left', background: '#fafbfc', whiteSpace: 'nowrap' }}>
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={summaryColumns.length} style={{ padding: 12 }}>Loading...</td></tr>
            ) : !selectedRow ? (
              <tr><td colSpan={summaryColumns.length} style={{ padding: 12 }}>No customer selected.</td></tr>
            ) : selectedRows.map(row => (
              <tr key={row.customer_id}>
                {summaryColumns.map(column => (
                  <td key={column.key} style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: column.numeric ? 'right' : 'left' }}>
                    {formatCell(row, column)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="desktop-table-wrap" style={{ overflowX: 'auto', background: '#fff', boxShadow: '0 1px 4px #eee' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1050 }}>
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
            ) : !selectedRow ? (
              <tr><td colSpan={loanColumns.length} style={{ padding: 12 }}>No customer selected.</td></tr>
            ) : selectedLoanRows.length === 0 ? (
              <tr><td colSpan={loanColumns.length} style={{ padding: 12 }}>No loans found for this customer.</td></tr>
            ) : selectedLoanRows.map(row => (
              <tr key={row.loan_id}>
                {loanColumns.map(column => (
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
        ) : !selectedRow ? (
          <div className="mobile-record-card">No customer selected.</div>
        ) : (
          <div className="mobile-record-card" key={selectedRow.customer_id}>
            <div className="mobile-card-title">
              <div>
                {selectedRow.customer_name || 'Customer'}
                <div className="mobile-card-subtitle">Customer {selectedRow.customer_id} · {selectedRow.mobile_number}</div>
              </div>
              <span className="mobile-badge">{selectedRow.analysis_status}</span>
            </div>
            <div className="mobile-card-grid">
              <div className="mobile-card-field">
                <span className="mobile-card-label">Total Loans</span>
                <span className="mobile-card-value">{selectedRow.total_loans}</span>
              </div>
              <div className="mobile-card-field">
                <span className="mobile-card-label">On/Before</span>
                <span className="mobile-card-value">{selectedRow.on_time_closures}</span>
              </div>
              <div className="mobile-card-field">
                <span className="mobile-card-label">After Maturity</span>
                <span className="mobile-card-value">{selectedRow.late_closures}</span>
              </div>
              <div className="mobile-card-field">
                <span className="mobile-card-label">Repayment</span>
                <span className="mobile-card-value">{formatPercent(selectedRow.repayment_percent)}</span>
              </div>
              <div className="mobile-card-field full">
                <span className="mobile-card-label">Balance</span>
                <span className="mobile-card-value">{formatAmount(selectedRow.balance_amount)}</span>
              </div>
            </div>
          </div>
        )}
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

export default CustomerAnalysisReport;
