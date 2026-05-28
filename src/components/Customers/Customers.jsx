import Select from 'react-select';

function formatDate(dateStr) {
	if (!dateStr) return '';
	const date = new Date(dateStr.split('T')[0]);
	if (isNaN(date)) return dateStr;
	const day = String(date.getDate()).padStart(2, '0');
	const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
	const year = date.getFullYear();
	return `${day}${month}${year}`;
}
import React, { useEffect, useState } from 'react';
import NewCustomerForm from './NewCustomerForm';
import API_BASE_URL from '../../api';
import { getStoredAuth } from '../../auth';

const columns = [
	{ label: 'Sl.No', key: 'slno' },
	{ label: 'Customer ID', key: 'customer_id' },
	{ label: 'Customer Name', key: 'customer_name' },
	{ label: 'Date of Birth', key: 'date_of_birth' },
	{ label: 'Mobile Number', key: 'mobile_number' },
	{ label: 'Area', key: 'area' },
	{ label: 'Occupation', key: 'occupation' },
	{ label: 'Customer Category', key: 'customer_category' },
	{ label: 'City', key: 'city' },
];

const documentFields = [
	{ key: 'customer_photo', label: 'Customer Photo', accept: 'image/jpeg,image/png,image/webp' },
	{ key: 'customer_adhar', label: 'Customer Adhar Copy', accept: 'application/pdf' },
	{ key: 'guarantor_adhar', label: 'Guarantor Adhar Copy', accept: 'application/pdf' },
	{ key: 'tax_receipt', label: 'Tax Receipt', accept: 'application/pdf' },
];

const getAreaId = area => {
	if (!area || area.area_id === undefined || area.area_id === null) return '';
	return area.area_id;
};

const getAreaName = area => {
	if (!area) return '';
	return area.area_name || area.name || area.area || '';
};

const normalizeDateInput = value => (value ? String(value).slice(0, 10) : '');

function CustomerEditModal({ customer, onCancel, onSuccess }) {
	const [form, setForm] = React.useState({
		customer_name: customer.customer_name || '',
		date_of_birth: normalizeDateInput(customer.date_of_birth),
		mobile_number: customer.mobile_number || '',
		area: customer.area_name || customer.area || '',
		area_id: customer.area_id || '',
		occupation: customer.occupation || '',
		customer_category: customer.customer_category || '',
		city: customer.city || '',
		address: customer.address || '',
		guarantor_name: customer.guarantor_name || '',
		customer_adhar_number: customer.customer_adhar_number || '',
		guarantor_adhar_number: customer.guarantor_adhar_number || '',
		notes: customer.notes || '',
	});
	const [areas, setAreas] = React.useState([]);
	const [categoryOptions, setCategoryOptions] = React.useState([]);
	const [documents, setDocuments] = React.useState([]);
	const [files, setFiles] = React.useState({});
	const [loading, setLoading] = React.useState(false);
	const [error, setError] = React.useState('');
	const [selectedPhotoPreviewUrl, setSelectedPhotoPreviewUrl] = React.useState('');
	const [existingPhotoPreviewUrl, setExistingPhotoPreviewUrl] = React.useState('');
	const [photoLoadFailed, setPhotoLoadFailed] = React.useState(false);
	const [photoLoadError, setPhotoLoadError] = React.useState('');

	React.useEffect(() => {
		fetch(`${API_BASE_URL}/api/areas`)
			.then(res => (res.ok ? res.json() : []))
			.then(data => setAreas(Array.isArray(data) ? data : []))
			.catch(() => setAreas([]));
		fetch(`${API_BASE_URL}/api/customer-categories`)
			.then(res => (res.ok ? res.json() : []))
			.then(data => setCategoryOptions(Array.isArray(data) ? data : []))
			.catch(() => setCategoryOptions([]));
		fetch(`${API_BASE_URL}/api/customers/${customer.customer_id}/documents`)
			.then(res => (res.ok ? res.json() : []))
			.then(data => setDocuments(Array.isArray(data) ? data : []))
			.catch(() => setDocuments([]));
	}, [customer.customer_id]);

	React.useEffect(() => {
		if (!files.customer_photo) {
			setSelectedPhotoPreviewUrl('');
			return undefined;
		}

		const objectUrl = URL.createObjectURL(files.customer_photo);
		setSelectedPhotoPreviewUrl(objectUrl);
		setPhotoLoadFailed(false);
		return () => URL.revokeObjectURL(objectUrl);
	}, [files.customer_photo]);

	const customerPhoto = documents.find(doc => doc.doc_type === 'customer_photo');

	React.useEffect(() => {
		if (!customerPhoto?.file_path || files.customer_photo) {
			setExistingPhotoPreviewUrl('');
			setPhotoLoadFailed(false);
			setPhotoLoadError('');
			return undefined;
		}

		let isActive = true;
		let objectUrl = '';
		const storedAuth = getStoredAuth();
		const headers = storedAuth?.token ? { Authorization: `Bearer ${storedAuth.token}` } : {};
		setPhotoLoadFailed(false);
		setPhotoLoadError('');

		const loadPhoto = async () => {
			const urls = [
				`${API_BASE_URL}/api/customers/${customer.customer_id}/documents/customer_photo/view`,
				`${API_BASE_URL}${customerPhoto.file_path}`,
			];

			const failures = [];
			for (const url of urls) {
				try {
					const res = await fetch(url, { headers });
					if (res.ok) {
						const blob = await res.blob();
						if (!isActive) return;
						objectUrl = URL.createObjectURL(blob);
						setExistingPhotoPreviewUrl(objectUrl);
						setPhotoLoadFailed(false);
						setPhotoLoadError('');
						return;
					}
					failures.push(`${res.status} ${res.statusText || 'Error'}`);
				} catch (err) {
					failures.push(err.message || 'Network error');
				}
			}

			if (isActive) {
				setExistingPhotoPreviewUrl('');
				setPhotoLoadFailed(true);
				setPhotoLoadError(failures.join(' / ') || 'Unable to load photo');
			}
		};

		loadPhoto();

		return () => {
			isActive = false;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [customer.customer_id, customerPhoto?.file_path, files.customer_photo]);

	const areaOptions = areas
		.map(area => ({ value: getAreaId(area), label: getAreaName(area) }))
		.filter(option => option.value !== '' && option.label);
	const customerCategoryOptions = categoryOptions
		.map(item => (typeof item === 'string' ? item : item?.name || item?.customer_category || ''))
		.filter(Boolean)
		.map(category => ({ value: category, label: category }));

	const getDocumentName = docType => documents.find(doc => doc.doc_type === docType)?.file_name || '';
	const getDocumentUrl = docType => {
		const document = documents.find(doc => doc.doc_type === docType);
		return document?.file_path ? `${API_BASE_URL}${document.file_path}` : '';
	};
	const selectedPhoto = files.customer_photo;
	const photoPreviewUrl = selectedPhotoPreviewUrl || existingPhotoPreviewUrl;

	const handleChange = event => {
		const { name, value } = event.target;
		setForm(prev => ({ ...prev, [name]: value }));
		if (error) setError('');
	};

	const uploadDocument = async (docType, file) => {
		const formData = new FormData();
		formData.append('file', file);
		const res = await fetch(`${API_BASE_URL}/api/customers/${customer.customer_id}/documents/${docType}`, {
			method: 'POST',
			body: formData,
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.error || `Unable to upload ${docType}.`);
	};

	const handleSubmit = async event => {
		event.preventDefault();
		setLoading(true);
		setError('');

		if (!form.customer_name.trim()) {
			setLoading(false);
			setError('Customer name is required.');
			return;
		}

		try {
			const res = await fetch(`${API_BASE_URL}/api/customers/${customer.customer_id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					...form,
					customer_name: form.customer_name.trim(),
				}),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || 'Unable to update customer.');

			const uploadErrors = [];
			for (const field of documentFields) {
				if (!files[field.key]) continue;
				try {
					await uploadDocument(field.key, files[field.key]);
				} catch (err) {
					uploadErrors.push(`${field.label}: ${err.message || 'Upload failed'}`);
				}
			}

			if (uploadErrors.length > 0) {
				throw new Error(uploadErrors.join('\n'));
			}

			onSuccess(data);
		} catch (err) {
			setError(err.message || 'Unable to update customer.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
			<form onSubmit={handleSubmit} style={{ width: 'min(100%, 860px)', maxHeight: '88vh', overflowY: 'auto', background: '#fff', borderRadius: 8, padding: 20, boxShadow: '0 20px 48px rgba(15, 23, 42, 0.18)' }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', marginBottom: 14 }}>
					<h3 style={{ margin: 0, color: '#1f2937' }}>Edit Customer - {customer.customer_id}</h3>
					<div style={{ width: 170, flex: '0 0 170px' }}>
						<div style={{ width: 150, height: 150, marginLeft: 'auto', border: '1px solid #d0d5dd', borderRadius: 6, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
							{photoPreviewUrl && !photoLoadFailed ? (
								<img
									src={photoPreviewUrl}
									alt="Customer"
									onError={() => setPhotoLoadFailed(true)}
									style={{ width: '100%', height: '100%', objectFit: 'cover' }}
								/>
							) : (
								<span style={{ color: '#667085', fontSize: 13 }}>{customerPhoto ? 'Photo unavailable' : 'No photo'}</span>
							)}
						</div>
						<label style={{ display: 'grid', gap: 5, marginTop: 8, fontWeight: 600, fontSize: 13 }}>
							Customer Photo
							<input
								type="file"
								accept="image/jpeg,image/png,image/webp"
								onChange={event => setFiles(prev => ({ ...prev, customer_photo: event.target.files?.[0] || null }))}
								style={{ width: '100%', fontWeight: 400 }}
							/>
							<span style={{ color: '#667085', fontSize: 12, fontWeight: 400 }}>
								{selectedPhoto?.name || customerPhoto?.file_name || 'No file selected'}
							</span>
						</label>
						{photoLoadFailed && photoLoadError && (
							<span style={{ display: 'block', color: '#b42318', fontSize: 12, marginTop: 4 }}>
								Photo load failed: {photoLoadError}
							</span>
						)}
					</div>
				</div>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
					<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>Name
						<input name="customer_name" value={form.customer_name} onChange={handleChange} required style={{ height: 36, padding: '0 10px', border: '1px solid #cfd8e3', borderRadius: 4 }} />
					</label>
					<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>Date of Birth
						<input name="date_of_birth" type="date" value={form.date_of_birth} onChange={handleChange} style={{ height: 36, padding: '0 10px', border: '1px solid #cfd8e3', borderRadius: 4 }} />
					</label>
					<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>Mobile Number
						<input name="mobile_number" value={form.mobile_number} onChange={handleChange} style={{ height: 36, padding: '0 10px', border: '1px solid #cfd8e3', borderRadius: 4 }} />
					</label>
					<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>Area
						<Select
							value={areaOptions.find(option => option.value === form.area_id) || null}
							onChange={option => setForm(prev => ({ ...prev, area: option ? option.label : '', area_id: option ? option.value : '' }))}
							options={areaOptions}
							placeholder="Select or search area..."
							isClearable
							isSearchable
						/>
					</label>
					<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>Occupation
						<input name="occupation" value={form.occupation} onChange={handleChange} style={{ height: 36, padding: '0 10px', border: '1px solid #cfd8e3', borderRadius: 4 }} />
					</label>
					<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>Customer Category
						<Select
							value={form.customer_category ? { value: form.customer_category, label: form.customer_category } : null}
							onChange={option => setForm(prev => ({ ...prev, customer_category: option ? option.value : '' }))}
							options={customerCategoryOptions}
							placeholder="Select or search category..."
							isClearable
							isSearchable
						/>
					</label>
					<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>City
						<input name="city" value={form.city} onChange={handleChange} style={{ height: 36, padding: '0 10px', border: '1px solid #cfd8e3', borderRadius: 4 }} />
					</label>
					<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>Guarantor Name
						<input name="guarantor_name" value={form.guarantor_name} onChange={handleChange} style={{ height: 36, padding: '0 10px', border: '1px solid #cfd8e3', borderRadius: 4 }} />
					</label>
					<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>Customer Adhar Number
						<input name="customer_adhar_number" value={form.customer_adhar_number} onChange={handleChange} style={{ height: 36, padding: '0 10px', border: '1px solid #cfd8e3', borderRadius: 4 }} />
					</label>
					<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>Guarantor Adhar Number
						<input name="guarantor_adhar_number" value={form.guarantor_adhar_number} onChange={handleChange} style={{ height: 36, padding: '0 10px', border: '1px solid #cfd8e3', borderRadius: 4 }} />
					</label>
				</div>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginTop: 12 }}>
					<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>Address
						<textarea name="address" value={form.address} onChange={handleChange} rows={3} style={{ padding: 10, border: '1px solid #cfd8e3', borderRadius: 4, resize: 'vertical' }} />
					</label>
					<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>Notes
						<textarea name="notes" value={form.notes} onChange={handleChange} rows={3} style={{ padding: 10, border: '1px solid #cfd8e3', borderRadius: 4, resize: 'vertical' }} />
					</label>
				</div>
				<h4 style={{ margin: '16px 0 10px' }}>Documents</h4>
				<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
					{documentFields.filter(field => field.key !== 'customer_photo').map(field => (
						<label key={field.key} style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
							{field.label}
							<input
								type="file"
								accept={field.accept}
								onChange={event => setFiles(prev => ({ ...prev, [field.key]: event.target.files?.[0] || null }))}
								style={{ fontWeight: 400 }}
							/>
							<span style={{ color: '#667085', fontSize: 12, fontWeight: 400 }}>
								{files[field.key]?.name || getDocumentName(field.key) || 'No file selected'}
							</span>
							{getDocumentUrl(field.key) && (
								<a href={getDocumentUrl(field.key)} target="_blank" rel="noreferrer" style={{ color: '#1976d2', fontSize: 13, fontWeight: 600 }}>
									View Document
								</a>
							)}
						</label>
					))}
				</div>
				{error && <p style={{ margin: '12px 0 0', color: '#b42318' }}>{error}</p>}
				<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18, paddingTop: 12, borderTop: '1px solid #eef2f6', position: 'sticky', bottom: -20, background: '#fff' }}>
					<button type="button" onClick={onCancel} disabled={loading} style={{ padding: '8px 14px', border: '1px solid #cfd8e3', background: '#fff', borderRadius: 4 }}>Cancel</button>
					<button type="submit" disabled={loading} style={{ padding: '8px 14px', border: 'none', background: '#1976d2', color: '#fff', borderRadius: 4 }}>
						{loading ? 'Saving...' : 'Save Customer'}
					</button>
				</div>
			</form>
		</div>
	);
}

const Customers = () => {
	const [customers, setCustomers] = useState([]);
	const [filter, setFilter] = useState('');
	const [loading, setLoading] = useState(true);
	const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
	const [showAdd, setShowAdd] = useState(false);
	const [selectedCustomer, setSelectedCustomer] = useState(null);
	const [showEdit, setShowEdit] = useState(false);

	const loadCustomers = () => {
		setLoading(true);
		fetch(`${API_BASE_URL}/api/customers`)
			.then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
			.then(data => {
				setCustomers(Array.isArray(data) ? data : []);
				setLoading(false);
			})
			.catch(() => {
				setCustomers([]);
				setLoading(false);
			});
	};

	useEffect(() => {
		loadCustomers();
	}, []);


		// Filtering
		const filteredCustomers = customers.filter(cust =>
			Object.values(cust).some(val =>
				String(val).toLowerCase().includes(filter.toLowerCase())
			)
		);

		// Sorting
		const sortedCustomers = React.useMemo(() => {
			if (!sortConfig.key) return filteredCustomers;
			const sorted = [...filteredCustomers].sort((a, b) => {
				const aVal = a[sortConfig.key] || '';
				const bVal = b[sortConfig.key] || '';
				if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
				if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
				return 0;
			});
			return sorted;
		}, [filteredCustomers, sortConfig]);

		// Sort handler
		const handleSort = (key) => {
			setSortConfig(prev => {
				if (prev.key === key) {
					return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
				}
				return { key, direction: 'asc' };
			});
		};

	return (
		<div style={{ padding: 24 }}>
			<h2 style={{ color: 'navy', marginBottom: 10 }}>Customers</h2>
			<div className="sticky-toolbar mobile-toolbar" style={{ display: 'flex', alignItems: 'center', marginBottom: 12, position: 'sticky', top: 0, background: '#fff', zIndex: 20, padding: '12px 0 12px 0', boxShadow: '0 2px 8px -6px #aaa' }}>
				<span style={{ fontSize: 15, color: '#555', marginRight: 24 }}>{filteredCustomers.length} records</span>
				<input
					type="text"
					placeholder="Search customers..."
					value={filter}
					onChange={e => setFilter(e.target.value)}
					style={{ padding: 6, width: 240, marginRight: 8, fontSize: '13px' }}
				/>
				   <button onClick={() => setShowAdd(true)} style={{ padding: '6px 18px', fontSize: '13px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4 }}>New Customer</button>
				   <button
					   onClick={() => selectedCustomer && setShowEdit(true)}
					   disabled={!selectedCustomer}
					   style={{ padding: '6px 18px', fontSize: '13px', background: selectedCustomer ? '#067647' : '#98a2b3', color: '#fff', border: 'none', borderRadius: 4, marginLeft: 8, cursor: selectedCustomer ? 'pointer' : 'not-allowed' }}
				   >
					   Edit Selected
				   </button>
				   {showAdd && (
					   <NewCustomerForm
						   onSuccess={() => { setShowAdd(false); loadCustomers(); }}
						   onCancel={() => setShowAdd(false)}
					   />
				   )}
				   {showEdit && selectedCustomer && (
					   <CustomerEditModal
						   customer={selectedCustomer}
						   onCancel={() => setShowEdit(false)}
						   onSuccess={(updatedCustomer) => {
							   setShowEdit(false);
							   setSelectedCustomer(updatedCustomer);
							   loadCustomers();
						   }}
					   />
				   )}
			</div>
			<div className="desktop-table-wrap">
				<table className="fixed-header-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', background: '#fff', boxShadow: '0 1px 4px #eee' }}>
					<thead className="sticky-header">
						<tr>
							{columns.map(col => (
								<th
									key={col.key}
									style={{ borderBottom: '1px solid #ccc', padding: '4px 6px', textAlign: 'left', fontWeight: 600, background: '#fafbfc', position: 'sticky', top: 0, zIndex: 11, cursor: col.key !== 'slno' ? 'pointer' : 'default', userSelect: 'none' }}
									onClick={col.key !== 'slno' ? () => handleSort(col.key) : undefined}
								>
									{col.label}
									{sortConfig.key === col.key && (
										<span style={{ marginLeft: 4, fontSize: 12 }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>
									)}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{loading ? (
							<tr><td colSpan={columns.length}>Loading...</td></tr>
						) : sortedCustomers.length === 0 ? (
							<tr><td colSpan={columns.length}>No customers found.</td></tr>
						) : (
							sortedCustomers.map((cust, idx) => (
								<tr
									key={idx}
									className={selectedCustomer?.customer_id === cust.customer_id ? 'selected-record-row' : undefined}
									onClick={() => setSelectedCustomer(cust)}
									onDoubleClick={() => { setSelectedCustomer(cust); setShowEdit(true); }}
									style={{
										transition: 'background 0.2s',
										cursor: 'pointer',
									}}
								>
									{/* Sl.No */}
									<td style={{ padding: '4px 6px', borderBottom: '1px solid #eee', color: '#555' }}>{idx + 1}</td>
									{/* Customer ID as link */}
									<td style={{ padding: '4px 6px', borderBottom: '1px solid #eee' }}>
										<button type="button" onClick={(event) => { event.stopPropagation(); setSelectedCustomer(cust); setShowEdit(true); }} style={{ color: '#1976d2', fontWeight: 600, textDecoration: 'none', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}>{cust.customer_id}</button>
									</td>
									{/* Customer Name */}
									<td style={{ padding: '4px 6px', borderBottom: '1px solid #eee' }}>{cust.customer_name}</td>
									{/* Date of Birth */}
									<td style={{ padding: '4px 6px', borderBottom: '1px solid #eee' }}>{cust.date_of_birth ? formatDate(cust.date_of_birth.split('T')[0]) : ''}</td>
									{/* Mobile Number */}
									<td style={{ padding: '4px 6px', borderBottom: '1px solid #eee' }}>{cust.mobile_number}</td>
									{/* Area */}
									<td style={{ padding: '4px 6px', borderBottom: '1px solid #eee' }}>{cust.area}</td>
									{/* Occupation */}
									<td style={{ padding: '4px 6px', borderBottom: '1px solid #eee' }}>{cust.occupation}</td>
									{/* Customer Category with badge */}
									<td style={{ padding: '4px 6px', borderBottom: '1px solid #eee' }}>
										{cust.customer_category === 'Good' ? (
											<span className="badge badge-good">Good</span>
										) : cust.customer_category === 'Doubtfull' ? (
											<span className="badge badge-doubt">Doubtfull</span>
										) : cust.customer_category === 'Bad' ? (
											<span className="badge badge-bad">Bad</span>
										) : (
											cust.customer_category
										)}
									</td>
									{/* City */}
									<td style={{ padding: '4px 6px', borderBottom: '1px solid #eee' }}>{cust.city}</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</div>
			<div className="mobile-card-list">
				{loading ? (
					<div className="mobile-record-card">Loading...</div>
				) : sortedCustomers.length === 0 ? (
					<div className="mobile-record-card">No customers found.</div>
				) : sortedCustomers.map((cust, idx) => (
					<div
						className={`mobile-record-card ${selectedCustomer?.customer_id === cust.customer_id ? 'selected' : ''}`}
						key={cust.customer_id || idx}
						onClick={() => setSelectedCustomer(cust)}
						onDoubleClick={() => { setSelectedCustomer(cust); setShowEdit(true); }}
					>
						<div className="mobile-card-title">
							<div>
								{cust.customer_name || 'Customer'}
								<div className="mobile-card-subtitle">{cust.customer_id} · {cust.mobile_number || ''}</div>
							</div>
							{cust.customer_category && <span className="mobile-badge">{cust.customer_category}</span>}
						</div>
						<div className="mobile-card-grid">
							<div className="mobile-card-field">
								<span className="mobile-card-label">Area</span>
								<span className="mobile-card-value">{cust.area || ''}</span>
							</div>
							<div className="mobile-card-field">
								<span className="mobile-card-label">City</span>
								<span className="mobile-card-value">{cust.city || ''}</span>
							</div>
							<div className="mobile-card-field">
								<span className="mobile-card-label">DOB</span>
								<span className="mobile-card-value">{cust.date_of_birth ? formatDate(String(cust.date_of_birth).split('T')[0]) : ''}</span>
							</div>
							<div className="mobile-card-field">
								<span className="mobile-card-label">Occupation</span>
								<span className="mobile-card-value">{cust.occupation || ''}</span>
							</div>
						</div>
					</div>
				))}
			</div>
			<style>{`
				.badge {
					display: inline-block;
					padding: 2px 10px;
					border-radius: 10px;
					font-size: 12px;
					font-weight: 500;
					color: #fff;
				}
				.badge-good {
					background: #6fcf97;
					color: #fff;
				}
				.badge-doubt {
					background: #ffb74d;
					color: #fff;
				}
				.badge-bad {
					background: #e74c3c;
					color: #fff;
				}
				.fixed-header-table thead th {
					position: sticky;
					top: 0;
					background: #fafbfc;
					z-index: 11;
				}
				.fixed-header-table tbody tr:hover {
					background: #f5faff;
				}
				.sticky-toolbar {
					position: sticky;
					top: 0;
					background: #fff;
					z-index: 20;
					box-shadow: 0 2px 8px -6px #aaa;
				}
			`}</style>
		</div>
	);
};

export default Customers;
