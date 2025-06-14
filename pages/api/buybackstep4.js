
import axios from 'axios';

export default async function handler(req, res) {
  console.log("🚨 STEP 1: Handler entered");

  if (req.method !== 'POST') {
    console.log("🚨 STEP 2: Method not allowed");
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { results } = req.body;
  const match = results?.[0]?.match;
  const quantity = results?.[0]?.quantity || 1;

  console.log("🚨 STEP 3: Request body parsed");
  console.log("Match value:", match);
  console.log("Quantity:", quantity);

  const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
  const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_KEY;

  try {
    console.log("🚨 STEP 4: Fetching Shopify products");
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
      console.log("❌ STEP 5: No variant matched");
      return res.status(404).json({ message: 'Variant not found by SKU or Title' });
    }

    const inventory_item_id = matchedVariant.inventory_item_id;
    console.log("✅ STEP 6: Found inventory_item_id:", inventory_item_id);

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
      console.log("❌ STEP 7: No location found");
      return res.status(500).json({ message: 'No Shopify location found' });
    }
    console.log("✅ STEP 8: Found location_id:", location_id);

    console.log("🚨 STEP 9: Posting to inventory_levels/adjust");
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

    console.log("✅ STEP 10: Shopify inventory adjusted:", adjustRes.data);
    res.status(200).json({ message: 'Inventory updated successfully', result: adjustRes.data });
  } catch (error) {
    console.error("❌ STEP ERROR: Shopify API error:", error.response?.data || error.message);
    res.status(500).json({ message: 'Error adjusting inventory', error: error.response?.data || error.message });
  }
}
