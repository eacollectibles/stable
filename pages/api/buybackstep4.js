
module.exports = async function handler(req, res) {
  try {
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

    const estimateMode = req.query?.estimate === 'true';
    const cards = req.body.cards || req.body.results || [];
    const { employeeName, payoutMethod, overrideTotal } = req.body;

    if (!cards || !Array.isArray(cards)) {
      log("❌ STEP 3: Invalid or missing cards array");
      return res.status(400).json({ error: 'Invalid or missing cards array', logs });
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
                product {
                  title
                }
              }
            }
          }
        }
      `;

      const graphqlRes = await fetch(\`https://\${SHOPIFY_DOMAIN}/admin/api/2023-10/graphql.json\`, {
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

    let totalValue = 0;
    const results = [];

    for (const card of cards) {
      const { cardName, sku = null, quantity = 1 } = card;

      log("🔍 STEP 4: Processing card - " + cardName);

      const productRes = await fetch(
        \`https://\${SHOPIFY_DOMAIN}/admin/api/2023-10/products.json?title=\${encodeURIComponent(cardName)}\`,
        {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': ACCESS_TOKEN,
            'Content-Type': 'application/json'
          }
        }
      );

      const productText = await productRes.text();
      let productData;

      try {
        productData = JSON.parse(productText);
      } catch (err) {
        log("❌ STEP 5: Failed to parse product data");
        return res.status(500).json({ error: 'Failed to parse product data', details: err.message, logs });
      }

      if (!productData || !productData.products || productData.products.length === 0) {
        const matchedVariant = await fetchVariantBySKU(sku || cardName);
        if (matchedVariant) {
          const variantPrice = parseFloat(matchedVariant.price || 0);
          const tradeInValue = parseFloat((variantPrice * 0.3).toFixed(2));
          totalValue += tradeInValue * quantity;
          results.push({
            cardName: matchedVariant.title,
            match: matchedVariant.title,
            tradeInValue,
            quantity
          });
          continue;
        } else {
          results.push({
            cardName,
            match: null,
            tradeInValue: 0,
            quantity
          });
          continue;
        }
      }

      const match = productData.products[0];
      const variant = match.variants[0];
      const variantPrice = parseFloat(variant.price || 0);
      const tradeInValue = parseFloat((variantPrice * 0.3).toFixed(2));
      totalValue += tradeInValue * quantity;

      results.push({
        cardName,
        match: match.title,
        tradeInValue,
        quantity
      });
    }

    const finalPayout = overrideTotal !== undefined ? parseFloat(overrideTotal) : totalValue;

    let giftCardCode = null;
    if (payoutMethod === "store-credit" && finalPayout > 0) {
      try {
        const giftCardRes = await fetch(\`https://\${SHOPIFY_DOMAIN}/admin/api/2023-10/gift_cards.json\`, {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": ACCESS_TOKEN,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            gift_card: {
              initial_value: finalPayout.toFixed(2),
              note: \`Buyback payout for \${employeeName || "Unknown"}\`,
              currency: "CAD"
            }
          })
        });
        const giftCardData = await giftCardRes.json();
        giftCardCode = giftCardData?.gift_card?.code || null;
      } catch (err) {
        log("❌ STEP 6: Gift card creation failed");
      }
    }

    res.status(200).json({
      giftCardCode,
      estimate: estimateMode,
      employeeName,
      payoutMethod,
      results,
      total: totalValue.toFixed(2),
      overrideTotal: overrideTotal ? finalPayout.toFixed(2) : null,
      logs
    });

  } catch (err) {
    const message = "❌ Fatal API Crash: " + (err.stack || err.message || err.toString());
    console.error(message);
    return res.status(500).send(message);
  }
};
