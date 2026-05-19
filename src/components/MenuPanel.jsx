import React, { useState } from 'react';
import './HomePage.css';

const mainItems = ['Dashboard', 'Collections', 'Loans', 'Customers', 'Employees', 'Reports'];
const reportItems = ['Loan Report'];

const MenuPanel = ({ selected, setSelected, onLogout }) => {
  const [reportsOpen, setReportsOpen] = useState(false);

  const handleMainClick = (item) => {
    if (item === 'Reports') {
      setReportsOpen(current => !current);
      setSelected('Reports');
      return;
    }

    setReportsOpen(false);
    setSelected(item);
  };

  const handleReportClick = (item) => {
    setSelected(item);
    setReportsOpen(false);
  };

  return (
    <div className="menu-panel">
      <ul className="menu-list">
        {mainItems.map(item => {
          if (item === 'Reports') {
            return (
              <li
                key={item}
                className={[
                  selected === item || reportsOpen || selected === 'Loan Report' ? 'selected' : '',
                  'flyout-parent',
                ].filter(Boolean).join(' ')}
              >
                <div className="menu-row" onClick={() => handleMainClick(item)}>
                  <span>{item}</span>
                  <span className="flyout-arrow">›</span>
                </div>
                {reportsOpen && (
                  <ul className="flyout-menu">
                    {reportItems.map(reportItem => (
                      <li
                        key={reportItem}
                        onClick={() => handleReportClick(reportItem)}
                        className={selected === reportItem ? 'selected' : ''}
                      >
                        {reportItem}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          }

          return (
            <li
              key={item}
              onClick={() => handleMainClick(item)}
              className={selected === item ? 'selected' : ''}
            >
              {item}
            </li>
          );
        })}
      </ul>
      <button className="logout-button" type="button" onClick={onLogout}>
        Logout
      </button>
    </div>
  );
};

export default MenuPanel;
