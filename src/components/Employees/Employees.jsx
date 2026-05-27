import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../../api';

const columns = [
	{ label: 'Actions', key: 'actions' },
	{ label: 'Employee ID', key: 'employee_id' },
	{ label: 'Name', key: 'employee_name' },
	{ label: 'Email', key: 'email' },
	{ label: 'Mobile Phone', key: 'mobile_phone' },
	{ label: 'Designation', key: 'designation' },
	{ label: 'Role', key: 'role' },
	{ label: 'Status', key: 'employment_status' },
	{ label: 'Login Email', key: 'login_email' },
	{ label: 'Login Active', key: 'login_active' },
	{ label: 'Last Login', key: 'last_login_at' },
	{ label: 'Created At', key: 'created_at' },
	{ label: 'Updated At', key: 'updated_at' },
];

const roleOptions = ['Admin', 'Manager', 'Collection Agent', 'Loan Officer', 'Viewer'];
const statusOptions = ['Active', 'Inactive'];

const emptyEmployeeForm = {
	employee_name: '',
	email: '',
	mobile_phone: '',
	designation: '',
	role: 'Viewer',
	employment_status: 'Active',
	can_collect: false,
	can_create_loans: false,
	can_manage_customers: false,
	login_email: '',
	login_active: true,
	password_reset_required: true,
	temporary_password: '',
};

function formatDate(dateStr) {
	if (!dateStr) return '';
	const date = new Date(dateStr.split('T')[0]);
	if (isNaN(date)) return dateStr;
	const day = String(date.getDate()).padStart(2, '0');
	const month = date.toLocaleString('en-US', { month: 'short' }).toUpperCase();
	const year = date.getFullYear();
	return `${day}${month}${year}`;
}

function normalizeEmployee(row, index) {
	if (typeof row === 'string') {
		return {
			employee_id: '',
			employee_name: row,
		};
	}

	return {
		...row,
		employee_name: row.employee_name || row.name || '',
	};
}

const Employees = () => {
	const [employees, setEmployees] = useState([]);
	const [filter, setFilter] = useState('');
	const [loading, setLoading] = useState(true);
	const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm);
	const [editingEmployee, setEditingEmployee] = useState(null);
	const [showEmployeeModal, setShowEmployeeModal] = useState(false);
	const [employeeSubmitting, setEmployeeSubmitting] = useState(false);
	const [employeeError, setEmployeeError] = useState('');
	const [employeeSuccess, setEmployeeSuccess] = useState('');
	const [resetEmployee, setResetEmployee] = useState(null);
	const [newPassword, setNewPassword] = useState('');
	const [resetError, setResetError] = useState('');
	const [resetSuccess, setResetSuccess] = useState('');
	const [resetSubmitting, setResetSubmitting] = useState(false);

	const loadEmployees = () => {
		setLoading(true);
		fetch(`${API_BASE_URL}/api/employees?details=1`)
			.then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
			.then(data => {
				setEmployees(Array.isArray(data) ? data.map(normalizeEmployee) : []);
				setLoading(false);
			})
			.catch(() => {
				setEmployees([]);
				setLoading(false);
			});
	};

	useEffect(() => {
		loadEmployees();
	}, []);

	const openNewEmployeeModal = () => {
		setEditingEmployee(null);
		setEmployeeForm(emptyEmployeeForm);
		setEmployeeError('');
		setEmployeeSuccess('');
		setShowEmployeeModal(true);
	};

	const openEditEmployeeModal = (employee) => {
		setEditingEmployee(employee);
		setEmployeeForm({
			employee_name: employee.employee_name || '',
			email: employee.email || '',
			mobile_phone: employee.mobile_phone || '',
			designation: employee.designation || '',
			role: employee.role || 'Viewer',
			employment_status: employee.employment_status || 'Active',
			can_collect: !!employee.can_collect,
			can_create_loans: !!employee.can_create_loans,
			can_manage_customers: !!employee.can_manage_customers,
			login_email: employee.login_email || employee.email || '',
			login_active: employee.login_active !== false,
			password_reset_required: !!employee.password_reset_required,
			temporary_password: '',
		});
		setEmployeeError('');
		setEmployeeSuccess('');
		setShowEmployeeModal(true);
	};

	const closeEmployeeModal = () => {
		if (employeeSubmitting) return;
		setShowEmployeeModal(false);
		setEditingEmployee(null);
		setEmployeeForm(emptyEmployeeForm);
		setEmployeeError('');
	};

	const handleEmployeeFieldChange = (event) => {
		const { name, value, type, checked } = event.target;
		setEmployeeForm(prev => ({
			...prev,
			[name]: type === 'checkbox' ? checked : value,
			...(name === 'email' && !editingEmployee && !prev.login_email ? { login_email: value } : {}),
		}));
		if (employeeError) setEmployeeError('');
	};

	const handleSaveEmployee = async (event) => {
		event.preventDefault();
		setEmployeeError('');
		setEmployeeSuccess('');

		if (!employeeForm.employee_name.trim() || !employeeForm.email.trim() || !employeeForm.role || !employeeForm.login_email.trim()) {
			setEmployeeError('Name, email, role and login email are required.');
			return;
		}

		if (!editingEmployee && employeeForm.temporary_password && employeeForm.temporary_password.length < 8) {
			setEmployeeError('Temporary password must be at least 8 characters.');
			return;
		}

		const payload = {
			...employeeForm,
			employee_name: employeeForm.employee_name.trim(),
			email: employeeForm.email.trim(),
			mobile_phone: employeeForm.mobile_phone.trim(),
			designation: employeeForm.designation.trim(),
			login_email: employeeForm.login_email.trim().toLowerCase(),
		};

		if (editingEmployee) {
			delete payload.temporary_password;
		}

		setEmployeeSubmitting(true);
		try {
			const url = editingEmployee
				? `${API_BASE_URL}/api/employees-details/${editingEmployee.employee_id}`
				: `${API_BASE_URL}/api/employees-details`;
			const res = await fetch(url, {
				method: editingEmployee ? 'PUT' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			});
			const data = await res.json().catch(() => ({}));

			if (!res.ok) {
				setEmployeeError(data.error || 'Unable to save employee.');
				return;
			}

			setEmployeeSuccess(editingEmployee ? 'Employee updated.' : `Employee created${data.employee_id ? `: ${data.employee_id}` : ''}.`);
			setShowEmployeeModal(false);
			setEditingEmployee(null);
			setEmployeeForm(emptyEmployeeForm);
			loadEmployees();
		} catch {
			setEmployeeError('Unable to reach the server.');
		} finally {
			setEmployeeSubmitting(false);
		}
	};

	const openResetModal = (employee) => {
		setResetEmployee(employee);
		setNewPassword('');
		setResetError('');
		setResetSuccess('');
	};

	const closeResetModal = () => {
		if (resetSubmitting) return;
		setResetEmployee(null);
		setNewPassword('');
		setResetError('');
	};

	const handleResetPassword = async (event) => {
		event.preventDefault();
		setResetError('');
		setResetSuccess('');

		if (!resetEmployee?.employee_id) {
			setResetError('Employee ID is missing.');
			return;
		}

		if (newPassword.length < 8) {
			setResetError('Password must be at least 8 characters.');
			return;
		}

		setResetSubmitting(true);
		try {
			const res = await fetch(`${API_BASE_URL}/api/employees-details/${resetEmployee.employee_id}/reset-password`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ new_password: newPassword }),
			});
			const data = await res.json().catch(() => ({}));

			if (!res.ok) {
				setResetError(data.error || 'Unable to reset password.');
				return;
			}

			setResetSuccess(`Password reset for ${resetEmployee.employee_name || resetEmployee.employee_id}.`);
			setNewPassword('');
			loadEmployees();
		} catch {
			setResetError('Unable to reach the server.');
		} finally {
			setResetSubmitting(false);
		}
	};

	const filteredEmployees = employees.filter(emp =>
		Object.values(emp).some(val =>
			String(val).toLowerCase().includes(filter.toLowerCase())
		)
	);

	return (
		<div style={{ padding: 24 }}>
			<h2 style={{ color: 'navy', marginBottom: 20 }}>Employees</h2>
			<div className="mobile-toolbar" style={{ marginBottom: 16, fontSize: '13px' }}>
				<input
					type="text"
					placeholder="Search employee..."
					value={filter}
					onChange={e => setFilter(e.target.value)}
					style={{ padding: 6, width: 240, marginRight: 8, fontSize: '13px' }}
				/>
				<button onClick={loadEmployees} style={{ padding: '6px 18px', fontSize: '13px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4 }}>Refresh</button>
				<button onClick={openNewEmployeeModal} style={{ padding: '6px 18px', fontSize: '13px', background: '#067647', color: '#fff', border: 'none', borderRadius: 4, marginLeft: 8 }}>New Employee</button>
				{employeeSuccess && <span style={{ marginLeft: 12, color: '#067647', fontWeight: 600 }}>{employeeSuccess}</span>}
				{resetSuccess && <span style={{ marginLeft: 12, color: '#067647', fontWeight: 600 }}>{resetSuccess}</span>}
			</div>
			<div className="desktop-table-wrap">
				<table className="fixed-header-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
					<thead>
						<tr style={{ position: 'sticky', top: 0, background: '#fafbfc', zIndex: 10 }}>
							{columns.map(col => (
								<th
									key={col.key}
									style={{
										borderBottom: '1px solid #ccc',
										padding: '4px 6px',
										textAlign: 'left',
										...(col.key === 'actions' ? {
											position: 'sticky',
											left: 0,
											zIndex: 11,
											background: '#fafbfc',
											minWidth: 150,
										} : {}),
									}}
								>
									{col.label}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{loading ? (
							<tr><td colSpan={columns.length}>Loading...</td></tr>
						) : filteredEmployees.length === 0 ? (
							<tr><td colSpan={columns.length}>No employees found.</td></tr>
						) : (
							filteredEmployees.map((emp, idx) => (
								<tr key={idx}>
									{columns.map(col => {
										if (col.key === 'actions') {
											return (
												<td
													key={col.key}
													style={{
														padding: '4px 6px',
														borderBottom: '1px solid #eee',
														position: 'sticky',
														left: 0,
														zIndex: 2,
														background: '#fafbfc',
														minWidth: 150,
														whiteSpace: 'nowrap',
													}}
												>
													<button
														type="button"
														onClick={() => openEditEmployeeModal(emp)}
														disabled={!emp.employee_id}
														style={{
															padding: '5px 10px',
															fontSize: '12px',
															background: '#1976d2',
															color: '#fff',
															border: '1px solid #1976d2',
															borderRadius: 4,
															cursor: emp.employee_id ? 'pointer' : 'not-allowed',
															marginRight: 8,
														}}
													>
														Edit
													</button>
													<button
														type="button"
														onClick={() => openResetModal(emp)}
														disabled={!emp.employee_id}
														style={{
															padding: '5px 10px',
															fontSize: '12px',
															background: '#fff',
															color: '#1976d2',
															border: '1px solid #1976d2',
															borderRadius: 4,
															cursor: emp.employee_id ? 'pointer' : 'not-allowed',
														}}
													>
														Reset Password
													</button>
												</td>
											);
										}

										let value = emp[col.key];
										if (typeof value === 'boolean') {
											value = value ? 'Yes' : 'No';
										}
										if ((col.key.toLowerCase().includes('date') || col.key.endsWith('_at')) && value) {
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
				</table>
			</div>
			<div className="mobile-card-list">
				{loading ? (
					<div className="mobile-record-card">Loading...</div>
				) : filteredEmployees.length === 0 ? (
					<div className="mobile-record-card">No employees found.</div>
				) : filteredEmployees.map((emp, idx) => (
					<div className="mobile-record-card" key={emp.employee_id || idx}>
						<div className="mobile-card-title">
							<div>
								{emp.employee_name || 'Employee'}
								<div className="mobile-card-subtitle">{emp.employee_id || emp.login_email || ''}</div>
							</div>
							{emp.role && <span className="mobile-badge">{emp.role}</span>}
						</div>
						<div className="mobile-card-grid">
							<div className="mobile-card-field">
								<span className="mobile-card-label">Mobile</span>
								<span className="mobile-card-value">{emp.mobile_phone || ''}</span>
							</div>
							<div className="mobile-card-field">
								<span className="mobile-card-label">Status</span>
								<span className="mobile-card-value">{emp.employment_status || ''}</span>
							</div>
							<div className="mobile-card-field full">
								<span className="mobile-card-label">Email</span>
								<span className="mobile-card-value">{emp.email || emp.login_email || ''}</span>
							</div>
							<div className="mobile-card-field">
								<span className="mobile-card-label">Login Active</span>
								<span className="mobile-card-value">{typeof emp.login_active === 'boolean' ? (emp.login_active ? 'Yes' : 'No') : ''}</span>
							</div>
						</div>
						<div className="mobile-card-actions">
							<button
								type="button"
								onClick={() => openEditEmployeeModal(emp)}
								disabled={!emp.employee_id}
								style={{ padding: '7px 12px', fontSize: '12px', background: '#1976d2', color: '#fff', border: '1px solid #1976d2', borderRadius: 4, marginRight: 8 }}
							>
								Edit
							</button>
							<button
								type="button"
								onClick={() => openResetModal(emp)}
								disabled={!emp.employee_id}
								style={{ padding: '7px 12px', fontSize: '12px', background: '#fff', color: '#1976d2', border: '1px solid #1976d2', borderRadius: 4 }}
							>
								Reset Password
							</button>
						</div>
					</div>
				))}
			</div>
			{showEmployeeModal && (
				<div
					style={{
						position: 'fixed',
						inset: 0,
						background: 'rgba(15, 23, 42, 0.35)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 1000,
						padding: 16,
					}}
				>
					<form
						className="mobile-modal-panel"
						onSubmit={handleSaveEmployee}
						style={{
							width: 'min(100%, 680px)',
							maxHeight: '84vh',
							overflowY: 'auto',
							background: '#fff',
							borderRadius: 8,
							padding: 18,
							boxShadow: '0 20px 48px rgba(15, 23, 42, 0.18)',
						}}
					>
						<h3 style={{ margin: '0 0 12px', color: '#1f2937' }}>
							{editingEmployee ? `Edit Employee ${editingEmployee.employee_id}` : 'New Employee'}
						</h3>
						<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
							<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
								Name
								<input name="employee_name" value={employeeForm.employee_name} onChange={handleEmployeeFieldChange} required style={{ height: 34, padding: '0 9px', border: '1px solid #cfd8e3', borderRadius: 4, boxSizing: 'border-box' }} />
							</label>
							<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
								Email
								<input name="email" type="email" value={employeeForm.email} onChange={handleEmployeeFieldChange} required style={{ height: 34, padding: '0 9px', border: '1px solid #cfd8e3', borderRadius: 4, boxSizing: 'border-box' }} />
							</label>
							<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
								Mobile Phone
								<input name="mobile_phone" value={employeeForm.mobile_phone} onChange={handleEmployeeFieldChange} style={{ height: 34, padding: '0 9px', border: '1px solid #cfd8e3', borderRadius: 4, boxSizing: 'border-box' }} />
							</label>
							<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
								Designation
								<input name="designation" value={employeeForm.designation} onChange={handleEmployeeFieldChange} style={{ height: 34, padding: '0 9px', border: '1px solid #cfd8e3', borderRadius: 4, boxSizing: 'border-box' }} />
							</label>
							<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
								Role
								<select name="role" value={employeeForm.role} onChange={handleEmployeeFieldChange} required style={{ height: 34, padding: '0 9px', border: '1px solid #cfd8e3', borderRadius: 4, boxSizing: 'border-box' }}>
									{roleOptions.map(role => <option key={role} value={role}>{role}</option>)}
								</select>
							</label>
							<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
								Status
								<select name="employment_status" value={employeeForm.employment_status} onChange={handleEmployeeFieldChange} style={{ height: 34, padding: '0 9px', border: '1px solid #cfd8e3', borderRadius: 4, boxSizing: 'border-box' }}>
									{statusOptions.map(status => <option key={status} value={status}>{status}</option>)}
								</select>
							</label>
							<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
								Login Email
								<input name="login_email" type="email" value={employeeForm.login_email} onChange={handleEmployeeFieldChange} required style={{ height: 34, padding: '0 9px', border: '1px solid #cfd8e3', borderRadius: 4, boxSizing: 'border-box' }} />
							</label>
							{!editingEmployee && (
								<label style={{ display: 'grid', gap: 6, fontWeight: 600 }}>
									Temporary Password
									<input name="temporary_password" type="password" value={employeeForm.temporary_password} onChange={handleEmployeeFieldChange} placeholder="Default if blank" style={{ height: 34, padding: '0 9px', border: '1px solid #cfd8e3', borderRadius: 4, boxSizing: 'border-box' }} />
								</label>
							)}
						</div>
						<div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 14, fontSize: '13px' }}>
							<label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
								<input name="can_collect" type="checkbox" checked={employeeForm.can_collect} onChange={handleEmployeeFieldChange} />
								Can Collect
							</label>
							<label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
								<input name="can_create_loans" type="checkbox" checked={employeeForm.can_create_loans} onChange={handleEmployeeFieldChange} />
								Can Create Loans
							</label>
							<label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
								<input name="can_manage_customers" type="checkbox" checked={employeeForm.can_manage_customers} onChange={handleEmployeeFieldChange} />
								Can Manage Customers
							</label>
							<label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
								<input name="login_active" type="checkbox" checked={employeeForm.login_active} onChange={handleEmployeeFieldChange} />
								Login Active
							</label>
							<label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
								<input name="password_reset_required" type="checkbox" checked={employeeForm.password_reset_required} onChange={handleEmployeeFieldChange} />
								Password Reset Required
							</label>
						</div>
						{employeeError && <p style={{ margin: '14px 0 0', color: '#b42318' }}>{employeeError}</p>}
						<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16, paddingTop: 12, borderTop: '1px solid #eef2f6', position: 'sticky', bottom: -18, background: '#fff' }}>
							<button
								type="button"
								onClick={closeEmployeeModal}
								disabled={employeeSubmitting}
								style={{ padding: '8px 14px', border: '1px solid #cfd8e3', background: '#fff', borderRadius: 4, cursor: 'pointer' }}
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={employeeSubmitting}
								style={{ padding: '8px 14px', border: 'none', background: '#1976d2', color: '#fff', borderRadius: 4, cursor: 'pointer' }}
							>
								{employeeSubmitting ? 'Saving...' : 'Save Employee'}
							</button>
						</div>
					</form>
				</div>
			)}
			{resetEmployee && (
				<div
					style={{
						position: 'fixed',
						inset: 0,
						background: 'rgba(15, 23, 42, 0.35)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 1000,
					}}
				>
					<form
						className="mobile-modal-panel"
						onSubmit={handleResetPassword}
						style={{
							width: 'min(100%, 420px)',
							background: '#fff',
							borderRadius: 8,
							padding: 24,
							boxShadow: '0 20px 48px rgba(15, 23, 42, 0.18)',
						}}
					>
						<h3 style={{ margin: '0 0 6px', color: '#1f2937' }}>Reset Password</h3>
						<p style={{ margin: '0 0 18px', color: '#475467', fontSize: '14px' }}>
							{resetEmployee.employee_name || resetEmployee.employee_id}
						</p>
						<label htmlFor="employee-new-password" style={{ display: 'block', marginBottom: 6, fontWeight: 600 }}>
							New password
						</label>
						<input
							id="employee-new-password"
							type="password"
							value={newPassword}
							onChange={e => {
								setNewPassword(e.target.value);
								if (resetError) setResetError('');
							}}
							autoFocus
							style={{
								width: '100%',
								height: 38,
								padding: '0 10px',
								border: '1px solid #cfd8e3',
								borderRadius: 4,
								boxSizing: 'border-box',
								font: 'inherit',
							}}
						/>
						{resetError && <p style={{ margin: '10px 0 0', color: '#b42318' }}>{resetError}</p>}
						<div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
							<button
								type="button"
								onClick={closeResetModal}
								disabled={resetSubmitting}
								style={{ padding: '8px 14px', border: '1px solid #cfd8e3', background: '#fff', borderRadius: 4, cursor: 'pointer' }}
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={resetSubmitting}
								style={{ padding: '8px 14px', border: 'none', background: '#1976d2', color: '#fff', borderRadius: 4, cursor: 'pointer' }}
							>
								{resetSubmitting ? 'Resetting...' : 'Reset Password'}
							</button>
						</div>
					</form>
				</div>
			)}
		</div>
	);
};

export default Employees;
