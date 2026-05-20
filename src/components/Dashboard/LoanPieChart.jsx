
import React, { useEffect, useState } from 'react';

import { Pie } from 'react-chartjs-2';
import './chartjs-setup';
import API_BASE_URL from '../../api';

const pieOptions = {
  plugins: {
    datalabels: {
      color: '#222',
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
      position: 'bottom',
      labels: {
        generateLabels: (chart) => {
          const data = chart.data;
          if (!data.labels || !data.datasets.length) return [];
          return data.labels.map((label, i) => {
            const value = data.datasets[0].data[i];
            const backgroundColor = data.datasets[0].backgroundColor[i];
            return {
              text: `${label} (${value})`,
              fillStyle: backgroundColor,
              strokeStyle: backgroundColor,
              index: i,
            };
          });
        },
      },
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
          'Personal Loan': '#d32f2f',
          'Gold Loan': '#1976d2',
          'Vehicle Loan': '#43a047',
        };
        const defaultColors = ['#e67e22', '#fbc02d', '#7b1fa2'];
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
      <Pie data={chartData} options={pieOptions} plugins={['datalabels']} />
    </div>
  );
};

export default LoanPieChart;
