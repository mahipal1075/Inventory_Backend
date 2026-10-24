const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

const path = require('path');
// Load environment variables from the backend's .env file explicitly
dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
app.use(cors());
app.use(express.json());

const connectDB = require('./config/db');
const inventoryRoutes = require('./routes/inventoryRoutes');
const forecastRoutes = require('./routes/forecastRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const salesRoutes = require('./routes/salesRoutes');
const salesDailyRoutes = require('./routes/salesDailyRoutes');

// Connect to MongoDB
connectDB();

// Register inventory API routes
app.use('/api/inventory', inventoryRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/sales-daily', salesDailyRoutes);
const PORT = process.env.PORT || 5000;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'inventory-backend' });
});

app.get('/', (req, res) => {
  res.json({ service: 'inventory-backend', status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
