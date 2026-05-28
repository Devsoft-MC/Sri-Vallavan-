import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import '../Dashboard/chartjs-setup';
import API_BASE_URL from '../../api';

const lineOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'bottom',
      labels: {
        color: '#2c638f',
        boxWidth: 14,
      },
    },
    title: {
      display: true,
      text: 'Total Loans Issued Amount (Last 6 Months)',
      color: '#102033',
      font: {
        size: 15,
        weight: '700',
      },
    },
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(44, 99, 143, 0.12)',
      },
      ticks: {
        color: '#2c638f',
      },
    },
    y: {
      min: 100000,
      grid: {
        color: 'rgba(44, 99, 143, 0.12)',
      },
      ticks: {
        color: '#2c638f',
        callback: value => Number(value).toLocaleString(),
      },
    },
  },
};

const LoanIssuedLineChart = () => {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/loans-issued-last-6-months`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(data => {
        if (!data || !Array.isArray(data.months) || !Array.isArray(data.amounts)) {
          setChartData(null);
          return;
        }
        setChartData({
          labels: data.months,
          datasets: [
            {
              label: 'Total Issued Amount',
              data: data.amounts,
              borderColor: '#1978ad',
              backgroundColor: 'rgba(25, 120, 173, 0.18)',
              pointBackgroundColor: '#0397c9',
              pointBorderColor: '#f5fbff',
              pointHoverRadius: 5,
              tension: 0.3,
              fill: true,
            },
          ],
        });
      })
      .catch(() => setChartData(null));
  }, []);

  if (!chartData) return null;

  return (
    <div className="dashboard-line-chart">
      <Line data={chartData} options={lineOptions} />
    </div>
  );
};

export default LoanIssuedLineChart;
