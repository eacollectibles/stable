
const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { cardName } = req.body;
  if (!cardName) {
    return res.status(400).json({ error: 'Missing card name' });
  }

  const SHOPIFY_DOMAIN = "ke40sv-my.myshopify.com";
  const ACCESS_TOKEN = "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";

  try {
    const response = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2024-04/products.json?title=${encodeURIComponent(cardName)}`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (!data.products || data.products.length === 0) {
      return res.status(404).json({ error: 'Card not found in Shopify inventory' });
    }

    const product = data.products[0];
    const variant = product.variants[0];

    return res.status(200).json({
      name: product.title,
      sku: variant.sku,
      price: parseFloat(variant.price),
      inventory: variant.inventory_quantity,
      condition: "NM", // default condition for now
      tradeInValue: (parseFloat(variant.price) * 0.30).toFixed(2) // 30% buyback rate
    });
  } catch (err) {
    console.error('Shopify API Error:', err);
    return res.status(500).json({ error: 'Failed to connect to Shopify API' });
  }
}
