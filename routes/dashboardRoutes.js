// backend/routes/dashboardRoutes.js

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');

// GET dashboard summary (read‑only)
router.get('/', dashboardController.getDashboardSummary);

module.exports = router;
