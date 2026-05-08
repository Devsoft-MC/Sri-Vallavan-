import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import API_BASE_URL from '../../api';

const initialState = {
  customer_name: '',
  date_of_birth: '',
  mobile_number: '',
  area: '',
  occupation: '',
  customer_category: '',
  city: '',
};

const DEFAULT_CUSTOMER_CATEGORIES = ['Good', 'Doubtfull', 'Bad'];

const normalizeCustomerCategories = data => {
  if (!Array.isArray(data)) return DEFAULT_CUSTOMER_CATEGORIES;

  const categories = data
    .map(item => {
      if (typeof item === 'string') return item;
      if (item && typeof item === 'object') return item.customer_category;
      return '';
    })
    .filter(Boolean);

  return Array.from(new Set([...DEFAULT_CUSTOMER_CATEGORIES, ...categories]));
};

export default function AddCustomerForm({ onSuccess, onCancel }) {
  const [form, setForm] = useState(initialState);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [areas, setAreas] = useState([]);
  const [categoryOptions, setCategoryOptions] = useState(DEFAULT_CUSTOMER_CATEGORIES);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/areas`)
      .then(async res => {
        if (!res.ok) return [];
        try {
          return await res.json();
        } catch {
          return [];
        }
      })
      .then(data => setAreas(Array.isArray(data) ? data : []));
  }, []);

  // Prepare options for react-select
  const areaOptions = areas.map(area => ({
    value: area.area_name,
    label: area.area_name
  }));

  // Fetch customer categories from backend
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/customer-categories`)
      .then(async res => {
        if (!res.ok) return [];
        try {
          return await res.json();
        } catch {
          return [];
        }
      })
      .then(data => setCategoryOptions(normalizeCustomerCategories(data)))
      .catch(() => setCategoryOptions(DEFAULT_CUSTOMER_CATEGORIES));
  }, []);

  const customerCategoryOptions = categoryOptions.map(cat => ({
    value: cat,
    label: cat
  }));

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setLoading(true);
    setError('');
    // Ensure only string values are sent for area and customer_category
    const payload = {
      ...form,
      area: typeof form.area === 'string' ? form.area : (form.area && form.area.value) ? form.area.value : '',
      customer_category: typeof form.customer_category === 'string' ? form.customer_category : (form.customer_category && form.customer_category.value) ? form.customer_category.value : '',
    };
    try {
      const res = await fetch(`${API_BASE_URL}/api/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error('Server returned invalid response.');
      }
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
    <div className="modal-backdrop">
      <form className="modal-form" onSubmit={handleSubmit}>
        <h3>Add New Customer</h3>
        <div className="form-row">
          <label>Name <input name="customer_name" value={form.customer_name} onChange={handleChange} required /></label>
        </div>
        <div className="form-row">
          <label>Date of Birth <input name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} required /></label>
        </div>
        <div className="form-row">
          <label>Mobile Number <input name="mobile_number" value={form.mobile_number} onChange={handleChange} required /></label>
        </div>
        <div className="form-row">
          <label>Area
            <Select
              name="area"
              value={areaOptions.find(opt => opt.value === form.area) || null}
              onChange={option => setForm(f => ({ ...f, area: option ? option.value : '' }))}
              options={areaOptions}
              placeholder="Select or search area..."
              isClearable
              required
            />
          </label>
        </div>
        <div className="form-row">
          <label>Occupation <input name="occupation" value={form.occupation} onChange={handleChange} /></label>
        </div>
        <div className="form-row">
          <label>Customer Category
            <Select
              name="customer_category"
              value={customerCategoryOptions.find(opt => opt.value === form.customer_category) || null}
              onChange={option => setForm(f => ({ ...f, customer_category: option ? option.value : '' }))}
              options={customerCategoryOptions}
              placeholder="Select or search category..."
              isClearable
              required
            />
          </label>
        </div>
        <div className="form-row">
          <label>City <input name="city" value={form.city} onChange={handleChange} /></label>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="form-actions">
          <button type="submit" disabled={loading}>{loading ? 'Adding...' : 'Add Customer'}</button>
          <button type="button" onClick={onCancel} disabled={loading}>Cancel</button>
        </div>
      </form>
      <style>{`
        .modal-backdrop {
          position: fixed; left: 0; top: 0; width: 100vw; height: 100vh;
          background: rgba(0,0,0,0.18); z-index: 1000; display: flex; align-items: center; justify-content: center;
        }
        .modal-form {
          background: #fff; padding: 28px 32px; border-radius: 8px; min-width: 340px; box-shadow: 0 4px 24px #0002;
        }
        .modal-form h3 { margin-top: 0; }
        .form-row { margin-bottom: 14px; }
        .form-row label { display: flex; flex-direction: column; font-size: 14px; }
        .form-row input, .form-row select { margin-top: 4px; padding: 6px 8px; font-size: 14px; border: 1px solid #ccc; border-radius: 4px; }
        .form-actions { display: flex; gap: 12px; margin-top: 18px; }
        .form-error { color: #e74c3c; margin-bottom: 10px; }
        .combo-dropdown {
          position: absolute; left: 0; right: 0; top: 100%; background: #fff; border: 1px solid #ccc; border-radius: 0 0 4px 4px; box-shadow: 0 2px 8px #0001; z-index: 10; max-height: 120px; overflow-y: auto;
        }
        .combo-item { padding: 7px 12px; cursor: pointer; }
        .combo-item:hover { background: #f0f0f0; }
      `}</style>
    </div>
  );
}
