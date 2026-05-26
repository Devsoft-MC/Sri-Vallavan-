import React from 'react';

import LoanPieChart from './LoanPieChart';
import CustomerCategoryPieChart from './CustomerCategoryPieChart';
import LoanIssuedLineChart from './LoanIssuedLineChart';


const Dashboard = () => (
  <div className="dashboard-layout">
    <div className="dashboard-chart-grid">
      <div className="mobile-hidden-dashboard-chart">
        <LoanPieChart />
      </div>
      <CustomerCategoryPieChart />
    </div>
    <LoanIssuedLineChart />
  </div>
);

export default Dashboard;
