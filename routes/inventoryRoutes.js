// backend/routes/inventoryRoutes.js

const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');

// GET all inventory
router.get('/', inventoryController.getAllInventory);

// GET inventory by ID
router.get('/:id', inventoryController.getInventoryById);

// CREATE inventory
router.post('/', inventoryController.createInventory);

// UPDATE inventory
router.put('/:id', inventoryController.updateInventory);

// DELETE inventory
router.delete('/:id', inventoryController.deleteInventory);

module.exports = router;
