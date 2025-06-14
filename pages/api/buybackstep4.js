
// /pages/api/buybackstep4.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const logs = [];
  const { results = [], estimate = false, employeeName, payoutMethod } = req.body;

  const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
  const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  try {
    // Step 1: Get Shopify location ID (only once)
    const locationRes = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/locations.json`, {
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    const locationData = await locationRes.json();
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
      const skuData = await skuRes.json();
      variant = skuData.variants?.[0];

      if (!variant) {
        // Fallback: search product by title
        const productRes = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/products.json?title=${encodeURIComponent(cardName)}`, {
          headers: {
            'X-Shopify-Access-Token': ACCESS_TOKEN,
            'Content-Type': 'application/json'
          }
        });
        const productData = await productRes.json();
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

      // Only update inventory if it's a real trade (not estimate)
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

        if (!updateRes.ok) {
          const errText = await updateRes.text();
          logs.push(`❌ Inventory update failed: ${errText}`);
          continue;
        }

        logs.push(`📦 Inventory set for ${cardName} to ${quantity}`);
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
    console.error(message);
    return res.status(500).send(message);
  }
}
