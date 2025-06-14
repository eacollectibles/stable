

module.exports = async function handler(req, res) {
  const logs = [];
  const log = (msg) => {
    logs.push(msg);
    console.log(msg);
  };

  try {
    log("✅ Function start");

    if (req.method !== 'POST') {
      log("❌ Invalid method");
      return res.status(405).json({ error: 'Method Not Allowed', logs });
    }

    const estimateMode = req.query?.estimate === 'true';
    const cards = req.body.cards || req.body.results || [];

    if (!cards || !Array.isArray(cards)) {
      log("❌ Missing or invalid cards array");
      return res.status(400).json({ error: 'Invalid or missing cards array', logs });
    }

    const { employeeName, payoutMethod, overrideTotal } = req.body;
    const SHOPIFY_DOMAIN = "ke40sv-my.myshopify.com";
    const ACCESS_TOKEN = "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";

    const fetchVariantBySKU = async (sku) => {
      const query = \`
        {
          productVariants(first: 1, query: "sku:\${sku}") {
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
      \`;

      const graphqlRes = await fetch(\`https://\${SHOPIFY_DOMAIN}/admin/api/2023-10/graphql.json\`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': ACCESS_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      const json = await graphqlRes.json();
      return json?.data?.productVariants?.edges?.[0]?.node || null;
    };

    let totalValue = 0;
    const results = [];

    for (const card of cards) {
      try {
        const { cardName, sku = null, quantity = 1 } = card;
        log("🔍 Searching for card: " + cardName);

        const matchedVariant = await fetchVariantBySKU(sku || cardName);
        if (matchedVariant) {
          const price = parseFloat(matchedVariant.price || "0");
          const tradeInValue = parseFloat((price * 0.3).toFixed(2));
          totalValue += tradeInValue * quantity;

          results.push({
            cardName: matchedVariant.title,
            match: matchedVariant.title,
            tradeInValue,
            quantity
          });

          log(\`✅ Matched: \${matchedVariant.title} at \$\${price}, Trade-In: \$\${tradeInValue}\`);

          if (!estimateMode && matchedVariant.inventoryItem?.id) {
            const inventoryRes = await fetch(\`https://\${SHOPIFY_DOMAIN}/admin/api/2023-10/inventory_levels/adjust.json\`, {
              method: 'POST',
              headers: {
                'X-Shopify-Access-Token': ACCESS_TOKEN,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                location_id: 74133467967,
                inventory_item_id: matchedVariant.inventoryItem.id,
                available_adjustment: quantity
              })
            });

            if (!inventoryRes.ok) {
              const errorText = await inventoryRes.text();
              log("⚠️ Inventory adjust failed: " + errorText);
            } else {
              log("✅ Inventory adjusted");
            }
          }

        } else {
          log("❌ No match found for: " + cardName);
          results.push({
            cardName,
            match: null,
            tradeInValue: 0,
            quantity
          });
        }

      } catch (innerErr) {
        log("❌ Error processing card: " + innerErr.message);
      }
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
        log("🎁 Gift card created");
      } catch (err) {
        log("❌ Gift card creation failed: " + err.message);
      }
    }

    return res.status(200).json({
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
    log("❌ Fatal API Error: " + err.message);
    return res.status(500).json({ error: "Internal server error", details: err.message, logs });
  }
};
