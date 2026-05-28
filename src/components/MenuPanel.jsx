import React, { useState } from 'react';
import './HomePage.css';
import { canAccessSection, getCurrentEmployee } from '../permissions';

const mainItems = ['Dashboard', 'Collections', 'Loans', 'Customers', 'Employees', 'Reports'];
const reportItems = ['Loan Report', 'Customer Analysis', 'Collection Details', 'Customer Status'];

const MenuPanel = ({ selected, setSelected, onLogout }) => {
  const [reportsOpen, setReportsOpen] = useState(false);
  const employee = getCurrentEmployee();
  const visibleMainItems = mainItems.filter(item => canAccessSection(item, employee));
  const visibleReportItems = reportItems.filter(item => canAccessSection(item, employee));

  const handleMainClick = (item) => {
    if (item === 'Reports') {
      setReportsOpen(current => !current);
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
      <div className="menu-brand" aria-label="Sri Vallavan">
        <span className="menu-brand-mark">SV</span>
        <span className="menu-brand-name">Sri Vallavan</span>
      </div>
      <ul className="menu-list">
        {visibleMainItems.map(item => {
          if (item === 'Reports') {
            return (
              <li
                key={item}
                className={[
                  selected === item || reportsOpen || visibleReportItems.includes(selected) ? 'selected' : '',
                  'flyout-parent',
                ].filter(Boolean).join(' ')}
              >
                <div className="menu-row" onClick={() => handleMainClick(item)}>
                  <span>{item}</span>
                  <span className="flyout-arrow">›</span>
                </div>
                {reportsOpen && (
                  <ul className="flyout-menu">
                    {visibleReportItems.map(reportItem => (
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
              className={[
                selected === item ? 'selected' : '',
                ['Customers', 'Employees'].includes(item) ? 'mobile-hidden-menu-item' : '',
              ].filter(Boolean).join(' ')}
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
