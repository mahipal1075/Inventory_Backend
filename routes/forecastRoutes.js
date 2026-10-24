// backend/routes/forecastRoutes.js – minimal router for forecast endpoint
const express = require('express');
const router = express.Router();
const forecastController = require('../controllers/forecastController');

// GET /api/forecast/:productId – returns AI forecast for a product
router.get('/:productId', forecastController.getForecast);

module.exports = router;
