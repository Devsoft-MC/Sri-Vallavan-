// (Removed duplicate imports)
import React, { useEffect, useState } from 'react';
import Select from 'react-select';
import API_BASE_URL from '../../api';

const columns = [
	{ label: 'Collection ID', key: 'collection_id', style: { minWidth: 110, maxWidth: 130, width: 120 } },
	{ label: 'Customer ID', key: 'customer_id', style: { minWidth: 90, maxWidth: 110, width: 100 } },
	{ label: 'Customer Name', key: 'customer_name', style: { minWidth: 180, maxWidth: 260, width: 220 } },
	// { label: 'Loan ID', key: 'loan_id', style: { minWidth: 90, maxWidth: 110, width: 100 } },
	{ label: 'Collected Date', key: 'collection_date', style: { minWidth: 120, maxWidth: 140, width: 130 } },
	{ label: 'Collected Amount', key: 'collection_amount', style: { minWidth: 120, maxWidth: 140, width: 130, textAlign: 'right' } },
	{ label: 'Collection Type', key: 'collection_type', style: { minWidth: 120, maxWidth: 140, width: 130 } },
	{ label: 'Collected By', key: 'collected_by_name', style: { minWidth: 110, maxWidth: 130, width: 120 } },
];

const modalStyle = {
	position: 'fixed',
	top: 0,
	left: 0,
	width: '100vw',
	height: '100vh',
	background: 'rgba(0,0,64,0.2)',
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'center',
	zIndex: 1000,
};

const formBoxStyle = {
	background: '#fff',
	padding: 40,
	borderRadius: 10,
	minWidth: 500,
	maxWidth: 700,
	boxShadow: '0 4px 32px rgba(0,0,0,0.18)',
};

const backendUrl = API_BASE_URL;

// Helper to get yesterday's date in YYYY-MM-DD format
function getYesterday() {
	const d = new Date();
	d.setDate(d.getDate() - 1);
	return d.toISOString().slice(0, 10);
}

const initialForm = {
	customer_id: '',
	loan_id: '',
	collection_date: getYesterday(),
	collection_amount: '',
	collection_type: '',
	collected_by_name: '',
};




const Collections = () => {
	const [sortKey, setSortKey] = useState('');
	const [sortOrder, setSortOrder] = useState('asc');

	// Sort handler
	const handleSort = (key) => {
		if (sortKey === key) {
			setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
		} else {
			setSortKey(key);
			setSortOrder('asc');
		}
	};
	// State for filter text, date range, and collected by
	const [filterText, setFilterText] = useState("");
	const [debouncedFilterText, setDebouncedFilterText] = useState("");

	// Debounce filterText
	React.useEffect(() => {
		const handler = setTimeout(() => {
			setDebouncedFilterText(filterText);
		}, 1200); // 1200ms debounce for more relaxed typing
		return () => clearTimeout(handler);
	}, [filterText]);
	const [fromDate, setFromDate] = useState("");
	const [toDate, setToDate] = useState("");
	const [filterCollectedBy, setFilterCollectedBy] = useState("");
			// Export handler (must be outside JSX)
			const handleExport = () => {
				if (exportType === 'excel') {
					exportToExcel();
				} else {
					exportToPDF();
				}
				setShowExportDialog(false);
			};

			// Export to Excel
			const exportToExcel = () => {
				import('xlsx').then(XLSX => {
					const ws = XLSX.utils.json_to_sheet(data);
					const wb = XLSX.utils.book_new();
					XLSX.utils.book_append_sheet(wb, ws, 'Collections');
					XLSX.writeFile(wb, 'collections.xlsx');
				});
			};

			// Export to PDF
			const exportToPDF = () => {
				import('jspdf').then(jsPDFModule => {
					const jsPDF = jsPDFModule.default;
					import('jspdf-autotable').then(autoTableModule => {
						const doc = new jsPDF();
						autoTableModule.default(doc, {
							head: [columns.map(col => col.label)],
							body: data.map(row => columns.map(col => row[col.key])),
							styles: { fontSize: 8 }, // Reduce font size here
							headStyles: { fontSize: 9 }, // Slightly larger for header
						});
						doc.save('collections.pdf');
					});
				});
			};
		const [showExportDialog, setShowExportDialog] = useState(false);
		const [exportType, setExportType] = useState('excel');
	const [collectionTypes, setCollectionTypes] = useState([]);
	const [employees, setEmployees] = useState([]);
	const [isEditMode, setIsEditMode] = useState(false);
	// Helper to format date as DDMMMYYYY (e.g., 24APR2026)
	function formatDate(dateStr) {
		const date = new Date(dateStr);
		if (isNaN(date)) return dateStr;
		const day = String(date.getDate()).padStart(2, '0');
		const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
		const year = date.getFullYear();
		return `${day}${month}${year}`;
	}

	const [data, setData] = useState([]);
	// Helper to parse date in either YYYY-MM-DD or DDMMMYYYY format
	// Clean and reliable date parsing for filtering
	// Always extract YYYY-MM-DD for comparison (works for ISO, YYYY-MM-DD, and DDMMMYYYY)
	function normalizeToYMD(dateStr) {
		if (!dateStr) return null;
		// If ISO or YYYY-MM-DD, parse as local date
		if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
			// Always use local time for filtering
			const date = new Date(dateStr);
			const year = date.getFullYear();
			const month = String(date.getMonth() + 1).padStart(2, '0');
			const day = String(date.getDate()).padStart(2, '0');
			return `${year}-${month}-${day}`;
		}
		// If DDMMMYYYY (e.g., 22APR2026)
		const ddmmmyyyy = /^([0-9]{2})([A-Z]{3})([0-9]{4})$/;
		const match = dateStr.match(ddmmmyyyy);
		if (match) {
			const day = match[1];
			const monthStr = match[2];
			const year = match[3];
			const months = {
				JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
				JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12'
			};
			const month = months[monthStr];
			if (month) {
				return `${year}-${month}-${day}`;
			}
		}
		return null;
	}

	// Sort data if sortKey is set
	const filteredData = React.useMemo(() => {
		if (!sortKey) return data;
		const sorted = [...data].sort((a, b) => {
			let aVal = a[sortKey];
			let bVal = b[sortKey];
			// Try numeric sort if possible
			if (!isNaN(parseFloat(aVal)) && !isNaN(parseFloat(bVal))) {
				aVal = parseFloat(aVal);
				bVal = parseFloat(bVal);
			} else if (typeof aVal === 'string' && typeof bVal === 'string') {
				aVal = aVal.toLowerCase();
				bVal = bVal.toLowerCase();
			}
			if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
			if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
			return 0;
		});
		return sorted;
	}, [data, sortKey, sortOrder]);

	// Dynamically update total sum as per filtered data
	const totalCollectionAmount = filteredData.reduce((sum, row) => {
		const amt = parseFloat(row.collection_amount);
		return sum + (isNaN(amt) ? 0 : amt);
	}, 0);
	const [successMsg, setSuccessMsg] = useState('');
	const [selectedRow, setSelectedRow] = useState(null);
	const [loading, setLoading] = useState(true);
	const [showModal, setShowModal] = useState(false);
	const [form, setForm] = useState(initialForm);
	const [formError, setFormError] = useState('');
	const [customers, setCustomers] = useState([]);
	const [loans, setLoans] = useState([]);
	const [loansLoading, setLoansLoading] = useState(false);
	const [deleteWarning, setDeleteWarning] = useState('');


		// Fetch collections with optional filters
		const fetchCollections = (opts = {}) => {
			setLoading(true);
			const params = new URLSearchParams();
			if (opts.fromDate) params.append('from', opts.fromDate);
			if (opts.toDate) params.append('to', opts.toDate);
			if (opts.text) params.append('text', opts.text);
			if (opts.collectedBy) params.append('collected_by', opts.collectedBy);
			const url = params.toString()
				? `${backendUrl}/api/collections?${params.toString()}`
				: `${backendUrl}/api/collections`;
			fetch(url)
				.then(async res => {
					if (!res.ok) {
						let errMsg = `HTTP ${res.status}`;
						try {
							const errJson = await res.json();
							if (errJson && errJson.error) errMsg = errJson.error;
						} catch {}
						setData([]);
						setLoading(false);
						setFormError(`Error fetching collections: ${errMsg}`);
						return;
					}
					const json = await res.json();
					setData(Array.isArray(json) ? json : []);
					setLoading(false);
				})
				.catch((err) => {
					setLoading(false);
					setFormError(`Error fetching collections: ${err.message}`);
				});
		};

		// Open modal for add or edit
				// Delete collection logic
				const handleDeleteCollection = async () => {
					if (!selectedRow) return;
					setDeleteWarning('');
					if (!window.confirm(`Are you sure you want to delete collection ${selectedRow.collection_id}? This action cannot be undone.`)) {
						return;
					}
					try {
						const res = await fetch(`${backendUrl}/api/collections/${selectedRow.collection_id}`, {
							method: 'DELETE',
						});
						if (!res.ok) throw new Error('Failed to delete collection');
						setSuccessMsg(`Collection ${selectedRow.collection_id} deleted.`);
						setSelectedRow(null);
						fetchCollections();
						setTimeout(() => setSuccessMsg(''), 5000);
					} catch (err) {
						setDeleteWarning('Failed to delete collection.');
					}
				};
		const openAddModal = () => {
			setShowModal(true);
			setIsEditMode(false);
			setForm({ ...initialForm, collection_date: getYesterday() });
			setFormError('');
		};

		const openEditModal = () => {
			if (!selectedRow) return;
			setShowModal(true);
			setIsEditMode(true);
			// Pre-fill form with selected row's data
			setForm({
				customer_id: selectedRow.customer_id || '',
				customer_name: selectedRow.customer_name || '',
				loan_id: selectedRow.loan_id || '',
				collection_date: selectedRow.collection_date ? selectedRow.collection_date.slice(0, 10) : '',
				collection_amount: selectedRow.collection_amount || '',
				collection_type: selectedRow.collection_type || '',
				collected_by_name: selectedRow.collected_by_name || '',
				collection_id: selectedRow.collection_id || '', // for update
			});
			setFormError('');
			// Optionally, fetch loans for this customer
			if (selectedRow.customer_id) {
				setLoansLoading(true);
				fetch(`${backendUrl}/api/loans-by-customer/${selectedRow.customer_id}`)
					.then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
					.then(json => setLoans(Array.isArray(json) ? json : []))
					.catch(() => setLoans([]))
					.finally(() => setLoansLoading(false));
			}
		};


	// Fetch customers, collection types, and employees when modal opens
	useEffect(() => {
		if (showModal) {
			fetch(`${backendUrl}/api/customers`)
				.then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
				.then(json => setCustomers(Array.isArray(json) ? json : []))
				.catch(() => setCustomers([]));
			fetch(`${backendUrl}/api/collection-types`)
				.then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
				.then(json => setCollectionTypes(Array.isArray(json) ? json : []))
				.catch(() => setCollectionTypes([]));
		}
	}, [showModal]);

	// Always fetch employees for filter combo box on mount
	useEffect(() => {
		fetch(`${backendUrl}/api/employees`)
			.then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
			.then(json => setEmployees(Array.isArray(json) ? json : []))
			.catch(() => setEmployees([]));
	}, []);


	// Refetch collections when date or collectedBy changes
	useEffect(() => {
		fetchCollections({
			fromDate,
			toDate,
			text: debouncedFilterText.trim(),
			collectedBy: filterCollectedBy
		});
	}, [fromDate, toDate, filterCollectedBy]);

	// Only refetch when debouncedFilterText changes
	useEffect(() => {
		fetchCollections({
			fromDate,
			toDate,
			text: debouncedFilterText.trim(),
			collectedBy: filterCollectedBy
		});
	}, [debouncedFilterText]);


	// Handle form input
	const handleFormChange = e => {
		setForm({ ...form, [e.target.name]: e.target.value });
	};

	// Handle customer select for react-select
	const handleCustomerChange = async option => {
		const customer_id = option ? option.value : '';
		setForm({
			...form,
			customer_id,
			customer_name: option ? option.label.split(' - ').slice(1).join(' - ') : '',
			loan_id: '', // reset loan_id when customer changes
		});
		setLoans([]);
		setLoansLoading(false);
		if (customer_id) {
			setLoansLoading(true);
			try {
				const res = await fetch(`${backendUrl}/api/loans-by-customer/${customer_id}`);
				const json = await res.json();
				setLoans(Array.isArray(json) ? json : []);
			} catch (err) {
				setLoans([]);
			}
			setLoansLoading(false);
		}
	};


		// Handle form submit (add or edit)
		const handleFormSubmit = async e => {
			e.preventDefault();
			setFormError('');
			setSuccessMsg('');
			// Basic validation
			if (!form.customer_id || !form.loan_id || !form.collection_date || !form.collection_amount || !form.collection_type || !form.collected_by_name) {
				setFormError('All fields are required.');
				return;
			}
			try {
				let res, dataResp;
				if (isEditMode) {
					// PUT or PATCH to backend (assume endpoint exists)
					res = await fetch(`${backendUrl}/api/collections/${form.collection_id}`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(form),
					});
					let errorMsg = 'Failed to update collection.';
					if (!res.ok) {
						try {
							const errJson = await res.json();
							if (errJson && errJson.error) errorMsg = errJson.error;
						} catch {}
						throw new Error(errorMsg);
					}
					dataResp = await res.json();
					setShowModal(false);
					setForm(initialForm);
					setSuccessMsg(`Collection updated! RV Number: ${dataResp.collection_id}`);
				} else {
					// POST to backend
					res = await fetch(`${backendUrl}/api/collections`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify(form),
					});
					let errorMsg = 'Failed to add collection.';
					if (!res.ok) {
						try {
							const errJson = await res.json();
							if (errJson && errJson.error) errorMsg = errJson.error;
						} catch {}
						throw new Error(errorMsg);
					}
					dataResp = await res.json();
					setShowModal(false);
					setForm(initialForm);
					setSuccessMsg(`Collection saved! RV Number: ${dataResp.collection_id}`);
				}
				fetchCollections();
				setTimeout(() => setSuccessMsg(''), 5000);
			} catch (err) {
				setFormError(err.message || (isEditMode ? 'Failed to update collection.' : 'Failed to add collection.'));
			}
		};


		if (loading) return null;
		if (formError) {
			return (
				<div style={{ color: 'red', background: '#fee', padding: 16, margin: 24, border: '1px solid #f99', borderRadius: 6 }}>
					{formError}
				</div>
			);
		}

		// Calculate sum total for collected amount
		const totalCollected = data.reduce((sum, row) => sum + (parseFloat(row.collection_amount) || 0), 0);

		return (
			<div style={{ padding: 24 }}>
				<h2 style={{ color: 'navy', marginBottom: 20 }}>Collections</h2>
				{successMsg && <div style={{ color: 'green', marginBottom: 12, fontWeight: 600 }}>{successMsg}</div>}

				{/* Header row for buttons and filters */}
				<div style={{ display: 'flex', gap: 10, marginBottom: 12, fontSize: '13px' }}>
					<button onClick={openAddModal} style={{ background: 'navy', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 18px' }}>Add Collection</button>
					<button disabled={!selectedRow} onClick={openEditModal} style={{ background: selectedRow ? '#ffd600' : '#eee', color: selectedRow ? '#222' : '#888', border: 'none', borderRadius: 4, padding: '6px 18px' }}>Edit Collection</button>
					<button disabled={!selectedRow} onClick={handleDeleteCollection} style={{ background: selectedRow ? '#e53935' : '#eee', color: selectedRow ? '#fff' : '#888', border: 'none', borderRadius: 4, padding: '6px 18px' }}>Delete Collection</button>
						{deleteWarning && <div style={{ color: 'red', marginBottom: 12, fontWeight: 600 }}>{deleteWarning}</div>}
					<button onClick={() => setShowExportDialog(true)} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 18px' }}>Export</button>
								{/* Export dialog */}
								{showExportDialog && (
									<div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.18)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
										<div style={{ background: '#fff', padding: 32, borderRadius: 10, minWidth: 320, boxShadow: '0 4px 32px rgba(0,0,0,0.18)' }}>
											<h3 style={{ marginTop: 0, marginBottom: 18, color: '#1976d2' }}>Export Collections</h3>
											<div style={{ marginBottom: 18 }}>
												<label style={{ display: 'block', marginBottom: 8 }}>
													<input type="radio" name="exportType" value="excel" checked={exportType === 'excel'} onChange={() => setExportType('excel')} /> Excel
												</label>
												<label style={{ display: 'block', marginBottom: 8 }}>
													<input type="radio" name="exportType" value="pdf" checked={exportType === 'pdf'} onChange={() => setExportType('pdf')} /> PDF
												</label>
											</div>
											<div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
												<button onClick={() => handleExport()} style={{ background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, padding: '6px 18px' }}>Download</button>
												<button onClick={() => setShowExportDialog(false)}>Cancel</button>
											</div>
										</div>
									</div>
								)}


					{/* Modal for Add/Edit Collection */}
					{showModal && (
						<div style={modalStyle}>
							<div style={formBoxStyle}>
								<h3 style={{ marginTop: 0, color: 'navy' }}>{isEditMode ? 'Edit Collection' : 'Add Collection'}</h3>
								<form onSubmit={handleFormSubmit}>
									<div style={{ marginBottom: 10 }}>
										<Select
											options={customers.map(c => ({ value: c.customer_id, label: `${c.customer_id} - ${c.customer_name}` }))}
											value={form.customer_id ? { value: form.customer_id, label: `${form.customer_id} - ${form.customer_name}` } : null}
											onChange={handleCustomerChange}
											placeholder="Type code or name to search"
											isClearable
											styles={{ container: base => ({ ...base, width: '100%' }) }}
									/>
								</div>
								<div style={{ marginBottom: 10 }}>
									<select
										name="loan_id"
										value={form.loan_id}
										onChange={handleFormChange}
										disabled={!form.customer_id || loansLoading}
										style={{ width: '100%', padding: 6 }}
									>
										<option value="">
										{!form.customer_id
											? 'Select customer first'
											: loansLoading
											? 'Loading loans...'
											: loans.length === 0
											? 'No open loans'
											: 'Select Loan ID'}
										</option>
										{!loansLoading && loans.map(l => (
											<option key={l.loan_id} value={l.loan_id}>{l.loan_id} ({l.loan_type})</option>
										))}
									</select>
								</div>
								<div style={{ marginBottom: 10 }}>
									<input name="collection_date" type="date" value={form.collection_date} onChange={handleFormChange} placeholder="Collection Date" style={{ width: '100%', padding: 6 }} />
								</div>
								<div style={{ marginBottom: 10 }}>
									<input name="collection_amount" value={form.collection_amount} onChange={handleFormChange} placeholder="Collection Amount" style={{ width: '100%', padding: 6 }} type="number" min="0" step="0.01" />
								</div>
								<div style={{ marginBottom: 10 }}>
									<select
										name="collection_type"
										value={form.collection_type}
										onChange={handleFormChange}
										style={{ width: '100%', padding: 6 }}
									>
										<option value="">Select Collection Type</option>
										{collectionTypes.map((type, idx) => (
											<option key={idx} value={type}>{type}</option>
										))}
									</select>
								</div>
								<div style={{ marginBottom: 10 }}>
									<select
										name="collected_by_name"
										value={form.collected_by_name}
										onChange={handleFormChange}
										style={{ width: '100%', padding: 6 }}
										aria-label="Collected By"
									>
										<option value="">Select Collected By</option>
										{employees.map((emp, idx) => (
											<option key={idx} value={emp}>{emp}</option>
										))}
									</select>
								</div>
								{formError && <div style={{ color: 'red', marginBottom: 8 }}>{formError}</div>}
								<div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
									<button type="submit" style={{ background: 'navy', color: '#fff', padding: '6px 18px', border: 'none', borderRadius: 4 }}>{isEditMode ? 'Save' : 'Add'}</button>
									<button type="button" onClick={() => { setShowModal(false); setForm(initialForm); setFormError(''); setIsEditMode(false); }}>Cancel</button>
								</div>
							</form>
						</div>
					</div>
				)}
				<input
					type="text"
					placeholder="Filter by any field"
					style={{ marginLeft: 12, padding: 3, fontSize: '13px', minWidth: 180 }}
					value={filterText}
					onChange={e => setFilterText(e.target.value)}
				/>
				<label style={{ marginLeft: 12, fontSize: '13px' }}>
					Collected By
					<select
						style={{ marginLeft: 6, padding: 3, fontSize: '13px', minWidth: 140 }}
						value={filterCollectedBy}
						onChange={e => setFilterCollectedBy(e.target.value)}
					>
						<option value="">All</option>
						{employees.map((emp, idx) => (
							<option key={idx} value={emp}>{emp}</option>
						))}
					</select>
				</label>
				<span style={{ fontSize: '12px', marginLeft: 10 }}>From Date</span>
				<input
					type="date"
					style={{ padding: 3, fontSize: '13px', marginLeft: 4 }}
					value={fromDate}
					onChange={e => setFromDate(e.target.value)}
				/>
				<span style={{ fontSize: '12px', marginLeft: 10 }}>To Date</span>
				<input
					type="date"
					style={{ padding: 3, fontSize: '13px', marginLeft: 4 }}
					value={toDate}
					onChange={e => setToDate(e.target.value)}
				/>
				<button
					style={{ marginLeft: 8, padding: '3px 14px', fontSize: '13px', background: '#eee', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}
					onClick={() => {
						setFilterText("");
						setFromDate("");
						setToDate("");
						setFilterCollectedBy("");
					}}
				>Clear</button>
				</div>

				<div style={{ maxHeight: 'none', overflowY: 'visible', width: '100%' }}>
					<table className="fixed-header-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
								<thead>
									<tr style={{ position: 'sticky', top: 0, background: '#fafbfc', zIndex: 10 }}>
										{columns.map(col => (
											<th
												key={col.key}
												style={{ borderBottom: '1px solid #ccc', padding: '4px 6px', textAlign: 'left', cursor: 'pointer', userSelect: 'none', ...(col.style || {}) }}
												onClick={() => handleSort(col.key)}
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
									{filteredData.map((row, idx) => (
											<tr
													key={idx}
													onClick={() => setSelectedRow(row)}
													style={{
															background: selectedRow && selectedRow.collection_id === row.collection_id ? '#e6f0ff' : '',
															cursor: 'pointer',
													}}
											>
													{columns.map(col => {
														let value = row[col.key];
														// Format all date fields as ddmmmyyyy and remove time
														if (col.key.toLowerCase().includes('date') && value) {
															// Remove time if present
															value = value.split('T')[0];
															value = formatDate(value);
														}
														return (
															<td key={col.key} style={{ padding: '4px 6px', borderBottom: '1px solid #eee', ...(col.style || {}) }}>
																{value}
															</td>
														);
													})}
											</tr>
									))}
							</tbody>
						{/* Footer row for sum total */}
						<tfoot>
							<tr style={{ position: 'sticky', bottom: 0, background: '#f9f9f9', zIndex: 2 }}>
								<td colSpan={4} style={{ background: '#f9f9f9', border: 'none' }}></td>
								<td style={{ textAlign: 'right', fontWeight: 'normal', padding: '2px 4px', background: '#f9f9f9', position: 'sticky', bottom: 0, zIndex: 2, fontSize: '13px', border: 'none' }}>Total Collected Amount:</td>
								<td style={{ fontWeight: 'bold', padding: '2px 4px', background: '#f9f9f9', position: 'sticky', bottom: 0, zIndex: 2, fontSize: '13px', border: 'none' }}>{totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
								<td style={{ background: '#f9f9f9', border: 'none' }}></td>
							</tr>
						</tfoot>
					</table>
				</div>
			</div>
		);
};

export default Collections;
