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
import AddCustomerForm from './AddCustomerForm';
import API_BASE_URL from '../../api';

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

const Customers = () => {
	const [customers, setCustomers] = useState([]);
	const [filter, setFilter] = useState('');
	const [loading, setLoading] = useState(true);
	const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
	const [showAdd, setShowAdd] = useState(false);

	useEffect(() => {
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
			<div className="sticky-toolbar" style={{ display: 'flex', alignItems: 'center', marginBottom: 12, position: 'sticky', top: 0, background: '#fff', zIndex: 20, padding: '12px 0 12px 0', boxShadow: '0 2px 8px -6px #aaa' }}>
				<span style={{ fontSize: 15, color: '#555', marginRight: 24 }}>{filteredCustomers.length} records</span>
				<input
					type="text"
					placeholder="Search customers..."
					value={filter}
					onChange={e => setFilter(e.target.value)}
					style={{ padding: 6, width: 240, marginRight: 8, fontSize: '13px' }}
				/>
				<button onClick={() => window.location.reload()} style={{ padding: '6px 18px', fontSize: '13px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, marginRight: 8 }}>Refresh</button>
				<button onClick={() => setShowAdd(true)} style={{ padding: '6px 18px', fontSize: '13px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4 }}>Add New Customer</button>
					{showAdd && (
						<AddCustomerForm
							onSuccess={() => { setShowAdd(false); window.location.reload(); }}
							onCancel={() => setShowAdd(false)}
						/>
					)}
			</div>
			<div style={{ maxHeight: 'none', overflowY: 'visible', width: '100%' }}>
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
								<tr key={idx} style={{ transition: 'background 0.2s' }}>
									{/* Sl.No */}
									<td style={{ padding: '4px 6px', borderBottom: '1px solid #eee', color: '#555' }}>{idx + 1}</td>
									{/* Customer ID as link */}
									<td style={{ padding: '4px 6px', borderBottom: '1px solid #eee' }}>
										<a href="#" style={{ color: '#1976d2', fontWeight: 600, textDecoration: 'none' }}>{cust.customer_id}</a>
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
