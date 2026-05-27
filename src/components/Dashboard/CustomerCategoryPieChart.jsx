import React, { useEffect, useState } from 'react';
import { Pie } from 'react-chartjs-2';
import '../Dashboard/chartjs-setup';
import API_BASE_URL from '../../api';

const today = new Date().toISOString().slice(0, 10);

const pieOptions = {
  maintainAspectRatio: false,
  plugins: {
    datalabels: {
      color: '#222',
      font: { weight: 'bold', size: 16 },
      rotation: 270,
      formatter: (value, context) => {
        const data = context.chart.data.datasets[0].data;
        const total = data.reduce((a, b) => a + b, 0);
        const percent = total ? ((value / total) * 100).toFixed(1) : 0;
        return percent + '%';
      },
    },
    legend: {
      display: false,
    },
  },
};

function normalizeDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function parseDate(value) {
  const date = normalizeDate(value);
  if (!date) return null;
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function daysBetween(start, end) {
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  if (!startDate || !endDate) return null;
  return Math.round((endDate - startDate) / 86400000);
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function payableDaysUntilYesterday(issueDate, todayDate = today) {
  const startDate = parseDate(issueDate);
  const currentDate = parseDate(todayDate);
  if (!startDate || !currentDate) return 0;

  const yesterday = addDays(currentDate, -1);
  if (yesterday < startDate) return 0;

  let payableDays = 0;
  for (let date = startDate; date <= yesterday; date = addDays(date, 1)) {
    if (date.getUTCDay() !== 0) payableDays += 1;
  }

  return payableDays;
}

function toAmount(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

function isClosedLoan(loan) {
  return String(loan.status || '').toLowerCase() === 'closed'
    || loan.loan_status_closed === true
    || loan.loan_status_closed === 'true';
}

function getLoanResult({ closed, issueDate, issueAmount, collectedAmount, maturityDate, closingDate }) {
  if (closed) {
    const varianceDays = daysBetween(maturityDate, closingDate);
    if (varianceDays === null) return 'Closed';
    return varianceDays <= 0 ? 'Closed On/Before Maturity' : 'Closed After Maturity';
  }

  const dailyCollectionAmount = issueAmount / 100;
  const expectedCollectionAmount = Math.min(issueAmount, payableDaysUntilYesterday(issueDate) * dailyCollectionAmount);
  if (expectedCollectionAmount > 0 && collectedAmount < expectedCollectionAmount) return 'Active Overdue';

  return 'Active';
}

function needsReviewForActiveBalance(issueDate, balanceAmount) {
  const daysFromIssue = daysBetween(issueDate, today);
  return daysFromIssue !== null && daysFromIssue > 120 && balanceAmount > 0;
}

function getAnalysisStatus(row) {
  if (row.total_loans === 0) return 'New Customer';
  if (row.active_needs_review_loans > 0) return 'Needs Review';
  if (row.overdue_active_loans > 0) return 'Monitor';
  if (row.closed_loans === 0) return 'Good';
  if (row.on_time_closures === row.closed_loans) return 'Good';
  if (row.late_closures === row.closed_loans) return 'Needs Review';
  return 'Monitor';
}

function buildCustomerStatusCounts(customers, loans, collections) {
  const collectedByLoan = collections.reduce((map, collection) => {
    const loanId = String(collection.loan_id || '').trim();
    if (!loanId) return map;
    map.set(loanId, (map.get(loanId) || 0) + toAmount(collection.collection_amount));
    return map;
  }, new Map());

  const grouped = new Map();

  customers.forEach(customer => {
    grouped.set(customer.customer_id, {
      customer_id: customer.customer_id,
      total_loans: 0,
      closed_loans: 0,
      on_time_closures: 0,
      late_closures: 0,
      overdue_active_loans: 0,
      active_needs_review_loans: 0,
    });
  });

  loans.forEach(loan => {
    if (!grouped.has(loan.customer_id)) {
      grouped.set(loan.customer_id, {
        customer_id: loan.customer_id,
        total_loans: 0,
        closed_loans: 0,
        on_time_closures: 0,
        late_closures: 0,
        overdue_active_loans: 0,
        active_needs_review_loans: 0,
      });
    }

    const row = grouped.get(loan.customer_id);
    const issuedAmount = toAmount(loan.issue_amount);
    const collectedAmount = collectedByLoan.get(String(loan.loan_id || '').trim()) || 0;
    const balanceAmount = issuedAmount - collectedAmount;
    const closed = isClosedLoan(loan);
    const issueDate = normalizeDate(loan.issue_date);
    const maturityDate = normalizeDate(loan.maturity_date);
    const closingDate = normalizeDate(loan.closing_date || loan.close_date);
    const loanResult = getLoanResult({
      closed,
      issueDate,
      issueAmount: issuedAmount,
      collectedAmount,
      maturityDate,
      closingDate,
    });

    row.total_loans += 1;

    if (closed) {
      row.closed_loans += 1;
      const varianceDays = daysBetween(maturityDate, closingDate);
      if (varianceDays !== null && varianceDays <= 0) row.on_time_closures += 1;
      if (varianceDays !== null && varianceDays > 0) row.late_closures += 1;
    } else {
      if (loanResult === 'Active Overdue') row.overdue_active_loans += 1;
      if (needsReviewForActiveBalance(issueDate, balanceAmount)) row.active_needs_review_loans += 1;
    }
  });

  return Array.from(grouped.values()).reduce((counts, row) => {
    const status = getAnalysisStatus(row);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

const CustomerCategoryPieChart = () => {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/api/customers`),
      fetch(`${API_BASE_URL}/api/loans`),
      fetch(`${API_BASE_URL}/api/collections?text=%25`),
    ])
      .then(responses => Promise.all(responses.map(res => (
        res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))
      ))))
      .then(([customers, loans, collections]) => {
        if (!Array.isArray(customers) || !Array.isArray(loans) || !Array.isArray(collections)) {
          setChartData(null);
          return;
        }

        const countsByStatus = buildCustomerStatusCounts(customers, loans, collections);
        const statusOrder = ['Good', 'Monitor', 'Needs Review', 'New Customer'];
        const labels = statusOrder.filter(status => countsByStatus[status] > 0);
        const counts = labels.map(status => countsByStatus[status]);
        const colorMap = {
          Good: '#43a047',
          Monitor: '#f9a825',
          'Needs Review': '#d32f2f',
          'New Customer': '#90a4ae',
        };

        if (labels.length === 0) {
          setChartData(null);
          return;
        }

        setChartData({
          labels,
          datasets: [
            {
              data: counts,
              backgroundColor: labels.map(status => colorMap[status]),
            },
          ],
        });
      })
      .catch(() => setChartData(null));
  }, []);

  if (!chartData) return null;

  return (
    <div className="dashboard-chart-card">
      <h2>Customer Status</h2>
      <div className="dashboard-pie-chart">
        <Pie data={chartData} options={pieOptions} plugins={['datalabels']} />
      </div>
      <div className="dashboard-chart-legend" aria-label="Customer status chart legend">
        {chartData.labels.map((label, index) => (
          <span className="dashboard-chart-legend-item" key={label}>
            <span
              className="dashboard-chart-legend-swatch"
              style={{ backgroundColor: chartData.datasets[0].backgroundColor[index] }}
            />
            {label} ({chartData.datasets[0].data[index]})
          </span>
        ))}
      </div>
    </div>
  );
};

export default CustomerCategoryPieChart;
