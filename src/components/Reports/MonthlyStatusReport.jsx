import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
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

function monthKey(value) {
  return normalizeDate(value).slice(0, 7);
}

const MonthlyStatusReport = () => {
  const [receipts, setReceipts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [receiptTypes, setReceiptTypes] = useState([]);
  const [paymentTypes, setPaymentTypes] = useState([]);
  const [fromDate, setFromDate] = useState(firstDayOfYear);
  const [toDate, setToDate] = useState(today);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [viewMode, setViewMode] = useState('summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);

      const [receiptsRes, paymentsRes, receiptTypesRes, paymentTypesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/loan-income${params.toString() ? `?${params}` : ''}`),
        fetch(`${API_BASE_URL}/api/expenses${params.toString() ? `?${params}` : ''}`),
        fetch(`${API_BASE_URL}/api/income-types`),
        fetch(`${API_BASE_URL}/api/expense-types`),
      ]);

      const [receiptData, paymentData, receiptTypeData, paymentTypeData] = await Promise.all([
        receiptsRes.json().catch(() => []),
        paymentsRes.json().catch(() => []),
        receiptTypesRes.json().catch(() => []),
        paymentTypesRes.json().catch(() => []),
      ]);

      if (!receiptsRes.ok || !paymentsRes.ok || !receiptTypesRes.ok || !paymentTypesRes.ok) {
        throw new Error(receiptData.error || paymentData.error || receiptTypeData.error || paymentTypeData.error || 'Unable to load monthly status.');
      }

      setReceipts(Array.isArray(receiptData) ? receiptData : []);
      setPayments(Array.isArray(paymentData) ? paymentData : []);
      setReceiptTypes(Array.isArray(receiptTypeData) ? receiptTypeData : []);
      setPaymentTypes(Array.isArray(paymentTypeData) ? paymentTypeData : []);
    } catch (err) {
      setError(err.message || 'Unable to load monthly status.');
      setReceipts([]);
      setPayments([]);
      setReceiptTypes([]);
      setPaymentTypes([]);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const receiptTypeMap = useMemo(
    () => new Map(receiptTypes.map(type => [String(type.income_type_id), type])),
    [receiptTypes]
  );

  const paymentTypeMap = useMemo(
    () => new Map(paymentTypes.map(type => [String(type.expense_type_id), type])),
    [paymentTypes]
  );

  const profitReceipts = useMemo(
    () => receipts
      .map(entry => ({
        ...entry,
        income_date: normalizeDate(entry.income_date),
        type: receiptTypeMap.get(String(entry.income_type_id)),
      }))
      .filter(entry => entry.type?.affects_profit === true),
    [receiptTypeMap, receipts]
  );

  const profitPayments = useMemo(
    () => payments
      .map(entry => ({
        ...entry,
        expense_date: normalizeDate(entry.expense_date),
        type: paymentTypeMap.get(String(entry.expense_type_id)),
      }))
      .filter(entry => entry.type?.affects_profit === true),
    [paymentTypeMap, payments]
  );

  const monthlyRows = useMemo(() => {
    const rows = new Map();

    profitReceipts.forEach(entry => {
      const month = monthKey(entry.income_date);
      if (!month) return;
      const row = rows.get(month) || { month, income: 0, expenditure: 0, incomeEntries: 0, expenditureEntries: 0 };
      row.income += toAmount(entry.amount);
      row.incomeEntries += 1;
      rows.set(month, row);
    });

    profitPayments.forEach(entry => {
      const month = monthKey(entry.expense_date);
      if (!month) return;
      const row = rows.get(month) || { month, income: 0, expenditure: 0, incomeEntries: 0, expenditureEntries: 0 };
      row.expenditure += toAmount(entry.amount);
      row.expenditureEntries += 1;
      rows.set(month, row);
    });

    return Array.from(rows.values())
      .map(row => ({ ...row, profit: row.income - row.expenditure }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [profitPayments, profitReceipts]);

  const activeMonth = selectedMonth || monthlyRows[0]?.month || '';

  const incomeBreakdown = useMemo(() => {
    const rows = new Map();
    profitReceipts
      .filter(entry => !activeMonth || monthKey(entry.income_date) === activeMonth)
      .forEach(entry => {
        const typeName = entry.income_type_name || entry.type?.income_type_name || 'Receipt';
        const row = rows.get(typeName) || { typeName, entries: 0, amount: 0 };
        row.entries += 1;
        row.amount += toAmount(entry.amount);
        rows.set(typeName, row);
      });
    return Array.from(rows.values()).sort((a, b) => b.amount - a.amount || a.typeName.localeCompare(b.typeName));
  }, [activeMonth, profitReceipts]);

  const expenditureBreakdown = useMemo(() => {
    const rows = new Map();
    profitPayments
      .filter(entry => !activeMonth || monthKey(entry.expense_date) === activeMonth)
      .forEach(entry => {
        const typeName = entry.expense_type_name || entry.type?.expense_type_name || 'Payment';
        const row = rows.get(typeName) || { typeName, entries: 0, amount: 0 };
        row.entries += 1;
        row.amount += toAmount(entry.amount);
        rows.set(typeName, row);
      });
    return Array.from(rows.values()).sort((a, b) => b.amount - a.amount || a.typeName.localeCompare(b.typeName));
  }, [activeMonth, profitPayments]);

  const detailRows = useMemo(() => {
    const incomeRows = profitReceipts
      .filter(entry => !activeMonth || monthKey(entry.income_date) === activeMonth)
      .map(entry => ({
        id: `receipt-${entry.loan_income_id}`,
        date: entry.income_date,
        side: 'Income',
        typeName: entry.income_type_name || entry.type?.income_type_name || '',
        amount: toAmount(entry.amount),
        person: entry.customer_name || entry.customer_id || entry.received_by || '',
        notes: entry.notes || '',
      }));

    const expenditureRows = profitPayments
      .filter(entry => !activeMonth || monthKey(entry.expense_date) === activeMonth)
      .map(entry => ({
        id: `payment-${entry.expense_id}`,
        date: entry.expense_date,
        side: 'Expenditure',
        typeName: entry.expense_type_name || entry.type?.expense_type_name || '',
        amount: toAmount(entry.amount),
        person: entry.paid_to || entry.paid_by || '',
        notes: entry.notes || '',
      }));

    return [...incomeRows, ...expenditureRows]
      .sort((a, b) => b.date.localeCompare(a.date) || a.side.localeCompare(b.side));
  }, [activeMonth, profitPayments, profitReceipts]);

  const totals = monthlyRows.reduce(
    (sum, row) => ({
      income: sum.income + row.income,
      expenditure: sum.expenditure + row.expenditure,
      profit: sum.profit + row.profit,
    }),
    { income: 0, expenditure: 0, profit: 0 }
  );

  const selectedSummary = monthlyRows.find(row => row.month === activeMonth) || { income: 0, expenditure: 0, profit: 0 };

  const exportToExcel = () => {
    const workbook = XLSX.utils.book_new();

    const summarySheet = XLSX.utils.json_to_sheet(monthlyRows.map(row => ({
      Month: formatMonth(row.month),
      Income: Number(row.income.toFixed(2)),
      Expenditure: Number(row.expenditure.toFixed(2)),
      'Profit / Loss': Number(row.profit.toFixed(2)),
      'Income Entries': row.incomeEntries,
      'Payment Entries': row.expenditureEntries,
    })));
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Monthly Summary');

    const incomeSheet = XLSX.utils.json_to_sheet(incomeBreakdown.map(row => ({
      Month: formatMonth(activeMonth),
      Type: row.typeName,
      Entries: row.entries,
      Amount: Number(row.amount.toFixed(2)),
    })));
    XLSX.utils.book_append_sheet(workbook, incomeSheet, 'Income');

    const expenditureSheet = XLSX.utils.json_to_sheet(expenditureBreakdown.map(row => ({
      Month: formatMonth(activeMonth),
      Type: row.typeName,
      Entries: row.entries,
      Amount: Number(row.amount.toFixed(2)),
    })));
    XLSX.utils.book_append_sheet(workbook, expenditureSheet, 'Expenditure');

    const detailsSheet = XLSX.utils.json_to_sheet(detailRows.map(row => ({
      Date: formatDate(row.date),
      Side: row.side,
      Type: row.typeName,
      Name: row.person,
      Amount: Number(row.amount.toFixed(2)),
      Notes: row.notes,
    })));
    XLSX.utils.book_append_sheet(workbook, detailsSheet, 'Details');

    const fileMonth = activeMonth || `${fromDate}_to_${toDate}`;
    XLSX.writeFile(workbook, `monthly_status_${fileMonth}.xlsx`);
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ color: 'navy', margin: '0 0 18px' }}>Monthly Status</h2>

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
          Month
          <select value={activeMonth} onChange={event => setSelectedMonth(event.target.value)} style={{ display: 'block', marginTop: 4, padding: 7, width: '100%', fontSize: 13 }}>
            {monthlyRows.length === 0 ? <option value="">No month</option> : monthlyRows.map(row => (
              <option key={row.month} value={row.month}>{formatMonth(row.month)}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 13, color: '#444' }}>
          View
          <select value={viewMode} onChange={event => setViewMode(event.target.value)} style={{ display: 'block', marginTop: 4, padding: 7, width: '100%', fontSize: 13 }}>
            <option value="summary">Monthly Summary</option>
            <option value="breakdown">Income & Expenditure</option>
            <option value="details">Detailed Entries</option>
          </select>
        </label>
        <button type="button" onClick={loadReport} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #cfd6e2', borderRadius: 4, background: '#fff', color: '#344054', cursor: 'pointer' }}>Refresh</button>
        <button type="button" onClick={exportToExcel} disabled={loading || monthlyRows.length === 0} style={{ padding: '8px 16px', fontSize: 13, border: 'none', borderRadius: 4, background: loading || monthlyRows.length === 0 ? '#98a2b3' : '#1976d2', color: '#fff', cursor: loading || monthlyRows.length === 0 ? 'not-allowed' : 'pointer' }}>Export Excel</button>
      </div>

      <div className="mobile-toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 14, color: '#1f2937', fontWeight: 700 }}>Income {formatAmount(viewMode === 'summary' ? totals.income : selectedSummary.income)}</span>
        <span style={{ fontSize: 14, color: '#1f2937', fontWeight: 700 }}>Expenditure {formatAmount(viewMode === 'summary' ? totals.expenditure : selectedSummary.expenditure)}</span>
        <span style={{ fontSize: 14, color: (viewMode === 'summary' ? totals.profit : selectedSummary.profit) >= 0 ? '#067647' : '#b42318', fontWeight: 700 }}>
          {(viewMode === 'summary' ? totals.profit : selectedSummary.profit) >= 0 ? 'Profit' : 'Loss'} {formatAmount(Math.abs(viewMode === 'summary' ? totals.profit : selectedSummary.profit))}
        </span>
      </div>

      {error && <div style={{ color: '#b42318', marginBottom: 12 }}>{error}</div>}

      <div className="desktop-table-wrap">
        {viewMode === 'summary' && (
          <table className="fixed-header-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', boxShadow: '0 1px 4px #eee' }}>
            <thead>
              <tr>
                {['Month', 'Income', 'Expenditure', 'Profit / Loss'].map(label => (
                  <th key={label} style={{ padding: '7px 6px', borderBottom: '1px solid #ccc', textAlign: label === 'Month' ? 'left' : 'right', background: '#fafbfc' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ padding: 12 }}>Loading...</td></tr>
              ) : monthlyRows.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: 12 }}>No monthly status found.</td></tr>
              ) : monthlyRows.map(row => (
                <tr key={row.month} onClick={() => { setSelectedMonth(row.month); setViewMode('breakdown'); }} style={{ cursor: 'pointer' }}>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{formatMonth(row.month)}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatAmount(row.income)}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatAmount(row.expenditure)}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right', color: row.profit >= 0 ? '#067647' : '#b42318', fontWeight: 700 }}>{row.profit >= 0 ? formatAmount(row.profit) : `-${formatAmount(Math.abs(row.profit))}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {viewMode === 'breakdown' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
            <BreakdownTable title="Income" rows={incomeBreakdown} total={selectedSummary.income} />
            <BreakdownTable title="Expenditure" rows={expenditureBreakdown} total={selectedSummary.expenditure} />
          </div>
        )}

        {viewMode === 'details' && (
          <table className="fixed-header-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', boxShadow: '0 1px 4px #eee' }}>
            <thead>
              <tr>
                {['Date', 'Side', 'Type', 'Name', 'Amount', 'Notes'].map(label => (
                  <th key={label} style={{ padding: '7px 6px', borderBottom: '1px solid #ccc', textAlign: label === 'Amount' ? 'right' : 'left', background: '#fafbfc' }}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 12 }}>Loading...</td></tr>
              ) : detailRows.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 12 }}>No entries found.</td></tr>
              ) : detailRows.map(row => (
                <tr key={row.id}>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{formatDate(row.date)}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{row.side}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{row.typeName}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{row.person}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatAmount(row.amount)}</td>
                  <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{row.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="mobile-card-list">
        {(viewMode === 'summary' ? monthlyRows : detailRows).map(row => (
          <div key={viewMode === 'summary' ? row.month : row.id} className="mobile-record-card">
            {viewMode === 'summary' ? (
              <div className="mobile-card-title">
                <div>
                  {formatMonth(row.month)}
                  <div className="mobile-card-subtitle">Income {formatAmount(row.income)} · Expenditure {formatAmount(row.expenditure)}</div>
                </div>
                <span className="mobile-badge">{row.profit >= 0 ? 'Profit' : 'Loss'} {formatAmount(Math.abs(row.profit))}</span>
              </div>
            ) : (
              <div className="mobile-card-title">
                <div>
                  {row.typeName}
                  <div className="mobile-card-subtitle">{row.side} · {formatDate(row.date)}</div>
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

const BreakdownTable = ({ title, rows, total }) => (
  <table style={{ width: '100%', minWidth: 0, tableLayout: 'fixed', borderCollapse: 'collapse', fontSize: 13, background: '#fff', boxShadow: '0 1px 4px #eee' }}>
    <colgroup>
      <col />
      <col style={{ width: 150 }} />
    </colgroup>
    <thead>
      <tr>
        <th style={{ padding: '7px 6px', borderBottom: '1px solid #ccc', textAlign: 'left', background: '#fafbfc' }}>{title}</th>
        <th style={{ padding: '7px 6px', borderBottom: '1px solid #ccc', textAlign: 'right', background: '#fafbfc' }}>Amount</th>
      </tr>
    </thead>
    <tbody>
      {rows.length === 0 ? (
        <tr><td colSpan={2} style={{ padding: 12 }}>No records found.</td></tr>
      ) : rows.map(row => (
        <tr key={row.typeName}>
          <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{row.typeName}</td>
          <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatAmount(row.amount)}</td>
        </tr>
      ))}
      <tr>
        <td style={{ padding: '7px 6px', borderTop: '1px solid #ccc', fontWeight: 700 }}>Total</td>
        <td style={{ padding: '7px 6px', borderTop: '1px solid #ccc', textAlign: 'right', fontWeight: 700 }}>{formatAmount(total)}</td>
      </tr>
    </tbody>
  </table>
);

export default MonthlyStatusReport;
