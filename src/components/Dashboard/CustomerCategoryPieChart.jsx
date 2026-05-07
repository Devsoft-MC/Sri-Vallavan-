import React, { useEffect, useState } from 'react';
import { Pie } from 'react-chartjs-2';
import '../Dashboard/chartjs-setup';
import API_BASE_URL from '../../api';

const pieOptions = {
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

const CustomerCategoryPieChart = () => {
  const [chartData, setChartData] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/customers-by-category`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(data => {
        const colorMap = {
          'Regular': '#1976d2',
          'Premium': '#43a047',
          'VIP': '#d32f2f',
          'Good': '#90ee90',
          'Bad': '#ff0000',
        };
        const defaultColors = ['#e67e22', '#fbc02d', '#7b1fa2'];
        if (!data || !Array.isArray(data.categories) || !Array.isArray(data.counts)) {
          setChartData(null);
          return;
        }
        const backgroundColor = data.categories.map((cat, idx) => colorMap[cat] || defaultColors[idx % defaultColors.length]);
        setChartData({
          labels: data.categories,
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
    <div style={{ width: 400, height: 400, margin: '40px auto' }}>
      <h2>Customer Categories</h2>
      <Pie data={chartData} options={pieOptions} plugins={['datalabels']} />
    </div>
  );
};

export default CustomerCategoryPieChart;
