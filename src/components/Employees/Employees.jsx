import React, { useEffect, useState } from 'react';
import API_BASE_URL from '../../api';

const columns = [
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
	{ label: 'Can Collect', key: 'can_collect' },
	{ label: 'Can Create Loans', key: 'can_create_loans' },
	{ label: 'Can Manage Customers', key: 'can_manage_customers' },
	{ label: 'Password Reset Required', key: 'password_reset_required' },
	{ label: 'Created At', key: 'created_at' },
	{ label: 'Updated At', key: 'updated_at' },
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

	useEffect(() => {
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
	}, []);

	const filteredEmployees = employees.filter(emp =>
		Object.values(emp).some(val =>
			String(val).toLowerCase().includes(filter.toLowerCase())
		)
	);

	return (
		<div style={{ padding: 24 }}>
			<h2 style={{ color: 'navy', marginBottom: 20 }}>Employees</h2>
			<div style={{ marginBottom: 16, fontSize: '13px' }}>
				<input
					type="text"
					placeholder="Search employee..."
					value={filter}
					onChange={e => setFilter(e.target.value)}
					style={{ padding: 6, width: 240, marginRight: 8, fontSize: '13px' }}
				/>
				<button onClick={() => window.location.reload()} style={{ padding: '6px 18px', fontSize: '13px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4 }}>Refresh</button>
			</div>
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
						{loading ? (
							<tr><td colSpan={columns.length}>Loading...</td></tr>
						) : filteredEmployees.length === 0 ? (
							<tr><td colSpan={columns.length}>No employees found.</td></tr>
						) : (
							filteredEmployees.map((emp, idx) => (
								<tr key={idx}>
									{columns.map(col => {
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
		</div>
	);
};

export default Employees;
