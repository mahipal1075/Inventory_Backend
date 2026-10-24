// backend/controllers/forecastController.js

const SalesDaily = require('../models/SalesDaily');
const { getForecastFromAI } = require('../services/forecastService');

/**
 * @desc   Get forecast for a product based on historical sales_daily data
 * @route  GET /api/forecast/:productId
 * @access Public
 */
exports.getForecast = async (req, res) => {
  const { productId } = req.params;
  if (!productId) {
    return res.status(400).json({ success: false, message: 'Missing productId parameter' });
  }

  try {
    // Retrieve historical sales_daily records
    const sales = await SalesDaily.find({ productId }).sort({ date: 1 }).lean();
    if (!sales || sales.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No sales history found for this product',
      });
    }

    // Build history payload (date as YYYY-MM-DD, units as number)
    const history = sales.map((s) => ({
      date: s.date.toISOString().split('T')[0],
      units: s.units ?? 0,
    }));

    // Call AI service
    const forecastResult = await getForecastFromAI(productId, history);
    return res.status(200).json({ success: true, productId, historyPoints: history.length, forecast: forecastResult });
  } catch (err) {
    console.error('Forecast error:', err);
    const msg = err.message || 'Failed to get forecast';
    return res.status(500).json({ success: false, message: msg });
  }
};
