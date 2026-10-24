// backend/controllers/dashboardController.js

const Inventory = require('../models/Inventory');
const Sale = require('../models/Sale');

/**
 * @desc   Get dashboard summary (read‑only)
 * @route  GET /api/dashboard
 * @access Public
 */
exports.getDashboardSummary = async (req, res) => {
  try {
    // 1. Total products
    const totalProductsPromise = Inventory.countDocuments();

    // 2. Total inventory quantity (sum of quantity field, treat missing as 0)
    const totalInventoryQuantityPromise = Inventory.aggregate([
      {
        $group: {
          _id: null,
          totalQty: { $sum: { $ifNull: ['$quantity', 0] } },
        },
      },
    ]);

    // 3. Total sales transactions
    const totalSalesTransactionsPromise = Sale.countDocuments();

    // 4. Total units sold (sum of units field, treat missing as 0)
    const totalUnitsSoldPromise = Sale.aggregate([
      {
        $group: {
          _id: null,
          totalUnits: { $sum: { $ifNull: ['$units', 0] } },
        },
      },
    ]);

    // 5. Low‑stock and out‑of‑stock counts
    // No explicit low‑stock flag in the schema – we infer low stock when stockLevel <= 10.
    const lowStockPromise = Inventory.countDocuments({ stockLevel: { $lte: 10 } });
    const outOfStockPromise = Inventory.countDocuments({
      $or: [{ stockLevel: { $eq: 0 } }, { status: 'Out of Stock' }, { quantity: { $eq: 0 } }],
    });

    // 6. Category‑wise summary (product count and total quantity per category)
    const categorySummaryPromise = Inventory.aggregate([
      {
        $group: {
          _id: { $ifNull: ['$category', 'Uncategorized'] },
          productCount: { $sum: 1 },
          totalQuantity: { $sum: { $ifNull: ['$quantity', 0] } },
        },
      },
      {
        $project: {
          _id: 0,
          category: '$_id',
          productCount: 1,
          totalQuantity: 1,
        },
      },
      { $sort: { category: 1 } },
    ]);

    // 7. Recent sales (most recent 5 by date field)
    const recentSalesPromise = Sale.find()
      .sort({ date: -1 })
      .limit(5)
      .select('_id productId units pricePerUnit date')
      .lean();

    // Await all parallel promises
    const [
      totalProducts,
      totalInventoryAgg,
      totalSalesTransactions,
      totalUnitsAgg,
      lowStockProducts,
      outOfStockProducts,
      categorySummary,
      recentSales,
    ] = await Promise.all([
      totalProductsPromise,
      totalInventoryQuantityPromise,
      totalSalesTransactionsPromise,
      totalUnitsSoldPromise,
      lowStockPromise,
      outOfStockPromise,
      categorySummaryPromise,
      recentSalesPromise,
    ]);

    const totalInventoryQuantity = totalInventoryAgg[0] ? totalInventoryAgg[0].totalQty : 0;
    const totalUnitsSold = totalUnitsAgg[0] ? totalUnitsAgg[0].totalUnits : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalProducts,
        totalInventoryQuantity,
        totalSalesTransactions,
        totalUnitsSold,
        lowStockProducts,
        outOfStockProducts,
        categorySummary,
        recentSales,
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load dashboard data' });
  }
};
