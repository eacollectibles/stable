
// /pages/api/buybackstep4.js (DEBUG VERSION)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const logs = [];
  const { results = [], estimate = false, employeeName, payoutMethod } = req.body;

  const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
  const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN;

  // Helper function for rate limiting
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Helper function for safe API calls
  const safeApiCall = async (url, options = {}) => {
    try {
      const response = await fetch(url, options);
      const text = await response.text();
      
      if (!response.ok) {
        throw new Error(`API Error ${response.status}: ${response.statusText} - ${text}`);
      }
      
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        throw new Error(`JSON Parse Error: ${text}`);
      }
      
      return { data, text, ok: true };
    } catch (error) {
      return { error: error.message, ok: false };
    }
  };

  logs.push("🔍 Environment Check:");
  logs.push("SHOPIFY_DOMAIN = " + (SHOPIFY_DOMAIN || '[undefined]'));
  logs.push("SHOPIFY_ADMIN_API_TOKEN = " + (ACCESS_TOKEN ? '[REDACTED]' : '[undefined]'));

  try {
    if (!SHOPIFY_DOMAIN || !ACCESS_TOKEN) {
      throw new Error("Missing environment variables");
    }

    // Step 1: Get Shopify location ID (only once)
    const locationResult = await safeApiCall(`https://${SHOPIFY_DOMAIN}/admin/api/2024-01/locations.json`, {
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    if (!locationResult.ok) {
      throw new Error("Location API failed: " + locationResult.error);
    }

    logs.push("🌐 Raw location response: " + locationResult.text);

    const locationId = locationResult.data.locations?.[0]?.id;
    if (!locationId) throw new Error("No Shopify location ID found.");

    logs.push(`✅ Shopify Location ID: ${locationId}`);

    const processed = [];

    for (let i = 0; i < results.length; i++) {
      const card = results[i];
      const { match: cardName, cardSku, quantity = 1, tradeInValue } = card;
      let variant = null;

      logs.push(`\n🔄 Processing card ${i + 1}/${results.length}: ${cardName}`);

      // Add delay to prevent rate limiting
      if (i > 0) {
        await delay(500); // 500ms delay between requests
      }

      // Try to match by SKU first
      const skuResult = await safeApiCall(`https://${SHOPIFY_DOMAIN}/admin/api/2024-01/variants.json?sku=${encodeURIComponent(cardSku)}`, {
        headers: {
          'X-Shopify-Access-Token': ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      });

      if (!skuResult.ok) {
        logs.push(`❌ SKU lookup failed for ${cardSku}: ${skuResult.error}`);
        continue;
      }

      logs.push("🔍 SKU response: " + skuResult.text);
      variant = skuResult.data.variants?.[0];

      if (!variant) {
        // Add delay before fallback request
        await delay(500);
        
        // Fallback: search product by title
        const productResult = await safeApiCall(`https://${SHOPIFY_DOMAIN}/admin/api/2024-01/products.json?title=${encodeURIComponent(cardName)}`, {
          headers: {
            'X-Shopify-Access-Token': ACCESS_TOKEN,
            'Content-Type': 'application/json'
          }
        });

        if (!productResult.ok) {
          logs.push(`❌ Title lookup failed for ${cardName}: ${productResult.error}`);
          continue;
        }

        logs.push("🔍 Title fallback response: " + productResult.text);
        const product = productResult.data.products?.[0];
        variant = product?.variants?.[0];
        
        if (variant) {
          logs.push(`🔍 Matched by title: ${cardName}`);
        }
      } else {
        logs.push(`🔍 Matched by SKU: ${cardSku}`);
      }

      if (!variant) {
        logs.push(`❌ Could not find variant for ${cardName}`);
        continue;
      }

      const inventoryItemId = variant.inventory_item_id;

      if (!estimate) {
        // Add delay before inventory update
        await delay(500);
        
        const updateResult = await safeApiCall(`https://${SHOPIFY_DOMAIN}/admin/api/2024-01/inventory_levels/set.json`, {
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

        if (!updateResult.ok) {
          logs.push(`❌ Inventory update failed for ${cardName}: ${updateResult.error}`);
          continue;
        }

        logs.push("📦 Inventory update response: " + updateResult.text);
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
