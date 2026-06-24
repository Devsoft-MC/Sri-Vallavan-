import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import API_BASE_URL from '../../api';
import useIsMobile from '../../hooks/useIsMobile';

const today = new Date().toISOString().slice(0, 10);
const MOBILE_RECEIPT_LIMIT = 50;
const MOBILE_LOOKUP_LIMIT = 100;

function formatAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0.00';
}

function formatDate(value) {
  const date = value ? String(value).slice(0, 10) : '';
  if (!date) return '';
  const [year, month, day] = date.split('-');
  return `${day}-${month}-${year}`;
}

const initialForm = {
  loan_id: '',
  income_type_id: '',
  income_date: today,
  amount: '',
  received_by: '',
  notes: '',
};

const LoanIncome = () => {
  const isMobile = useIsMobile();
  const [customers, setCustomers] = useState([]);
  const [loans, setLoans] = useState([]);
  const [incomeTypes, setIncomeTypes] = useState([]);
  const [entries, setEntries] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedLoanId, setSelectedLoanId] = useState('');
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filterText, setFilterText] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const customerOptions = useMemo(
    () => customers.map(customer => ({
      value: customer.customer_id,
      label: `${customer.customer_id} - ${customer.customer_name || ''}`.trim(),
    })),
    [customers]
  );

  const visibleLoans = useMemo(
    () => selectedCustomerId
      ? loans.filter(loan => loan.customer_id === selectedCustomerId)
      : loans,
    [loans, selectedCustomerId]
  );

  const loanOptions = useMemo(
    () => visibleLoans.map(loan => ({
      value: loan.loan_id,
      label: `${loan.loan_id} - ${loan.customer_name || loan.customer_id || ''} (${loan.loan_type || 'Loan'})`,
    })),
    [visibleLoans]
  );

  const selectedCustomerOption = customerOptions.find(option => option.value === selectedCustomerId) || null;
  const selectedLoanOption = loanOptions.find(option => option.value === selectedLoanId) || null;
  const selectedIncomeType = incomeTypes.find(type => String(type.income_type_id) === String(form.income_type_id)) || null;
  const requiresLoan = selectedIncomeType?.requires_loan === true;

  const filteredEntries = useMemo(() => {
    const text = filterText.trim().toLowerCase();
    return entries.filter(entry => {
      if (!text) return true;
      return [
        entry.loan_id,
        entry.customer_id,
        entry.customer_name,
        entry.income_type_name,
        entry.income_date,
        entry.amount,
        entry.received_by,
        entry.notes,
      ].some(value => String(value || '').toLowerCase().includes(text));
    });
  }, [entries, filterText]);

  const totalIncome = filteredEntries.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (selectedLoanId) params.set('loan_id', selectedLoanId);
      else if (selectedCustomerId) params.set('customer_id', selectedCustomerId);
      if (isMobile) {
        params.set('limit', String(MOBILE_RECEIPT_LIMIT));
        if (fromDate) params.set('from', fromDate);
        if (toDate) params.set('to', toDate);
        if (filterText.trim()) params.set('text', filterText.trim());
      }

      const [customersRes, loansRes, incomeTypesRes, entriesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/customers${isMobile ? `?limit=${MOBILE_LOOKUP_LIMIT}` : ''}`),
        fetch(`${API_BASE_URL}/api/loans${isMobile ? `?limit=${MOBILE_LOOKUP_LIMIT}` : ''}`),
        fetch(`${API_BASE_URL}/api/income-types`),
        fetch(`${API_BASE_URL}/api/loan-income${params.toString() ? `?${params}` : ''}`),
      ]);

      if (!customersRes.ok || !loansRes.ok || !incomeTypesRes.ok || !entriesRes.ok) {
        throw new Error('Unable to load receipts.');
      }

      const [customerData, loanData, incomeTypeData, entryData] = await Promise.all([
        customersRes.json(),
        loansRes.json(),
        incomeTypesRes.json(),
        entriesRes.json(),
      ]);

      setCustomers(Array.isArray(customerData) ? customerData : []);
      setLoans(Array.isArray(loanData) ? loanData : []);
      setIncomeTypes(Array.isArray(incomeTypeData) ? incomeTypeData.filter(type => type.is_active !== false) : []);
      setEntries(Array.isArray(entryData) ? entryData : []);
    } catch (err) {
      setError(err.message || 'Unable to load receipts.');
    } finally {
      setLoading(false);
    }
  }, [filterText, fromDate, isMobile, selectedCustomerId, selectedLoanId, toDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCustomerChange = option => {
    const customerId = option ? option.value : '';
    setSelectedCustomerId(customerId);
    setSelectedLoanId('');
    setSelectedEntry(null);
    setForm(current => ({ ...current, loan_id: '' }));
  };

  const handleLoanChange = option => {
    const loanId = option ? option.value : '';
    const loan = loans.find(item => item.loan_id === loanId);
    setSelectedLoanId(loanId);
    setSelectedEntry(null);
    setForm(current => ({
      ...current,
      loan_id: loanId,
    }));
    if (loan?.customer_id) setSelectedCustomerId(loan.customer_id);
  };

  const handleChange = event => {
    const { name, value } = event.target;
    setForm(current => ({ ...current, [name]: value }));
  };

  const selectEntry = entry => {
    setSelectedEntry(entry);
    setSelectedLoanId(entry.loan_id || '');
    setSelectedCustomerId(entry.customer_id || '');
    setForm({
      loan_id: entry.loan_id || '',
      income_type_id: entry.income_type_id || '',
      income_date: entry.income_date ? String(entry.income_date).slice(0, 10) : today,
      amount: entry.amount || '',
      received_by: entry.received_by || '',
      notes: entry.notes || '',
    });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        ...form,
        loan_id: form.loan_id || selectedLoanId || '',
        income_type_id: form.income_type_id,
        amount: form.amount,
      };

      const url = selectedEntry
        ? `${API_BASE_URL}/api/loan-income/${selectedEntry.loan_income_id}`
        : `${API_BASE_URL}/api/loan-income`;
      const res = await fetch(url, {
        method: selectedEntry ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unable to save receipt.');

      setSelectedEntry(null);
      setSuccess(selectedEntry ? 'Receipt updated.' : 'Receipt saved.');
      setForm({ ...initialForm, loan_id: selectedLoanId || '' });
      await loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Unable to save receipt.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEntry) return;
    if (!window.confirm(`Delete receipt ${selectedEntry.loan_income_id}?`)) return;

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/loan-income/${selectedEntry.loan_income_id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unable to delete receipt.');

      setSelectedEntry(null);
      setSuccess('Receipt deleted.');
      await loadData();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      setError(err.message || 'Unable to delete receipt.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ color: 'navy', margin: '0 0 18px' }}>Receipts</h2>

      <form className="mobile-data-form" onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, alignItems: 'end', marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: '#444' }}>
          Customer
          <Select
            options={customerOptions}
            value={selectedCustomerOption}
            onChange={handleCustomerChange}
            placeholder="Select customer"
            isClearable
            isSearchable
            styles={{
              container: base => ({ ...base, marginTop: 4 }),
              control: base => ({ ...base, minHeight: 34, fontSize: 13 }),
              menu: base => ({ ...base, zIndex: 20 }),
            }}
          />
        </label>

        <label style={{ fontSize: 13, color: '#444' }}>
          Loan {requiresLoan ? '' : '(Optional)'}
          <Select
            options={loanOptions}
            value={selectedLoanOption}
            onChange={handleLoanChange}
            placeholder="Select loan"
            isClearable
            isSearchable
            styles={{
              container: base => ({ ...base, marginTop: 4 }),
              control: base => ({ ...base, minHeight: 34, fontSize: 13 }),
              menu: base => ({ ...base, zIndex: 20 }),
            }}
          />
        </label>

        <label style={{ fontSize: 13, color: '#444' }}>
          Receipt Type
          <select name="income_type_id" value={form.income_type_id} onChange={handleChange} required style={{ display: 'block', marginTop: 4, padding: 7, width: '100%', fontSize: 13 }}>
            <option value="">Select type</option>
            {incomeTypes.map(type => (
              <option key={type.income_type_id} value={type.income_type_id}>{type.income_type_name}</option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 13, color: '#444' }}>
          Date
          <input name="income_date" type="date" value={form.income_date} onChange={handleChange} required style={{ display: 'block', marginTop: 4, padding: 7, width: '100%', fontSize: 13 }} />
        </label>

        <label style={{ fontSize: 13, color: '#444' }}>
          Amount
          <input name="amount" type="number" min="0" step="0.01" value={form.amount} onChange={handleChange} required style={{ display: 'block', marginTop: 4, padding: 7, width: '100%', fontSize: 13 }} />
        </label>

        <label style={{ fontSize: 13, color: '#444' }}>
          Received By
          <input name="received_by" value={form.received_by} onChange={handleChange} placeholder="Defaults to login user" style={{ display: 'block', marginTop: 4, padding: 7, width: '100%', fontSize: 13 }} />
        </label>

        <label style={{ fontSize: 13, color: '#444', gridColumn: 'span 2' }}>
          Notes
          <input name="notes" value={form.notes} onChange={handleChange} style={{ display: 'block', marginTop: 4, padding: 7, width: '100%', fontSize: 13 }} />
        </label>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="submit" disabled={saving || (requiresLoan && !form.loan_id)} style={{ padding: '8px 16px', fontSize: 13, border: 'none', borderRadius: 4, background: saving || (requiresLoan && !form.loan_id) ? '#98a2b3' : '#1976d2', color: '#fff', cursor: saving || (requiresLoan && !form.loan_id) ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : 'Save Receipt'}
          </button>
          <button type="button" onClick={handleDelete} disabled={saving || !selectedEntry} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #b42318', borderRadius: 4, background: saving || !selectedEntry ? '#f2f4f7' : '#d92d20', color: saving || !selectedEntry ? '#98a2b3' : '#fff', cursor: saving || !selectedEntry ? 'not-allowed' : 'pointer' }}>
            Delete
          </button>
        </div>
      </form>

      <div className="mobile-toolbar" style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 14, color: '#555' }}>{filteredEntries.length} entries</span>
        <span style={{ fontSize: 14, color: '#1f2937', fontWeight: 700 }}>Total {formatAmount(totalIncome)}</span>
        {isMobile && (
          <>
            <input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} aria-label="Receipt from date" style={{ padding: 7, minWidth: 150, fontSize: 13 }} />
            <input type="date" value={toDate} onChange={event => setToDate(event.target.value)} aria-label="Receipt to date" style={{ padding: 7, minWidth: 150, fontSize: 13 }} />
          </>
        )}
        <input value={filterText} onChange={event => setFilterText(event.target.value)} placeholder="Filter by any field" style={{ padding: 7, minWidth: 220, fontSize: 13 }} />
        <button type="button" onClick={loadData} style={{ padding: '7px 14px', fontSize: 13, background: '#fff', border: '1px solid #cfd6e2', borderRadius: 4, cursor: 'pointer' }}>Refresh</button>
      </div>

      {error && <div style={{ color: '#b42318', marginBottom: 12 }}>{error}</div>}
      {success && <div style={{ color: '#067647', marginBottom: 12, fontWeight: 600 }}>{success}</div>}

      <div className="desktop-table-wrap">
        <table className="fixed-header-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', boxShadow: '0 1px 4px #eee' }}>
          <thead>
            <tr>
              {['Date', 'Loan', 'Customer', 'Type', 'Amount', 'Received By', 'Notes'].map(label => (
                <th key={label} style={{ padding: '7px 6px', borderBottom: '1px solid #ccc', textAlign: label === 'Amount' ? 'right' : 'left', background: '#fafbfc' }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 12 }}>Loading...</td></tr>
            ) : filteredEntries.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 12 }}>No receipts found.</td></tr>
            ) : filteredEntries.map(entry => (
              <tr
                key={entry.loan_income_id}
                className={selectedEntry?.loan_income_id === entry.loan_income_id ? 'selected-record-row' : undefined}
                onClick={() => selectEntry(entry)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{formatDate(entry.income_date)}</td>
                <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{entry.loan_id || ''}</td>
                <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{entry.customer_name || entry.customer_id}</td>
                <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{entry.income_type_name}</td>
                <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatAmount(entry.amount)}</td>
                <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{entry.received_by || ''}</td>
                <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{entry.notes || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-card-list">
        {loading ? (
          <div className="mobile-record-card">Loading...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="mobile-record-card">No receipts found.</div>
        ) : filteredEntries.map(entry => (
          <div
            key={entry.loan_income_id}
            className={`mobile-record-card ${selectedEntry?.loan_income_id === entry.loan_income_id ? 'selected' : ''}`}
            onClick={() => selectEntry(entry)}
          >
            <div className="mobile-card-title">
              <div>
                {entry.customer_name || entry.customer_id}
                <div className="mobile-card-subtitle">{entry.loan_id ? `Loan ${entry.loan_id} · ` : ''}{formatDate(entry.income_date)}</div>
              </div>
              <span className="mobile-badge">{entry.income_type_name}</span>
            </div>
            <div className="mobile-card-grid">
              <div className="mobile-card-field">
                <span className="mobile-card-label">Amount</span>
                <span className="mobile-card-value">{formatAmount(entry.amount)}</span>
              </div>
              <div className="mobile-card-field">
                <span className="mobile-card-label">Received By</span>
                <span className="mobile-card-value">{entry.received_by || ''}</span>
              </div>
              {entry.notes && (
                <div className="mobile-card-field full">
                  <span className="mobile-card-label">Notes</span>
                  <span className="mobile-card-value">{entry.notes}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LoanIncome;
