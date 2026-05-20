import React, { useEffect, useState } from 'react';
import MenuPanel from './components/MenuPanel';
import Dashboard from './components/Dashboard/Dashboard';
import Collections from './components/Collections/Collections';
import Loans from './components/Loans/Loans';
import Customers from './components/Customers/Customers';
import Employees from './components/Employees/Employees';
import ActiveLoanPositionReport from './components/Reports/ActiveLoanPositionReport';
import Login from './components/Login';
import { clearAuth, getStoredAuth, installAuthFetch } from './auth';
import './components/HomePage.css';

installAuthFetch();

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(getStoredAuth()));
  const [selected, setSelected] = useState('Dashboard');

  useEffect(() => {
    const handleAuthExpired = () => {
      setSelected('Dashboard');
      setIsLoggedIn(false);
    };

    window.addEventListener('sri-vallavan-auth-expired', handleAuthExpired);
    return () => window.removeEventListener('sri-vallavan-auth-expired', handleAuthExpired);
  }, []);

  const handleLogin = () => {
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

  return (
    <div className="app-shell">
      <MenuPanel selected={selected} setSelected={setSelected} onLogout={handleLogout} />
      <main className="app-main">
        {selected === 'Dashboard' && <Dashboard />}
        {selected === 'Collections' && <Collections />}
        {selected === 'Loans' && <Loans />}
        {selected === 'Customers' && <Customers />}
        {selected === 'Employees' && <Employees />}
        {selected === 'Reports' && (
          <div style={{ padding: 32 }}>
            <h2 style={{ color: 'navy', margin: '0 0 12px' }}>Reports</h2>
            <div style={{ color: '#667085' }}>Select a report from the left panel.</div>
          </div>
        )}
        {selected === 'Loan Report' && <ActiveLoanPositionReport />}
      </main>
    </div>
  );
};

export default App;
