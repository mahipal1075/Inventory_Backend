// backend/routes/salesDailyRoutes.js

const express = require('express');
const router = express.Router();
const salesDailyController = require('../controllers/salesDailyController');

// IMPORTANT: product route must be before :id route
router.get('/product/:productId', salesDailyController.getSalesDailyByProductId);
router.get('/:id', salesDailyController.getSalesDailyById);
router.get('/', salesDailyController.getAllSalesDaily);

module.exports = router;
