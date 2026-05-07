

import React, { useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import API_BASE_URL from '../../api';
import CloseLoanForm from './CloseLoanForm';

const emptyNewLoanForm = {
	customer_id: '',
	loan_type: '',
	issue_date: new Date().toISOString().slice(0, 10),
	issue_amount: '',
	interest_received: '',
	maturity_date: '',
};

const columns = [
	{ label: 'Loan ID', key: 'loan_id' },
	{ label: 'Customer ID', key: 'customer_id' },
	{ label: 'Customer Name', key: 'customer_name' },
	{ label: 'Loan Type', key: 'loan_type' },
	{ label: 'Loan Issue Date', key: 'issue_date' },
	{ label: 'Maturity Date', key: 'maturity_date' },
	{ label: 'Closing Date', key: 'closing_date' },
	{ label: 'Loan Issued Amount', key: 'issue_amount' },
	{ label: 'Collected Amount', key: 'collected_amount' },
	{ label: 'Balance', key: 'balance' },
	{ label: 'Interest Received', key: 'interest_received' },
	{ label: 'Adjustments', key: 'adjustments' },
	{ label: 'Status', key: 'status' },
];

function formatDate(dateStr) {
	if (!dateStr) return '';
	const date = new Date(dateStr.split('T')[0]);
	if (isNaN(date)) return dateStr;
	const day = String(date.getDate()).padStart(2, '0');
	const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
	const year = date.getFullYear();
	return `${day}${month}${year}`;
}

function formatLoanType(loanType) {
	return String(loanType || '').replace(/\s*loan\s*/i, '').trim();
}

function addDaysUtc(dateObj, days) {
	const date = new Date(dateObj);
	date.setUTCDate(date.getUTCDate() + days);
	return date;
}

function addMonthsUtc(dateObj, months) {
	const date = new Date(dateObj);
	date.setUTCMonth(date.getUTCMonth() + months);
	return date;
}

function resolveLoanTypeCode(loanType = '') {
	const type = String(loanType).toLowerCase();
	if (type.includes('personal') || type === 'pl') return 'PL';
	if (type.includes('vehicle') || type === 'vl') return 'VL';
	if (type.includes('gold') || type === 'gl') return 'GL';
	return null;
}

function calculateDefaultMaturityDate(loanType, issueDate) {
	if (!loanType || !issueDate) return '';
	const issueDateObj = new Date(issueDate);
	if (Number.isNaN(issueDateObj.getTime())) return '';

	const loanTypeCode = resolveLoanTypeCode(loanType);
	if (loanTypeCode === 'PL') return addDaysUtc(issueDateObj, 100).toISOString().slice(0, 10);
	if (loanTypeCode === 'VL') return addDaysUtc(issueDateObj, 365).toISOString().slice(0, 10);
	if (loanTypeCode === 'GL') return addMonthsUtc(issueDateObj, 3).toISOString().slice(0, 10);
	return '';
}

function isOpenLoan(loan) {
	return String(loan?.status || '').toLowerCase() !== 'closed' && loan?.loan_status_closed !== true;
}

const Loans = () => {
	const [loans, setLoans] = useState([]);
	const [collections, setCollections] = useState([]);
	const [filter, setFilter] = useState('');
	const [loading, setLoading] = useState(true);
	const [collectionsLoading, setCollectionsLoading] = useState(true);
	const [showNewLoanModal, setShowNewLoanModal] = useState(false);
	const [newLoanForm, setNewLoanForm] = useState(emptyNewLoanForm);
	const [customers, setCustomers] = useState([]);
	const [loanTypes, setLoanTypes] = useState([]);
	const [newLoanLoading, setNewLoanLoading] = useState(false);
	const [newLoanSubmitting, setNewLoanSubmitting] = useState(false);
	const [newLoanError, setNewLoanError] = useState('');
	const [showCloseLoanModal, setShowCloseLoanModal] = useState(false);
	const [selectedLoan, setSelectedLoan] = useState(null);

	const loadLoans = () => {
		setLoading(true);
		fetch(`${API_BASE_URL}/api/loans`)
			.then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
			.then(data => {
				setLoans(Array.isArray(data) ? data : []);
				setSelectedLoan(current => {
					if (!current) return null;
					const refreshedLoan = Array.isArray(data) ? data.find(loan => loan.loan_id === current.loan_id) : null;
					return refreshedLoan && isOpenLoan(refreshedLoan) ? refreshedLoan : null;
				});
				setLoading(false);
			})
			.catch(() => {
				setLoans([]);
				setLoading(false);
			});
	};

	const loadCollections = () => {
		setCollectionsLoading(true);
		fetch(`${API_BASE_URL}/api/collections?text=%25`)
			.then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
			.then(data => {
				setCollections(Array.isArray(data) ? data : []);
				setCollectionsLoading(false);
			})
			.catch(() => {
				setCollections([]);
				setCollectionsLoading(false);
		});
	};

	useEffect(() => {
		loadLoans();
		loadCollections();
	}, []);

	useEffect(() => {
		if (!showNewLoanModal) return;
		setNewLoanLoading(true);
		setNewLoanError('');
		Promise.all([
			fetch(`${API_BASE_URL}/api/customers`).then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))),
			fetch(`${API_BASE_URL}/api/loan-types`).then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))),
		])
			.then(([customerData, loanTypeData]) => {
				setCustomers(Array.isArray(customerData) ? customerData : []);
				setLoanTypes(Array.isArray(loanTypeData) ? loanTypeData : []);
			})
			.catch(() => {
				setCustomers([]);
				setLoanTypes([]);
				setNewLoanError('Unable to load customers or loan types.');
			})
			.finally(() => setNewLoanLoading(false));
	}, [showNewLoanModal]);

	useEffect(() => {
		if (!showNewLoanModal) return;
		const maturityDate = calculateDefaultMaturityDate(newLoanForm.loan_type, newLoanForm.issue_date);
		setNewLoanForm(current => (
			current.maturity_date === maturityDate
				? current
				: { ...current, maturity_date: maturityDate }
		));
	}, [showNewLoanModal, newLoanForm.loan_type, newLoanForm.issue_date]);

	const openNewLoanModal = () => {
		setNewLoanForm({
			...emptyNewLoanForm,
			issue_date: new Date().toISOString().slice(0, 10),
		});
		setNewLoanError('');
		setShowNewLoanModal(true);
	};

	const closeNewLoanModal = () => {
		if (newLoanSubmitting) return;
		setShowNewLoanModal(false);
		setNewLoanForm(emptyNewLoanForm);
		setNewLoanError('');
	};

	const handleNewLoanChange = (e) => {
		const { name, value } = e.target;
		setNewLoanForm(current => ({
			...current,
			[name]: value,
		}));
	};

	const handleNewLoanSubmit = async (e) => {
		e.preventDefault();
		setNewLoanError('');

		if (!newLoanForm.customer_id || !newLoanForm.loan_type || !newLoanForm.issue_date || !newLoanForm.issue_amount) {
			setNewLoanError('Customer, loan type, issue date, and amount are required.');
			return;
		}

		setNewLoanSubmitting(true);
		try {
			const res = await fetch(`${API_BASE_URL}/api/loans`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(newLoanForm),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(data.error || 'Failed to add loan.');
			}

			setShowNewLoanModal(false);
			setNewLoanForm(emptyNewLoanForm);
			loadLoans();
		} catch (err) {
			setNewLoanError(err.message || 'Failed to add loan.');
		} finally {
			setNewLoanSubmitting(false);
		}
	};

	const collectedByLoanId = useMemo(() => {
		return collections.reduce((totals, collection) => {
			const loanId = String(collection.loan_id || '').trim();
			if (!loanId) return totals;
			totals[loanId] = (totals[loanId] || 0) + (parseFloat(collection.collection_amount) || 0);
			return totals;
		}, {});
	}, [collections]);

	function getCollectedAmount(loan_id) {
		return collectedByLoanId[String(loan_id || '').trim()] || 0;
	}

	const filteredLoans = loans.filter(loan =>
		Object.values(loan).some(val =>
			String(val).toLowerCase().includes(filter.toLowerCase())
		)
	);

	// Calculate totals for footer
	const totalIssued = filteredLoans.reduce((sum, loan) => sum + (parseFloat(loan.issue_amount) || 0), 0);
	const totalCollected = filteredLoans.reduce((sum, loan) => sum + getCollectedAmount(loan.loan_id), 0);
	const totalBalance = totalIssued - totalCollected;
	const customerOptions = customers.map(customer => ({
		value: customer.customer_id,
		label: `${customer.customer_id} - ${customer.customer_name}`,
	}));
	const selectedCustomerOption = customerOptions.find(option => option.value === newLoanForm.customer_id) || null;
	const loanTypeOptions = loanTypes.map(type => ({
		value: type.loan_type_name || type.loan_type_code,
		label: type.loan_type_name || type.loan_type_code,
	}));
	const selectedLoanTypeOption = loanTypeOptions.find(option => option.value === newLoanForm.loan_type) || null;
	const canCloseSelectedLoan = selectedLoan && isOpenLoan(selectedLoan);

	return (
		<div style={{ padding: 24 }}>
			<h2 style={{ color: 'navy', marginBottom: 20 }}>Loans</h2>
			<div style={{ marginBottom: 16, fontSize: '13px', display: 'flex', alignItems: 'center', gap: 10 }}>
				<input
					type="text"
					placeholder="Filter loans..."
					value={filter}
					onChange={e => setFilter(e.target.value)}
					style={{ padding: 6, width: 240, fontSize: '13px' }}
				/>
				<button onClick={() => { loadLoans(); loadCollections(); }} style={{ padding: '6px 18px', fontSize: '13px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4 }}>Refresh</button>
				<button type="button" onClick={openNewLoanModal} style={{ padding: '6px 18px', fontSize: '13px', background: 'navy', color: '#fff', border: 'none', borderRadius: 4 }}>New Loan</button>
				<button
					type="button"
					onClick={() => canCloseSelectedLoan && setShowCloseLoanModal(true)}
					disabled={!canCloseSelectedLoan}
					style={{
						padding: '6px 18px',
						fontSize: '13px',
						background: canCloseSelectedLoan ? '#d32f2f' : '#eee',
						color: canCloseSelectedLoan ? '#fff' : '#888',
						border: 'none',
						borderRadius: 4,
						cursor: canCloseSelectedLoan ? 'pointer' : 'not-allowed',
					}}
				>
					Close Loan
				</button>
			</div>
			{showCloseLoanModal && (
				<CloseLoanForm
					loan={{
						...selectedLoan,
						collected_amount: getCollectedAmount(selectedLoan?.loan_id),
					}}
					onClose={() => setShowCloseLoanModal(false)}
					onSuccess={() => {
						setShowCloseLoanModal(false);
						setSelectedLoan(null);
						loadLoans();
					}}
				/>
			)}
			{showNewLoanModal && (
				<div style={{
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
				}}>
					<form onSubmit={handleNewLoanSubmit} style={{
						background: '#fff',
						borderRadius: 8,
						boxShadow: '0 2px 16px rgba(0,0,0,0.15)',
						padding: 28,
						minWidth: 360,
						maxWidth: 520,
						width: '100%',
					}}>
						<h3 style={{ marginTop: 0, color: 'navy' }}>New Loan</h3>
						{newLoanLoading ? (
							<div style={{ padding: '16px 0' }}>Loading...</div>
						) : (
							<>
								<div style={{ marginBottom: 10 }}>
									<label style={{ display: 'block', marginBottom: 4 }}>Customer</label>
									<Select
										options={customerOptions}
										value={selectedCustomerOption}
										onChange={option => {
											setNewLoanForm(current => ({
												...current,
												customer_id: option ? option.value : '',
											}));
										}}
										placeholder="Type code or name to search"
										isClearable
										styles={{ container: base => ({ ...base, width: '100%' }) }}
									/>
								</div>
								<div style={{ marginBottom: 10 }}>
									<label style={{ display: 'block', marginBottom: 4 }}>Loan Type</label>
									<Select
										options={loanTypeOptions}
										value={selectedLoanTypeOption}
										onChange={option => {
											setNewLoanForm(current => ({
												...current,
												loan_type: option ? option.value : '',
												maturity_date: option ? current.maturity_date : '',
											}));
										}}
										placeholder="Select Loan Type"
										isClearable
										styles={{ container: base => ({ ...base, width: '100%' }) }}
									/>
								</div>
								<div style={{ marginBottom: 10 }}>
									<label style={{ display: 'block', marginBottom: 4 }}>Issue Date</label>
									<input
										name="issue_date"
										type="date"
										value={newLoanForm.issue_date}
										onChange={handleNewLoanChange}
										required
										style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', boxSizing: 'border-box' }}
									/>
								</div>
								<div style={{ marginBottom: 10 }}>
									<label style={{ display: 'block', marginBottom: 4 }}>Maturity Date</label>
									<input
										name="maturity_date"
										type="date"
										value={newLoanForm.maturity_date}
										readOnly
										style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', boxSizing: 'border-box', background: '#f5f5f5' }}
									/>
								</div>
								<div style={{ marginBottom: 10 }}>
									<label style={{ display: 'block', marginBottom: 4 }}>Loan Amount</label>
									<input
										name="issue_amount"
										type="number"
										min="0"
										step="0.01"
										value={newLoanForm.issue_amount}
										onChange={handleNewLoanChange}
										required
										style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', boxSizing: 'border-box' }}
									/>
								</div>
								<div style={{ marginBottom: 10 }}>
									<label style={{ display: 'block', marginBottom: 4 }}>Interest Received</label>
									<input
										name="interest_received"
										type="number"
										min="0"
										step="0.01"
										value={newLoanForm.interest_received}
										onChange={handleNewLoanChange}
										style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ccc', boxSizing: 'border-box' }}
									/>
								</div>
							</>
						)}
						{newLoanError && <div style={{ color: 'red', marginBottom: 12 }}>{newLoanError}</div>}
						<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 22 }}>
							<button type="button" onClick={closeNewLoanModal} disabled={newLoanSubmitting} style={{ padding: '8px 18px', borderRadius: 4, border: '1px solid #ccc', background: '#f5f5f5' }}>Cancel</button>
							<button type="submit" disabled={newLoanSubmitting || newLoanLoading} style={{ padding: '8px 18px', borderRadius: 4, border: 'none', background: 'navy', color: '#fff', fontWeight: 600 }}>
								{newLoanSubmitting ? 'Saving...' : 'Save'}
							</button>
						</div>
					</form>
				</div>
			)}
			<div style={{ maxHeight: 'none', overflowY: 'visible', width: '100%' }}>
				<table className="fixed-header-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
					<thead>
						<tr style={{ position: 'sticky', top: 0, background: '#fafbfc', zIndex: 10 }}>
							{columns.map(col => (
								<th key={col.key} style={{ borderBottom: '1px solid #ccc', padding: '4px 6px', textAlign: 'left' }}>{col.label}</th>
							))}
						</tr>
					</thead>
					<tbody>
						{loading || collectionsLoading ? (
							<tr><td colSpan={columns.length}>Loading...</td></tr>
						) : filteredLoans.length === 0 ? (
							<tr><td colSpan={columns.length}>No loans found.</td></tr>
						) : (
							filteredLoans.map((loan, idx) => (
								<tr
									key={loan.loan_id || idx}
									onClick={() => setSelectedLoan(isOpenLoan(loan) ? loan : null)}
									style={{
										background: selectedLoan?.loan_id === loan.loan_id ? '#e6f0ff' : undefined,
										cursor: isOpenLoan(loan) ? 'pointer' : 'not-allowed',
										opacity: isOpenLoan(loan) ? 1 : 0.65,
									}}
								>
									{columns.map(col => {
										let value = loan[col.key];
										if (col.key === 'collected_amount') {
											value = getCollectedAmount(loan.loan_id).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
										} else if (col.key === 'balance') {
											const issued = parseFloat(loan.issue_amount) || 0;
											const collected = getCollectedAmount(loan.loan_id);
											value = (issued - collected).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
										} else if (col.key === 'loan_type') {
											value = formatLoanType(value);
										} else if (col.key.toLowerCase().includes('date') && value) {
											value = value.split('T')[0];
											value = formatDate(value);
										}
										return (
											<td key={col.key} style={{ padding: '4px 6px', borderBottom: '1px solid #eee' }}>{value}</td>
										);
									})}
								</tr>
							))
						)}
					</tbody>
					<tfoot>
						<tr style={{ background: '#f9f9f9', fontWeight: 'bold', position: 'sticky', bottom: 0, zIndex: 2 }}>
							{columns.map((col, idx) => {
								if (col.key === 'issue_amount') {
									return (
										<td key={col.key} style={{ padding: '4px 6px', border: 'none', background: '#f9f9f9', textAlign: 'right' }}>
											Loan Issued: {totalIssued.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
										</td>
									);
								} else if (col.key === 'collected_amount') {
									return (
										<td key={col.key} style={{ padding: '4px 6px', border: 'none', background: '#f9f9f9', textAlign: 'right' }}>
											Collected: {totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
										</td>
									);
								} else if (col.key === 'balance') {
									return (
										<td key={col.key} style={{ padding: '4px 6px', border: 'none', background: '#f9f9f9', textAlign: 'right' }}>
											Balance: {totalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
										</td>
									);
								} else if (idx === 0) {
									return (
										<td key={col.key} style={{ padding: '4px 6px', border: 'none', background: '#f9f9f9', textAlign: 'right' }}>Totals:</td>
									);
								} else {
									return <td key={col.key} style={{ border: 'none', background: '#f9f9f9' }}></td>;
								}
							})}
						</tr>
					</tfoot>
				</table>
			</div>
		</div>
	);
};

export default Loans;
