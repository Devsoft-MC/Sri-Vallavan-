import React, { useCallback, useEffect, useMemo, useState } from 'react';
import API_BASE_URL from '../../api';

const masterConfig = {
  income: {
    title: 'Income Types',
    endpoint: '/api/income-types',
    idKey: 'income_type_id',
    nameKey: 'income_type_name',
    placeholder: 'Income type name',
  },
  expense: {
    title: 'Expense Types',
    endpoint: '/api/expense-types',
    idKey: 'expense_type_id',
    nameKey: 'expense_type_name',
    placeholder: 'Expense type name',
  },
};

const Settings = () => {
  const [activeMaster, setActiveMaster] = useState('income');

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ color: 'navy', margin: '0 0 18px' }}>Settings</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {Object.entries(masterConfig).map(([key, config]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveMaster(key)}
            style={{
              padding: '8px 16px',
              border: `1px solid ${activeMaster === key ? '#1976d2' : '#cfd6e2'}`,
              borderRadius: 4,
              background: activeMaster === key ? '#1976d2' : '#fff',
              color: activeMaster === key ? '#fff' : '#344054',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {config.title}
          </button>
        ))}
      </div>
      <MasterPanel config={masterConfig[activeMaster]} />
    </div>
  );
};

const MasterPanel = ({ config }) => {
  const [rows, setRows] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [filterText, setFilterText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const filteredRows = useMemo(() => {
    const text = filterText.trim().toLowerCase();
    if (!text) return rows;
    return rows.filter(row => String(row[config.nameKey] || '').toLowerCase().includes(text));
  }, [config.nameKey, filterText, rows]);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}${config.endpoint}`);
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data.error || `Unable to load ${config.title}.`);
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || `Unable to load ${config.title}.`);
    } finally {
      setLoading(false);
    }
  }, [config.endpoint, config.title]);

  useEffect(() => {
    setSelectedRow(null);
    setName('');
    setIsActive(true);
    setFilterText('');
    loadRows();
  }, [loadRows]);

  const selectRow = row => {
    setSelectedRow(row);
    setName(row[config.nameKey] || '');
    setIsActive(row.is_active !== false);
    setError('');
    setSuccess('');
  };

  const resetForm = () => {
    setSelectedRow(null);
    setName('');
    setIsActive(true);
    setError('');
  };

  const handleSubmit = async event => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(`${config.title.replace(/s$/, '')} name is required.`);
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const isEdit = Boolean(selectedRow);
      const url = isEdit
        ? `${API_BASE_URL}${config.endpoint}/${selectedRow[config.idKey]}`
        : `${API_BASE_URL}${config.endpoint}`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [config.nameKey]: trimmedName,
          is_active: isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `Unable to save ${config.title}.`);

      setSuccess(`${config.title.replace(/s$/, '')} saved.`);
      resetForm();
      await loadRows();
      setTimeout(() => setSuccess(''), 3500);
    } catch (err) {
      setError(err.message || `Unable to save ${config.title}.`);
    } finally {
      setSaving(false);
    }
  };

  const toggleSelectedActive = async () => {
    if (!selectedRow) return;
    setIsActive(current => !current);
  };

  return (
    <section>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, alignItems: 'end', flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ display: 'grid', gap: 4, fontSize: 13, color: '#444', minWidth: 280 }}>
          {config.title.replace(/s$/, '')}
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder={config.placeholder}
            style={{ padding: 8, fontSize: 13, border: '1px solid #cfd8e3', borderRadius: 4 }}
          />
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, paddingBottom: 8 }}>
          <input type="checkbox" checked={isActive} onChange={toggleSelectedActive} />
          Active
        </label>
        <button type="submit" disabled={saving} style={{ padding: '8px 16px', border: 'none', borderRadius: 4, background: saving ? '#98a2b3' : '#1976d2', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer' }}>
          {selectedRow ? 'Update' : 'Add'}
        </button>
        <button type="button" onClick={resetForm} style={{ padding: '8px 16px', border: '1px solid #cfd6e2', borderRadius: 4, background: '#fff', color: '#344054', cursor: 'pointer' }}>
          New
        </button>
      </form>

      <div className="mobile-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 14, color: '#555' }}>{filteredRows.length} records</span>
        <input value={filterText} onChange={event => setFilterText(event.target.value)} placeholder="Filter master" style={{ padding: 7, minWidth: 220, fontSize: 13 }} />
        <button type="button" onClick={loadRows} style={{ padding: '7px 14px', fontSize: 13, background: '#fff', border: '1px solid #cfd6e2', borderRadius: 4, cursor: 'pointer' }}>Refresh</button>
      </div>

      {error && <div style={{ color: '#b42318', marginBottom: 12 }}>{error}</div>}
      {success && <div style={{ color: '#067647', marginBottom: 12, fontWeight: 600 }}>{success}</div>}

      <div className="desktop-table-wrap">
        <table className="fixed-header-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, background: '#fff', boxShadow: '0 1px 4px #eee' }}>
          <thead>
            <tr>
              <th style={{ padding: '7px 6px', borderBottom: '1px solid #ccc', textAlign: 'left', background: '#fafbfc' }}>ID</th>
              <th style={{ padding: '7px 6px', borderBottom: '1px solid #ccc', textAlign: 'left', background: '#fafbfc' }}>Name</th>
              <th style={{ padding: '7px 6px', borderBottom: '1px solid #ccc', textAlign: 'left', background: '#fafbfc' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} style={{ padding: 12 }}>Loading...</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={3} style={{ padding: 12 }}>No records found.</td></tr>
            ) : filteredRows.map(row => (
              <tr
                key={row[config.idKey]}
                className={selectedRow?.[config.idKey] === row[config.idKey] ? 'selected-record-row' : undefined}
                onClick={() => selectRow(row)}
                style={{ cursor: 'pointer' }}
              >
                <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{row[config.idKey]}</td>
                <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{row[config.nameKey]}</td>
                <td style={{ padding: '6px', borderBottom: '1px solid #eee' }}>{row.is_active === false ? 'Inactive' : 'Active'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-card-list">
        {loading ? (
          <div className="mobile-record-card">Loading...</div>
        ) : filteredRows.length === 0 ? (
          <div className="mobile-record-card">No records found.</div>
        ) : filteredRows.map(row => (
          <div
            key={row[config.idKey]}
            className={`mobile-record-card ${selectedRow?.[config.idKey] === row[config.idKey] ? 'selected' : ''}`}
            onClick={() => selectRow(row)}
          >
            <div className="mobile-card-title">
              <div>
                {row[config.nameKey]}
                <div className="mobile-card-subtitle">ID {row[config.idKey]}</div>
              </div>
              <span className="mobile-badge">{row.is_active === false ? 'Inactive' : 'Active'}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Settings;
