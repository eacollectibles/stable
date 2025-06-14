
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const estimateMode = req.query?.estimate === 'true';
  const { cards, employeeName, payoutMethod, overrideTotal } = req.body;

  if (!cards || !Array.isArray(cards)) {
    return res.status(400).json({ error: 'Invalid or missing cards array' });
  }

  const SHOPIFY_DOMAIN = "ke40sv-my.myshopify.com";
  const ACCESS_TOKEN = "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";

  const fetchVariantBySKU = async (sku) => {
    const query = `
      {
        productVariants(first: 1, query: "sku:${sku}") {
          edges {
            node {
              id
              title
              sku
              price
              inventoryQuantity
              inventoryItem {
                id
              }
              product {
                title
              }
            }
          }
        }
      }
    `;

    const graphqlRes = await fetch(\`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/graphql.json\`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query })
    });

    const json = await graphqlRes.json();
    const variantEdge = json?.data?.productVariants?.edges?.[0];
    return variantEdge?.node || null;
  };

  const fetchVariantByTitle = async (title) => {
    const productRes = await fetch(\`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/products.json?title=\${encodeURIComponent(title)}\`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    const productText = await productRes.text();
    let productData;
    try {
      productData = JSON.parse(productText);
    } catch (err) {
      return null;
    }

    if (!productData.products || productData.products.length === 0) {
      return null;
    }

    const product = productData.products[0];
    const variant = product.variants[0];
    return {
      sku: variant.sku,
      price: variant.price,
      inventoryItem: {
        id: variant.inventory_item_id
      },
      product: {
        title: product.title
      }
    };
  };

  const locationRes = await fetch(\`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/locations.json\`, {
    headers: {
      'X-Shopify-Access-Token': ACCESS_TOKEN,
      'Content-Type': 'application/json'
    }
  });

  const locations = await locationRes.json();
  if (!locations.locations || locations.locations.length === 0) {
    return res.status(500).json({ error: 'No inventory locations found' });
  }

  const locationId = locations.locations[0].id;
  let totalValue = 0;
  const results = [];

  for (const card of cards) {
    const { variantSku, cardName, quantity = 1 } = card;
    let variant = await fetchVariantBySKU(variantSku);

    if (!variant) {
      variant = await fetchVariantByTitle(cardName);
    }

    if (!variant) {
      results.push({ variantSku, cardName, error: 'Variant not found by SKU or title' });
      continue;
    }

    const value = parseFloat(variant.price || "0") * 0.3;
    totalValue += value * quantity;

    if (!estimateMode) {
      await fetch(\`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/inventory_levels/adjust.json\`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': ACCESS_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          location_id: locationId,
          inventory_item_id: variant.inventoryItem.id,
          available_adjustment: quantity
        })
      });
    }

    results.push({
      title: variant.product.title,
      sku: variant.sku,
      quantity,
      value: value.toFixed(2)
    });
  }

  return res.status(200).json({
    processedBy: employeeName,
    totalValue: totalValue.toFixed(2),
    payoutMethod,
    overrideTotal,
    results
  });
};
