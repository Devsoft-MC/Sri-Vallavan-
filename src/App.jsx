import React, { useState } from 'react';
import MenuPanel from './components/MenuPanel';
import Dashboard from './components/Dashboard/Dashboard';
import Collections from './components/Collections/Collections';
import Loans from './components/Loans/Loans';
import Customers from './components/Customers/Customers';
import Employees from './components/Employees/Employees';
import './components/HomePage.css';

const App = () => {
  const [selected, setSelected] = useState('Dashboard');
  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <MenuPanel selected={selected} setSelected={setSelected} />
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
