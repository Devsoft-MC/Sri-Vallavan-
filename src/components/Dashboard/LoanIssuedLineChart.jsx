import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import '../Dashboard/chartjs-setup';
import API_BASE_URL from '../../api';

const lineOptions = {
  responsive: true,
  plugins: {
    legend: {
      position: 'bottom',
    },
    title: {
      display: true,
      text: 'Total Loans Issued Amount (Last 6 Months)',
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
              borderColor: '#1976d2',
              backgroundColor: 'rgba(25, 118, 210, 0.2)',
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
    <div style={{ width: '100%', maxWidth: '1600px', height: '400px', margin: '40px auto' }}>
      <Line data={chartData} options={lineOptions} />
    </div>
  );
};

export default LoanIssuedLineChart;
