import React, { useEffect, useState } from 'react';
import { Pie } from 'react-chartjs-2';
import API_BASE_URL from '../api';

const Dashboard = () => {
  const [chartData, setChartData] = useState(null);

  const backendUrl = API_BASE_URL;

  useEffect(() => {
    fetch(`${backendUrl}/api/loans-by-type`)
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then(data => {
        if (!data || !Array.isArray(data.types) || !Array.isArray(data.counts)) {
          setChartData(null);
          return;
        }
        setChartData({
          labels: data.types,
          datasets: [
            {
              data: data.counts,
              backgroundColor: [
                '#1976d2', '#e67e22', '#43a047', '#d32f2f', '#fbc02d', '#7b1fa2'
              ],
            },
          ],
        });
      })
      .catch(() => setChartData(null));
  }, []);

  if (!chartData) return <div>Loading...</div>;

  return (
    <div style={{ width: 400, height: 400, margin: '40px auto' }}>
      <h2>Loans Issued by Type</h2>
      <Pie data={chartData} />
    </div>
  );
};

export default Dashboard;
