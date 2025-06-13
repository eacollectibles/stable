
module.exports = async function handler(req, res) {
  try {
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
                V2 {
                  amount
                }
                V2 {
                  amount
                }
                inventoryQuantity
                product {
                  title
                }
              }
            }
            edges {
              node {
                id
                title
                sku
                
                
                inventoryQuantity
                product {
                  title
                }
              }
            }
          }
        }
      `;

      const graphqlRes = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/graphql.json`, {
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
      const { cardName, sku = null, quantity = 1 } = card;
      const matchedVariant = await fetchVariantBySKU(sku || cardName);

      if (matchedVariant) {
        const itemValue = parseFloat(matchedVariant.V2?.amount || matchedVariant.V2?.amount || 0);
        const tradeInValue = parseFloat((itemValue * 0.3).toFixed(2));
        totalValue += tradeInValue * quantity;

        results.push({
          cardName: matchedVariant.title,
          match: matchedVariant.title,
          itemValue,
          tradeInValue,
          quantity
        });
      } else {
        results.push({
          cardName,
          match: null,
          itemValue: 0,
          tradeInValue: 0,
          quantity
        });
      }
    }

    const finalPayout = overrideTotal !== undefined ? parseFloat(overrideTotal) : totalValue;

    let giftCardCode = null;
    if (payoutMethod === "store-credit" && finalPayout > 0) {
      try {
        const giftCardRes = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/gift_cards.json`, {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": ACCESS_TOKEN,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            gift_card: {
              initial_value: finalPayout.toFixed(2),
              note: `Buyback payout for ${employeeName || "Unknown"}`,
              currency: "CAD"
            }
          })
        });
        const giftCardData = await giftCardRes.json();
        giftCardCode = giftCardData?.gift_card?.code || null;
      } catch (err) {
        console.error("Gift card creation failed:", err);
      }
    }

    res.status(200).json({
      estimate: estimateMode,
      employeeName,
      payoutMethod,
      results,
      total: totalValue.toFixed(2),
      overrideTotal: overrideTotal ? finalPayout.toFixed(2) : null,
      giftCardCode
    });
  } catch (err) {
    console.error("Fatal API Error:", err);
    return res.status(500).json({ error: "Internal server error", details: err.message });
  }
};
