import React, { useEffect, useState } from 'react';

export const columns = [
  { label: 'Loan ID', key: 'loan_id' },
  { label: 'Customer ID', key: 'customer_id' },
  { label: 'Customer Name', key: 'customer_name' },
  { label: 'Loan Type', key: 'loan_type' },
  { label: 'Loan Issue Date', key: 'issue_date' },
  { label: 'Loan Issued Amount', key: 'issue_amount' },
  { label: 'Collected Amount', key: 'collected_amount' },
  { label: 'Balance', key: 'balance' },
  { label: 'Interest Received', key: 'interest_received' },
  { label: 'Adjustments', key: 'adjustment' },
  { label: 'Status', key: 'status' },
];

const LoansBody = ({ loans, loading, error, sortKey, sortOrder, onSort, onRowClick, selectedLoan }) => {
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
      {error && (
        <div style={{ background: '#ffeaea', color: '#b00020', padding: 12, margin: '0 0 12px 0', border: '1px solid #ffbdbd', borderRadius: 4, fontWeight: 600 }}>
          Error: {error}
        </div>
      )}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <colgroup>
            {columns.map(col => (
              <col key={col.key} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ position: 'sticky', top: 0, background: '#fafbfc', zIndex: 2 }}>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{
                    padding: '8px 6px',
                    borderBottom: '1px solid #ddd',
                    textAlign: 'left',
                    fontWeight: 600,
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: sortKey === col.key ? '#e3e8f0' : undefined,
                  }}
                  onClick={() => onSort(col.key)}
                >
                  {col.label}
                  {sortKey === col.key && (
                    <span style={{ marginLeft: 4 }}>{sortOrder === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: 32 }}>Loading...</td></tr>
            ) : loans.length === 0 ? (
              <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: 32 }}>No loans found.</td></tr>
            ) : (
              loans.map((row, idx) => (
                <tr
                  key={row.loan_id || idx}
                  className={selectedLoan && selectedLoan.loan_id === row.loan_id ? 'selected-record-row' : undefined}
                  onClick={() => onRowClick && onRowClick(row)}
                  style={{ cursor: 'pointer' }}
                >
                  {columns.map(col => {
                    let value = row[col.key];
                    // Format date
                    if (col.key === 'issue_date' && value) {
                      value = new Date(value).toLocaleDateString('en-GB');
                    }
                    // Format numbers
                    if ([
                      'issue_amount',
                      'collected_amount',
                      'balance',
                      'interest_received',
                      'adjustment',
                    ].includes(col.key) && value !== undefined && value !== null) {
                      value = Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    }
                    return (
                      <td key={col.key} style={{ padding: '8px 6px', borderBottom: '1px solid #f0f0f0' }}>{value ?? ''}</td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
          {/* The totals row will be rendered by LoansFooter as tfoot for perfect alignment */}
        </table>
      </div>
    </div>
  );
};

export default LoansBody;
// This file has been removed as part of the Loans feature removal.
