import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import API_BASE_URL from '../../api';

const initialState = {
  customer_name: '',
  date_of_birth: '',
  mobile_number: '',
  area: '',
  area_id: '',
  occupation: '',
  customer_category: '',
  city: '',
};

const getAreaId = area => {
  if (!area || area.area_id === undefined || area.area_id === null) return '';
  return area.area_id;
};

const getAreaName = area => {
  if (!area) return '';
  return area.area_name || area.name || area.area || '';
};

const getCategoryName = category => {
  if (typeof category === 'string') return category;
  if (!category) return '';
  return category.name || category.customer_category || category.category || '';
};

export default function NewCustomerForm({ onSuccess, onCancel }) {
  const [form, setForm] = useState(initialState);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [categoryOptions, setCategoryOptions] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/areas`)
      .then(res => res.json())
      .then(data => setAreas(Array.isArray(data) ? data : []))
      .catch(() => setAreas([]));
    fetch(`${API_BASE_URL}/api/customer-categories`)
      .then(res => res.json())
      .then(data => {
        // Log the data for debugging
        console.log('Fetched customer categories:', data);
        setCategoryOptions(Array.isArray(data) ? data : []);
      })
      .catch(() => setCategoryOptions([]));
  }, []);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };
  const handleAreaChange = option => {
    setForm(f => ({
      ...f,
      area: option ? option.label : '',
      area_id: option ? option.value : '',
    }));
  };
  const handleCategoryChange = option => {
    setForm(f => ({ ...f, customer_category: option ? option.value : '' }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (!form.area || !form.area_id) {
      setLoading(false);
      setError('Please select an area.');
      return;
    }

    const payload = {
      ...form,
      area: String(form.area || ''),
      area_id: form.area_id,
      customer_category: String(form.customer_category || ''),
    };
    console.log('Submitting form with payload:', payload);
    try {
      const res = await fetch(`${API_BASE_URL}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to add customer');
      setLoading(false);
      setForm(initialState);
      if (onSuccess) onSuccess(data);
    } catch (err) {
      setLoading(false);
      setError(err.message || 'Error');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.45)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <form onSubmit={handleSubmit} style={{
        background: '#fff',
        padding: 60,
        borderRadius: 16,
        maxWidth: 1100,
        minWidth: 700,
        minHeight: 700,
        height: '80vh',
        width: '100%',
        boxShadow: '0 8px 48px #0004',
        position: 'relative',
        overflowY: 'auto',
      }}>
        <button type="button" onClick={onCancel} style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'transparent',
          border: 'none',
          fontSize: 22,
          color: '#888',
          cursor: 'pointer',
        }} title="Close">×</button>
        <h2 style={{ marginTop: 0, marginBottom: 24 }}>New Customer</h2>
        <div className="form-row" style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontWeight: 500, fontSize: 18, marginBottom: 8 }}>Name
            <input name="customer_name" value={form.customer_name} onChange={handleChange} required style={{ width: '100%', fontSize: 18, padding: '12px 14px', borderRadius: 6, border: '1px solid #bbb', marginTop: 4 }} />
          </label>
        </div>
        <div className="form-row" style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontWeight: 500, fontSize: 18, marginBottom: 8 }}>Date of Birth
            <input name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} required style={{ width: '100%', fontSize: 18, padding: '12px 14px', borderRadius: 6, border: '1px solid #bbb', marginTop: 4 }} />
          </label>
        </div>
        <div className="form-row" style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontWeight: 500, fontSize: 18, marginBottom: 8 }}>Mobile Number
            <input name="mobile_number" value={form.mobile_number} onChange={handleChange} required style={{ width: '100%', fontSize: 18, padding: '12px 14px', borderRadius: 6, border: '1px solid #bbb', marginTop: 4 }} />
          </label>
        </div>
        <div className="form-row" style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontWeight: 500, fontSize: 18, marginBottom: 8 }}>Area
            <div style={{ width: '100%' }}>
              <Select
                name="area"
                value={areas
                  .map(a => ({ value: getAreaId(a), label: getAreaName(a) }))
                  .find(option => option.value === form.area_id) || null}
                onChange={handleAreaChange}
                options={areas
                  .map(a => ({ value: getAreaId(a), label: getAreaName(a) }))
                  .filter(option => option.value !== '' && option.label)}
                placeholder="Select or search area..."
                isClearable
                isSearchable
                required
                styles={{
                  control: (base) => ({ ...base, minHeight: 48, fontSize: 18 }),
                  menu: (base) => ({ ...base, fontSize: 18 }),
                }}
              />
            </div>
          </label>
        </div>
        <div className="form-row" style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontWeight: 500, fontSize: 18, marginBottom: 8 }}>Occupation
            <input name="occupation" value={form.occupation} onChange={handleChange} style={{ width: '100%', fontSize: 18, padding: '12px 14px', borderRadius: 6, border: '1px solid #bbb', marginTop: 4 }} />
          </label>
        </div>
        <div className="form-row" style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontWeight: 500, fontSize: 18, marginBottom: 8 }}>Customer Category
            <div style={{ width: '100%' }}>
              <Select
                name="customer_category"
                value={form.customer_category ? { value: form.customer_category, label: form.customer_category } : null}
                onChange={handleCategoryChange}
                options={categoryOptions
                  .map(cat => getCategoryName(cat))
                  .filter(Boolean)
                  .map(cat => ({ value: cat, label: cat }))}
                placeholder="Select or search category..."
                isClearable
                isSearchable
                required
                styles={{
                  control: (base) => ({ ...base, minHeight: 48, fontSize: 18 }),
                  menu: (base) => ({ ...base, fontSize: 18 }),
                }}
              />
            </div>
          </label>
        </div>
        <div className="form-row" style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontWeight: 500, fontSize: 18, marginBottom: 8 }}>City
            <input name="city" value={form.city} onChange={handleChange} style={{ width: '100%', fontSize: 18, padding: '12px 14px', borderRadius: 6, border: '1px solid #bbb', marginTop: 4 }} />
          </label>
        </div>
        {error && <div style={{ color: 'red', marginBottom: 8 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          <button type="submit" disabled={loading} style={{ background: '#1976d2', color: '#fff', padding: '10px 28px', border: 'none', borderRadius: 4, fontSize: 16 }}>{loading ? 'Saving...' : 'Save'}</button>
          <button type="button" onClick={onCancel} style={{ background: '#eee', color: '#333', padding: '10px 28px', border: 'none', borderRadius: 4, fontSize: 16 }}>Cancel</button>
        </div>
              {/* Submit button row */}
              <div className="form-row" style={{ marginTop: 32, textAlign: 'right' }}>
                <button type="submit" disabled={loading} style={{
                  fontSize: 20,
                  padding: '12px 32px',
                  borderRadius: 8,
                  background: '#1976d2',
                  color: '#fff',
                  border: 'none',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 8px #0002',
                }}>
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
      </form>
    </div>
  );
}
