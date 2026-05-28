import React, { useCallback, useEffect, useMemo, useState } from 'react';
import API_BASE_URL from '../../api';

const today = new Date().toISOString().slice(0, 10);
const paymentModes = ['Cash', 'Bank Transfer', 'UPI', 'Cheque', 'Card', 'Other'];

const initialForm = {
  expense_date: today,
  expense_type_id: '',
  amount: '',
  paid_to: '',
  paid_by: '',
  payment_mode: '',
  notes: '',
};

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

const Expenses = () => {
  const [expenseTypes, setExpenseTypes] = useState([]);
  const [entries, setEntries] = useState([]);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [filterText, setFilterText] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const activeExpenseTypes = useMemo(
    () => expenseTypes.filter(type => type.is_active !== false),
    [expenseTypes]
  );

  const filteredEntries = useMemo(() => {
    const text = filterText.trim().toLowerCase();
    return entries.filter(entry => {
      if (!text) return true;
      return [
        entry.expense_type_name,
        entry.expense_date,
        entry.amount,
        entry.paid_to,
        entry.paid_by,
        entry.payment_mode,
        entry.notes,
      ].some(value => String(value || '').toLowerCase().includes(text));
    });
  }, [entries, filterText]);

  const totalExpense = filteredEntries.reduce((sum, entry) => sum + (Number(entry.amount) || 0), 0);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (fromDate) params.set('from', fromDate);
      if (toDate) params.set('to', toDate);
      if (typeFilter) params.set('expense_type_id', typeFilter);

      const [typesRes, expensesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/expense-types`),
        fetch(`${API_BASE_URL}/api/expenses${params.toString() ? `?${params}` : ''}`),
      ]);

      const [typeData, expenseData] = await Promise.all([
        typesRes.json().catch(() => []),
        expensesRes.json().catch(() => []),
      ]);

      if (!typesRes.ok || !expensesRes.ok) {
        throw new Error(typeData.error || expenseData.error || 'Unable to load expenses.');
      }

      setExpenseTypes(Array.isArray(typeData) ? typeData : []);
      setEntries(Array.isArray(expenseData) ? expenseData : []);
    } catch (err) {
      setError(err.message || 'Unable to load expenses.');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, typeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleChange = event => {
    const { name, value } = event.target;
    setForm(current => ({ ...current, [name]: value }));
  };

  const resetForm = () => {
    setSelectedEntry(null);
    setForm(initialForm);
    setError('');
  };

  const selectEntry = entry => {
    setSelectedEntry(entry);
    setForm({
      expense_date: entry.expense_date ? String(entry.expense_date).slice(0, 10) : today,
      expense_type_id: entry.expense_type_id || '',
      amount: entry.amount || '',
      paid_to: entry.paid_to || '',
      paid_by: entry.paid_by || '',
      payment_mode: entry.payment_mode || '',
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
      const url = selectedEntry
        ? `${API_BASE_URL}/api/expenses/${selectedEntry.expense_id}`
        : `${API_BASE_URL}/api/expenses`;
      const res = await fetch(url, {
        method: selectedEntry ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unable to save expense.');

      setSuccess(selectedEntry ? 'Expense updated.' : 'Expense saved.');
      resetForm();
      await loadData();
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || 'Unable to save expense.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEntry) return;
    if (!window.confirm(`Delete expense ${selectedEntry.expense_id}?`)) return;

    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/expenses/${selectedEntry.expense_id}`, {
        method: 'DELETE',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unable to delete expense.');

      setSuccess('Expense deleted.');
      resetForm();
      await loadData();
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || 'Unable to delete expense.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ color: 'navy', margin: '0 0 18px' }}>Expenses</h2>

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end', marginBottom: 16 }}>
        <label style={{ fontSize: 13, color: '#444' }}>
          Date
          <input name="expense_date" type="date" value={form.expense_date} onChange={handleChange} required style={{ display: 'block', marginTop: 4, padding: 7, width: '100%', fontSize: 13 }} />
        </label>
        <label style={{ fontSize: 13, color: '#444' }}>
          Expense Type
          <select name="expense_type_id" value={form.expense_type_id} onChange={handleChange} required style={{ display: 'block', marginTop: 4, padding: 7, width: '100%', fontSize: 13 }}>
            <option value="">Select type</option>
            {activeExpenseTypes.map(type => (
              <option key={type.expense_type_id} value={type.expense_type_id}>{type.expense_type_name}</option>
            ))}
          </select>
        </label>
        <label style={{ fontSize: 13, color: '#444' }}>
          Amount
          <input name="amount" type="number" min="0" step="0.01" value={form.amount} onChange={handleChange} required style={{ display: 'block', marginTop: 4, padding: 7, width: '100%', fontSize: 13 }} />
        </label>
        <label style={{ fontSize: 13, color: '#444' }}>
          Paid To
          <input name="paid_to" value={form.paid_to} onChange={handleChange} style={{ display: 'block', marginTop: 4, padding: 7, width: '100%', fontSize: 13 }} />
        </label>
        <label style={{ fontSize: 13, color: '#444' }}>
          Paid By
          <input name="paid_by" value={form.paid_by} onChange={handleChange} placeholder="Defaults to login user" style={{ display: 'block', marginTop: 4, padding: 7, width: '100%', fontSize: 13 }} />
        </label>
        <label style={{ fontSize: 13, color: '#444' }}>
          Payment Mode
          <select name="payment_mode" value={form.payment_mode} onChange={handleChange} style={{ display: 'block', marginTop: 4, padding: 7, width: '100%', fontSize: 13 }}>
            <option value="">Select mode</option>
            {paymentModes.map(mode => <option key={mode} value={mode}>{mode}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13, color: '#444', gridColumn: 'span 2' }}>
          Notes
          <input name="notes" value={form.notes} onChange={handleChange} style={{ display: 'block', marginTop: 4, padding: 7, width: '100%', fontSize: 13 }} />
        </label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="submit" disabled={saving} style={{ padding: '8px 16px', fontSize: 13, border: 'none', borderRadius: 4, background: saving ? '#98a2b3' : '#1976d2', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : selectedEntry ? 'Update' : 'Save Expense'}
          </button>
          <button type="button" onClick={resetForm} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #cfd6e2', borderRadius: 4, background: '#fff', color: '#344054', cursor: 'pointer' }}>New</button>
          <button type="button" onClick={handleDelete} disabled={saving || !selectedEntry} style={{ padding: '8px 16px', fontSize: 13, border: '1px solid #b42318', borderRadius: 4, background: saving || !selectedEntry ? '#f2f4f7' : '#d92d20', color: saving || !selectedEntry ? '#98a2b3' : '#fff', cursor: saving || !selectedEntry ? 'not-allowed' : 'pointer' }}>Delete</button>
        </div>
      </form>

      <div className="mobile-toolbar" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 14, color: '#555' }}>{filteredEntries.length} entries</span>
        <span style={{ fontSize: 14, color: '#1f2937', fontWeight: 700 }}>Total {formatAmount(totalExpense)}</span>
        <select value={typeFilter} onChange={event => setTypeFilter(event.target.value)} style={{ padding: 7, fontSize: 13 }}>
          <option value="">All Types</option>
          {expenseTypes.map(type => (
            <option key={type.expense_type_id} value={type.expense_type_id}>{type.expense_type_name}</option>
          ))}
        </select>
        <input type="date" value={fromDate} onChange={event => setFromDate(event.target.value)} style={{ padding: 7, fontSize: 13 }} />
        <input type="date" value={toDate} onChange={event => setToDate(event.target.value)} style={{ padding: 7, fontSize: 13 }} />
        <input value={filterText} onChange={event => setFilterText(event.target.value)} placeholder="Filter by any field" style={{ padding: 7, minWidth: 220, fontSize: 13 }} />
        <button type="button" onClick={() => { setFromDate(''); setToDate(''); setTypeFilter(''); setFilterText(''); }} style={{ padding: '7px 14px', fontSize: 13, background: '#fff', border: '1px solid #cfd6e2', borderRadius: 4, cursor: 'pointer' }}>Clear</button>
        <button type="button" onClick={loadData} style={{ padding: '7px 14px', fontSize: 13, background: '#fff', border: '1px solid #cfd6e2', borderRadius: 4, cursor: 'pointer' }}>Refresh</button>
      </div>

      {error && <div style={{ color: '#b42318', marginBottom: 12 }}>{error}</div>}
      {success && <div style={{ color: '#067647', marginBottom: 12, fontWeight: 600 }}>{success}</div>}

      <div className="desktop-table-wrap">
        <table className="fixed-header-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', boxShadow: '0 1px 4px #eee' }}>
          <thead>
            <tr>
              {['Date', 'Type', 'Amount', 'Paid To', 'Paid By', 'Mode', 'Notes'].map(label => (
                <th key={label} style={{ padding: '7px 6px', borderBottom: '1px solid #ccc', textAlign: label === 'Amount' ? 'right' : 'left', background: '#fafbfc' }}>{label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 12 }}>Loading...</td></tr>
            ) : filteredEntries.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 12 }}>No expenses found.</td></tr>
            ) : filteredEntries.map(entry => (
              <tr
                key={entry.expense_id}
                className={selectedEntry?.expense_id === entry.expense_id ? 'selected-record-row' : undefined}
                onClick={() => selectEntry(entry)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{formatDate(entry.expense_date)}</td>
                <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{entry.expense_type_name}</td>
                <td style={{ padding: '6px', borderBottom: '1px solid #eee', textAlign: 'right' }}>{formatAmount(entry.amount)}</td>
                <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{entry.paid_to || ''}</td>
                <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{entry.paid_by || ''}</td>
                <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{entry.payment_mode || ''}</td>
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
          <div className="mobile-record-card">No expenses found.</div>
        ) : filteredEntries.map(entry => (
          <div
            key={entry.expense_id}
            className={`mobile-record-card ${selectedEntry?.expense_id === entry.expense_id ? 'selected' : ''}`}
            onClick={() => selectEntry(entry)}
          >
            <div className="mobile-card-title">
              <div>
                {entry.expense_type_name || 'Expense'}
                <div className="mobile-card-subtitle">{formatDate(entry.expense_date)} · {entry.payment_mode || 'Payment'}</div>
              </div>
              <span className="mobile-badge">{formatAmount(entry.amount)}</span>
            </div>
            <div className="mobile-card-grid">
              <div className="mobile-card-field">
                <span className="mobile-card-label">Paid To</span>
                <span className="mobile-card-value">{entry.paid_to || ''}</span>
              </div>
              <div className="mobile-card-field">
                <span className="mobile-card-label">Paid By</span>
                <span className="mobile-card-value">{entry.paid_by || ''}</span>
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

export default Expenses;
