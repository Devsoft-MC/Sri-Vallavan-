import React, { useState } from 'react';
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
  minWidth: 350,
  maxWidth: 480,
  width: '100%',
  position: 'relative',
};


const backendUrl = API_BASE_URL;

function EditLoanStatusForm({ loan, onClose }) {
  const [status, setStatus] = useState(loan.status || 'Open');
  const [interestReceived, setInterestReceived] = useState(
    loan.interest_received === undefined || loan.interest_received === null || loan.interest_received === ''
      ? '0'
      : String(loan.interest_received)
  );
  const [adjustment, setAdjustment] = useState(
    loan.adjustment === undefined || loan.adjustment === null || loan.adjustment === ''
      ? '0'
      : String(loan.adjustment)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Parse numbers safely
  const issued = parseFloat(loan.issue_amount) || 0;
  const collected = parseFloat(loan.collected_amount) || 0;
  const adj = parseFloat(adjustment) || 0;
  const balance = issued - collected - adj;

  // Save button is only enabled if status is 'Closed' and balance is zero
  const canSave = status === 'Closed' && balance === 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${backendUrl}/api/loans/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loan_id: loan.loan_id,
          status,
          interest_received: interestReceived,
          adjustment: adjustment
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update loan status');
      }
      setSuccess('Loan status updated!');
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err.message || 'Error updating status');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={modalStyle}>
      <form style={formStyle} onSubmit={handleSubmit}>
        <h2 style={{ marginTop: 0 }}>Loan Closing</h2>
        <div style={{ marginBottom: 12 }}>
          <label>Loan ID</label><br />
          <input type="text" value={loan.loan_id} readOnly style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', background: '#f5f5f5' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Customer Name</label><br />
          <input type="text" value={loan.customer_name} readOnly style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', background: '#f5f5f5' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Loan Type</label><br />
          <input type="text" value={loan.loan_type} readOnly style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', background: '#f5f5f5' }} />
        </div>
        {/* ...other fields... */}
        <div style={{ marginBottom: 12 }}>
          <label>Loan Issued Amount</label><br />
          <input type="text" value={Number(loan.issue_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} readOnly style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', background: '#f5f5f5' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Loan Collected Amount</label><br />
          <input type="text" value={Number(loan.collected_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} readOnly style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', background: '#f5f5f5' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Balance</label><br />
          <input type="text" value={balance.toLocaleString(undefined, { minimumFractionDigits: 2 })} readOnly style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', background: balance === 0 ? '#e8f5e9' : '#fff3e0', color: balance === 0 ? 'green' : 'red' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Interest Received</label><br />
          <input type="number" value={interestReceived} onChange={e => setInterestReceived(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Adjustments</label><br />
          <input type="number" value={adjustment} onChange={e => setAdjustment(e.target.value)} style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
        </div>
        {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ color: 'green', marginBottom: 12 }}>{success}</div>}
        <div style={{ marginBottom: 12 }}>
          <label>Status</label><br />
          <div style={{ width: '100%' }}>
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              style={{
                width: '100%',
                padding: 8,
                borderRadius: 4,
                border: '1px solid #ccc',
                background: '#fff',
                fontSize: 16,
                color: '#333',
                appearance: 'none',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
                marginTop: 2
              }}
            >
              <option value="Open">Open</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 18px', borderRadius: 4, border: '1px solid #ccc', background: '#f5f5f5' }} disabled={submitting}>Cancel</button>
          <button type="submit" style={{ padding: '8px 18px', borderRadius: 4, border: 'none', background: canSave ? '#1976d2' : '#aaa', color: '#fff', fontWeight: 600, cursor: canSave ? 'pointer' : 'not-allowed' }} disabled={submitting || !canSave}>Save</button>
        </div>
      </form>
    </div>
  );
}

export default EditLoanStatusForm;
