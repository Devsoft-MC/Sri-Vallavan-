import React, { useEffect, useState } from 'react';
import MenuPanel from './components/MenuPanel';
import Dashboard from './components/Dashboard/Dashboard';
import Collections from './components/Collections/Collections';
import Loans from './components/Loans/Loans';
import LoanIncome from './components/Accounts/LoanIncome';
import Expenses from './components/Accounts/Expenses';
import Customers from './components/Customers/Customers';
import Employees from './components/Employees/Employees';
import Settings from './components/Settings/Settings';
import ActiveLoanPositionReport from './components/Reports/ActiveLoanPositionReport';
import CustomerAnalysisReport from './components/Reports/CustomerAnalysisReport';
import CollectionDetailsReport from './components/Reports/CollectionDetailsReport';
import CustomerStatusReport from './components/Reports/CustomerStatusReport';
import InterestReceivedReport from './components/Reports/InterestReceivedReport';
import MonthlyStatusReport from './components/Reports/MonthlyStatusReport';
import Login from './components/Login';
import { clearAuth, getStoredAuth, installAuthFetch } from './auth';
import { canAccessSection, getCurrentEmployee, getDefaultSection } from './permissions';
import './components/HomePage.css';

installAuthFetch();

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(getStoredAuth()));
  const [selected, setSelected] = useState(() => getDefaultSection(getCurrentEmployee()));

  useEffect(() => {
    const handleAuthExpired = () => {
      setSelected('Dashboard');
      setIsLoggedIn(false);
    };

    window.addEventListener('sri-vallavan-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('sri-vallavan-auth-expired', handleAuthExpired);
  }, []);

  const handleLogin = () => {
    const employee = getCurrentEmployee();
    setSelected(getDefaultSection(employee));
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    clearAuth();
    setSelected('Dashboard');
    setIsLoggedIn(false);
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  const employee = getCurrentEmployee();
  const canAccessSelected = canAccessSection(selected, employee);

  return (
    <div className="app-shell">
      <MenuPanel selected={selected} setSelected={setSelected} onLogout={handleLogout} />
      <main className="app-main">
        {!canAccessSelected && (
          <div style={{ padding: 32 }}>
            <h2 style={{ color: 'navy', margin: '0 0 12px' }}>Access Restricted</h2>
            <div style={{ color: '#667085' }}>You do not have permission to open this section.</div>
          </div>
        )}
        {canAccessSelected && selected === 'Dashboard' && <Dashboard />}
        {canAccessSelected && selected === 'Collections' && <Collections />}
        {canAccessSelected && selected === 'Loans' && <Loans />}
        {canAccessSelected && selected === 'Receipts' && <LoanIncome />}
        {canAccessSelected && selected === 'Payments' && <Expenses />}
        {canAccessSelected && selected === 'Customers' && <Customers />}
        {canAccessSelected && selected === 'Employees' && <Employees />}
        {canAccessSelected && selected === 'Settings' && <Settings />}
        {canAccessSelected && selected === 'Reports' && (
          <div style={{ padding: 32 }}>
            <h2 style={{ color: 'navy', margin: '0 0 12px' }}>Reports</h2>
            <div style={{ color: '#667085' }}>Select a report from the left panel.</div>
          </div>
        )}
        {canAccessSelected && selected === 'Loan Report' && <ActiveLoanPositionReport />}
        {canAccessSelected && selected === 'Monthly Status' && <MonthlyStatusReport />}
        {canAccessSelected && selected === 'Interest Received' && <InterestReceivedReport />}
        {canAccessSelected && selected === 'Customer Analysis' && <CustomerAnalysisReport />}
        {canAccessSelected && selected === 'Collection Details' && <CollectionDetailsReport />}
        {canAccessSelected && selected === 'Customer Status' && <CustomerStatusReport />}
      </main>
    </div>
  );
};

export default App;
