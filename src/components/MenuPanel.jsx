import React from 'react';
import './HomePage.css';

const MenuPanel = ({ selected, setSelected, onLogout }) => (
  <div className="menu-panel">
    <ul className="menu-list">
      {['Dashboard', 'Collections', 'Loans', 'Customers', 'Employees'].map(item => (
        <li
          key={item}
          onClick={() => setSelected(item)}
          className={selected === item ? 'selected' : ''}
        >
          {item}
        </li>
      ))}
    </ul>
    <button className="logout-button" type="button" onClick={onLogout}>
      Logout
    </button>
  </div>
);

export default MenuPanel;
