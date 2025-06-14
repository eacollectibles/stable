
// /pages/api/buybackstep4.js (DEBUG VERSION)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const logs = [];
  const { results = [], estimate = false, employeeName, payoutMethod } = req.body;

  const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
  const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  logs.push("🔍 Environment Check:");
  logs.push("SHOPIFY_DOMAIN = " + (SHOPIFY_DOMAIN || '[undefined]'));
  logs.push("SHOPIFY_ADMIN_API_TOKEN = " + (ACCESS_TOKEN ? '[REDACTED]' : '[undefined]'));

  try {
    if (!SHOPIFY_DOMAIN || !ACCESS_TOKEN) {
      throw new Error("Missing environment variables");
    }

    // Step 1: Get Shopify location ID (only once)
    const locationRes = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/locations.json`, {
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    const locationText = await locationRes.text();
    logs.push("🌐 Raw location response: " + locationText);

    let locationData;
    try {
      locationData = JSON.parse(locationText);
    } catch (e) {
      throw new Error("Failed to parse locations.json: " + locationText);
    }

    const locationId = locationData.locations?.[0]?.id;
    if (!locationId) throw new Error("No Shopify location ID found.");

    logs.push(`✅ Shopify Location ID: ${locationId}`);

    const processed = [];

    for (const card of results) {
      const { match: cardName, cardSku, quantity = 1, tradeInValue } = card;
      let product = null, variant = null;

      // Try to match by SKU first
      const skuRes = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/variants.json?sku=${encodeURIComponent(cardSku)}`, {
        headers: {
          'X-Shopify-Access-Token': ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      });
      const skuText = await skuRes.text();
      logs.push("🔍 SKU response: " + skuText);

      let skuData;
      try {
        skuData = JSON.parse(skuText);
      } catch (e) {
        throw new Error("Failed to parse variants.json: " + skuText);
      }

      variant = skuData.variants?.[0];

      if (!variant) {
        // Fallback: search product by title
        const productRes = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/products.json?title=${encodeURIComponent(cardName)}`, {
          headers: {
            'X-Shopify-Access-Token': ACCESS_TOKEN,
            'Content-Type': 'application/json'
          }
        });
        const productText = await productRes.text();
        logs.push("🔍 Title fallback response: " + productText);

        const productData = JSON.parse(productText);
        product = productData.products?.[0];
        variant = product?.variants?.[0];
        logs.push(`🔍 Matched by title: ${cardName}`);
      } else {
        logs.push(`🔍 Matched by SKU: ${cardSku}`);
      }

      if (!variant) {
        logs.push(`❌ Could not find variant for ${cardName}`);
        continue;
      }

      const inventoryItemId = variant.inventory_item_id;

      if (!estimate) {
        const updateRes = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/inventory_levels/set.json`, {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': ACCESS_TOKEN,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            location_id: locationId,
            inventory_item_id: inventoryItemId,
            available: quantity
          })
        });

        const updateText = await updateRes.text();
        logs.push("📦 Inventory update response: " + updateText);
      } else {
        logs.push(`🧪 Estimate only for ${cardName}, quantity ${quantity}`);
      }

      processed.push({
        name: cardName,
        sku: cardSku,
        quantity,
        updated: !estimate
      });
    }

    return res.status(200).json({ success: true, processed, logs });
  } catch (err) {
    const message = "❌ Fatal API Crash: " + (err.stack || err.message || err.toString());
    logs.push(message);
    return res.status(500).json({ error: true, logs });
  }
}
