// backend/services/forecastService.js

require('dotenv').config();

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Send historical sales data to the Python AI forecasting service.
 * @param {string} productId - The product identifier (string).
 * @param {Array<{date:string, units:number}>} history - Sorted array of sales points.
 * @returns {Promise<Object>} - Forecast response from the AI service.
 */
async function getForecastFromAI(productId, history) {
  // Build payload matching the Python service's ProductData schema.
  const payload = {
    productId,
    // The service requires a productName; we use the productId as a placeholder
    // to avoid inventing new metadata while satisfying the required field.
    productName: productId,
    costPrice: 0, // cost/selling price are required but can be zero per model validation.
    sellingPrice: 0,
    salesHistory: history.map((h) => ({ date: h.date, units: h.units })),
    // optional fields omitted (stockLevel, assumedLeadTimeDays)
  };

  try {
    const response = await fetch(`${AI_SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      const msg = errData?.detail || response.statusText;
      throw new Error(`AI service error: ${msg}`);
    }
    return await response.json();
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error('AI service timeout');
    }
    if (err.message && err.message.startsWith('AI service error:')) {
      throw err;
    }
    throw new Error('AI service unavailable');
  }
}

module.exports = { getForecastFromAI };
