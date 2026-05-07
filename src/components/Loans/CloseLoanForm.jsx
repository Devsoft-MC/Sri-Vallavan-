import React, { useState } from 'react';
import Select from 'react-select';
import API_BASE_URL from '../../api';

const modalStyle = {
  position: 'fixed',
  top: 0,
  left: 0,
  width: '100vw',
  height: '100vh',
  background: 'rgba(0,0,0,0.25)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const formStyle = {
  background: '#fff',
  borderRadius: 8,
  boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
  padding: 32,
  minWidth: 420,
  maxWidth: 560,
  width: '100%',
  position: 'relative',
};

function formatMoney(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(String(dateStr).split('T')[0]);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString();
}

function CloseLoanForm({ loan, onClose, onSuccess }) {
  const statusOptions = [
    { value: 'Open', label: 'Open' },
    { value: 'Closed', label: 'Closed' },
  ];
  const [status, setStatus] = useState(loan?.status || 'Open');
  const [interestReceived, setInterestReceived] = useState(
    loan?.interest_received === undefined || loan?.interest_received === null || loan?.interest_received === ''
      ? '0'
      : String(loan.interest_received)
  );
  const [adjustment, setAdjustment] = useState(
    loan?.adjustment === undefined || loan?.adjustment === null || loan?.adjustment === ''
      ? '0'
      : String(loan.adjustment)
  );
  // Use both possible field names for compatibility
  const [closingDate, setClosingDate] = useState(() => {
    // Prefer closing_date, fallback to close_date, fallback to today
    let d = loan?.closing_date || loan?.close_date;
    if (d) {
      const dateObj = new Date(d);
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toISOString().slice(0, 10);
      }
      if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    }
    return new Date().toISOString().slice(0, 10);
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const issuedAmount = parseFloat(loan?.issue_amount) || 0;
  const collectedAmount = parseFloat(loan?.collected_amount) || 0;
  const adjustmentAmount = parseFloat(adjustment) || 0;
  const balanceAmount = issuedAmount - collectedAmount - adjustmentAmount;
  const canSave = status === 'Closed' && Math.abs(balanceAmount) < 0.01 && closingDate;
  const selectedStatusOption = statusOptions.find(option => option.value === status) || null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    // Always require closingDate in YYYY-MM-DD
    if (status === 'Closed') {
      if (!closingDate || !/^\d{4}-\d{2}-\d{2}$/.test(closingDate)) {
        setError('Closing Date is required and must be valid (YYYY-MM-DD) when closing a loan.');
        return;
      }
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/loans/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loan_id: loan.loan_id,
          status,
          interest_received: interestReceived,
          adjustment,
          closing_date: closingDate ? String(closingDate) : undefined, // always send as YYYY-MM-DD string
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update loan status');
      }
      setSuccess('Loan status updated!');
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || 'Error updating loan status');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={modalStyle}>
      <form style={formStyle} onSubmit={handleSubmit}>
        <h2 style={{ marginTop: 0 }}>Close Loan</h2>
        <div style={{ marginBottom: 12 }}>
          <label>Loan ID</label><br />
          <input type="text" value={loan?.loan_id || ''} readOnly style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', background: '#f5f5f5' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Name</label><br />
          <input type="text" value={loan?.customer_name || ''} readOnly style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', background: '#f5f5f5' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Issued Date</label><br />
          <input type="text" value={formatDate(loan?.issue_date)} readOnly style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', background: '#f5f5f5' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Issued Amount</label><br />
          <input type="text" value={formatMoney(issuedAmount)} readOnly style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', background: '#f5f5f5' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Balance Amount</label><br />
          <input
            type="text"
            value={formatMoney(balanceAmount)}
            readOnly
            style={{
              width: '100%',
              padding: 8,
              borderRadius: 4,
              border: '1px solid #ccc',
              background: Math.abs(balanceAmount) < 0.01 ? '#e8f5e9' : '#fff3e0',
              color: Math.abs(balanceAmount) < 0.01 ? 'green' : 'red',
            }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Adjustments</label><br />
          <input
            type="number"
            min="0"
            step="0.01"
            value={adjustment}
            onChange={e => setAdjustment(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Interest Received</label><br />
          <input
            type="number"
            min="0"
            step="0.01"
            value={interestReceived}
            onChange={e => setInterestReceived(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Close Date</label><br />
          <input
            type="date"
            value={closingDate}
            onChange={e => setClosingDate(e.target.value)}
            required
            style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', boxSizing: 'border-box' }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Status</label><br />
          <Select
            options={statusOptions}
            value={selectedStatusOption}
            onChange={option => setStatus(option ? option.value : 'Open')}
            placeholder="Select Status"
            isClearable={false}
            styles={{ container: base => ({ ...base, width: '100%' }) }}
          />
        </div>
        {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ color: 'green', marginBottom: 12 }}>{success}</div>}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 4, border: '1px solid #ccc', background: '#f5f5f5' }} disabled={submitting}>Cancel</button>
          <button
            type="submit"
            style={{
              padding: '8px 18px',
              borderRadius: 4,
              border: 'none',
              background: canSave ? '#d32f2f' : '#aaa',
              color: '#fff',
              fontWeight: 600,
              cursor: canSave ? 'pointer' : 'not-allowed',
            }}
            disabled={submitting || !canSave}
          >
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default CloseLoanForm;
