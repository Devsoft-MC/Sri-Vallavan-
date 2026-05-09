import React, { useEffect, useState } from 'react';
import MenuPanel from './components/MenuPanel';
import Dashboard from './components/Dashboard/Dashboard';
import Collections from './components/Collections/Collections';
import Loans from './components/Loans/Loans';
import Customers from './components/Customers/Customers';
import Employees from './components/Employees/Employees';
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
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <MenuPanel selected={selected} setSelected={setSelected} onLogout={handleLogout} />
      <div style={{ flex: 1, background: '#fafbfc', marginLeft: 220 }}>
        {selected === 'Dashboard' && <Dashboard />}
        {selected === 'Collections' && <Collections />}
        {selected === 'Loans' && <Loans />}
        {selected === 'Customers' && <Customers />}
        {selected === 'Employees' && <Employees />}
      </div>
    </div>
  );
};

export default App;
