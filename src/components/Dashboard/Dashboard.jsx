import React from 'react';

import LoanPieChart from './LoanPieChart';
import CustomerCategoryPieChart from './CustomerCategoryPieChart';
import LoanIssuedLineChart from './LoanIssuedLineChart';


const Dashboard = () => (
  <div>
    <div className="dashboard-chart-grid">
      <LoanPieChart />
      <CustomerCategoryPieChart />
    </div>
    <LoanIssuedLineChart />
  </div>
);

export default Dashboard;
