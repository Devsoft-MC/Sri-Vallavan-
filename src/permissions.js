import { getStoredAuth } from './auth';

const roleAccess = {
  Dashboard: ['Admin', 'Manager', 'Viewer'],
  Collections: ['Admin', 'Manager', 'Collection Agent'],
  Loans: ['Admin', 'Manager', 'Loan Officer'],
  'Loan Income': ['Admin', 'Manager', 'Loan Officer', 'Collection Agent'],
  Expenses: ['Admin', 'Manager'],
  Customers: ['Admin', 'Manager', 'Loan Officer'],
  Employees: ['Admin'],
  Transactions: ['Admin', 'Manager', 'Loan Officer', 'Collection Agent'],
  Settings: ['Admin'],
  Reports: ['Admin', 'Manager', 'Viewer', 'Loan Officer', 'Collection Agent'],
  'Loan Report': ['Admin', 'Manager', 'Viewer', 'Loan Officer'],
  'Interest Received': ['Admin', 'Manager', 'Viewer', 'Loan Officer'],
  'Customer Analysis': ['Admin', 'Manager', 'Viewer'],
  'Collection Details': ['Admin', 'Manager', 'Viewer', 'Loan Officer', 'Collection Agent'],
  'Customer Status': ['Admin', 'Manager', 'Viewer'],
};

export function getCurrentEmployee() {
  const auth = getStoredAuth();
  return auth?.employee || auth?.user || null;
}

export function canAccessSection(section, employee = getCurrentEmployee()) {
  if (!section) return false;
  if (!employee) return false;
  if (employee.role === 'Admin') return true;

  const allowedRoles = roleAccess[section];
  if (!allowedRoles) return false;
  if (allowedRoles.includes(employee.role)) return true;

  if (section === 'Collections' && employee.can_collect) return true;
  if (section === 'Loans' && employee.can_create_loans) return true;
  if (section === 'Loan Income' && (employee.can_collect || employee.can_create_loans)) return true;
  if (section === 'Customers' && employee.can_manage_customers) return true;

  return false;
}

export function getDefaultSection(employee = getCurrentEmployee()) {
  const sections = ['Dashboard', 'Collections', 'Loans', 'Customers', 'Employees', 'Reports'];
  return sections.find(section => canAccessSection(section, employee)) || 'Dashboard';
}
