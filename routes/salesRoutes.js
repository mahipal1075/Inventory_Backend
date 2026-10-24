// backend/routes/salesRoutes.js

const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');

// IMPORTANT: product route must be declared before :id route
router.get('/product/:productId', salesController.getSalesByProductId);
router.get('/:id', salesController.getSaleById);
router.get('/', salesController.getAllSales);

// New POST endpoint for creating a sale
router.post('/', salesController.createSale);

module.exports = router;
