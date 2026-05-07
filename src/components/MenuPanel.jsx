import React from 'react';
import './HomePage.css';

const MenuPanel = ({ selected, setSelected }) => (
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
  </div>
);

export default MenuPanel;
