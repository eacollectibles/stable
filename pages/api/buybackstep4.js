
import axios from 'axios';

export default async function handler(req, res) {
  const logs = [];
  const log = (msg) => {
    logs.push(msg);
    console.log(msg);
  };

  log("🚨 STEP 1: Handler entered");

  if (req.method !== 'POST') {
    log("🚨 STEP 2: Method not allowed");
    return res.status(405).json({ message: 'Method not allowed', logs });
  }

  const results = req.body.results || req.body.cards || [];
  const match = results?.[0]?.match;
  const quantity = results?.[0]?.quantity || 1;

  if (!match) {
    log("❌ STEP 2.5: Invalid or missing match value");
    return res.status(400).json({ error: 'Invalid or missing cards array', logs });
  }

  log("🚨 STEP 3: Request body parsed");
  log("Match value: " + match);
  log("Quantity: " + quantity);

  const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
  const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_KEY;

  try {
    log("🚨 STEP 4: Fetching Shopify products");
    const productRes = await axios.get(
      `https://${SHOPIFY_DOMAIN}/admin/api/2023-10/products.json?limit=250`,
      {
        headers: {
          'X-Shopify-Access-Token': ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    const products = productRes.data.products;
    let matchedVariant = null;

    for (const product of products) {
      for (const variant of product.variants) {
        if (
          variant.sku?.toLowerCase() === match.toLowerCase() ||
          product.title?.toLowerCase().includes(match.toLowerCase())
        ) {
          matchedVariant = variant;
          break;
        }
      }
      if (matchedVariant) break;
    }

    if (!matchedVariant) {
      log("❌ STEP 5: No variant matched");
      return res.status(404).json({ message: 'Variant not found by SKU or Title', logs });
    }

    const inventory_item_id = matchedVariant.inventory_item_id;
    log("✅ STEP 6: Found inventory_item_id: " + inventory_item_id);

    const locationRes = await axios.get(
      `https://${SHOPIFY_DOMAIN}/admin/api/2023-10/locations.json`,
      {
        headers: {
          'X-Shopify-Access-Token': ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    const location_id = locationRes.data.locations?.[0]?.id;
    if (!location_id) {
      log("❌ STEP 7: No location found");
      return res.status(500).json({ message: 'No Shopify location found', logs });
    }
    log("✅ STEP 8: Found location_id: " + location_id);

    log("🚨 STEP 9: Posting to inventory_levels/adjust");
    const adjustRes = await axios.post(
      `https://${SHOPIFY_DOMAIN}/admin/api/2023-10/inventory_levels/adjust.json`,
      {
        location_id,
        inventory_item_id,
        available_adjustment: quantity,
      },
      {
        headers: {
          'X-Shopify-Access-Token': ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
      }
    );

    log("✅ STEP 10: Shopify inventory adjusted");
    return res.status(200).json({ message: 'Inventory updated successfully', result: adjustRes.data, logs });
  } catch (error) {
    log("❌ STEP ERROR: " + (error.response?.data?.errors || error.message));
    return res.status(500).json({ message: 'Error adjusting inventory', error: error.response?.data || error.message, logs });
  }
}
