
import React, { useEffect, useState } from 'react';

import { Pie } from 'react-chartjs-2';
import './chartjs-setup';
import API_BASE_URL from '../../api';

const pieOptions = {
  maintainAspectRatio: false,
  plugins: {
    datalabels: {
      color: '#102033',
      font: { weight: 'bold', size: 16 },
      rotation: 270, // vertical orientation
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

const LoanPieChart = () => {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/loans-by-type`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(data => {
        const colorMap = {
          'Personal Loan': '#c24132',
          'Gold Loan': '#1978ad',
          'Vehicle Loan': '#067647',
        };
        const defaultColors = ['#0397c9', '#d49a1e', '#6d79c8'];
        if (!data || !Array.isArray(data.types) || !Array.isArray(data.counts)) {
          setChartData(null);
          return;
        }
        const backgroundColor = data.types.map((type, idx) => colorMap[type] || defaultColors[idx % defaultColors.length]);
        setChartData({
          labels: data.types,
          datasets: [
            {
              data: data.counts,
              backgroundColor,
            },
          ],
        });
      })
      .catch(() => setChartData(null));
  }, []);

  if (!chartData) return null;

  return (
    <div className="dashboard-chart-card">
      <h2>Loan Categories</h2>
      <div className="dashboard-pie-chart">
        <Pie data={chartData} options={pieOptions} plugins={['datalabels']} />
      </div>
      <div className="dashboard-chart-legend" aria-label="Loan category chart legend">
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

export default LoanPieChart;
