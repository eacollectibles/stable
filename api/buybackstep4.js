
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { cards, employeeName, payoutMethod } = req.body;
  if (!cards || !Array.isArray(cards)) {
    return res.status(400).json({ error: 'Invalid or missing cards array' });
  }

  const SHOPIFY_DOMAIN = "ke40sv-my.myshopify.com";
  const ACCESS_TOKEN = "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";

  let totalValue = 0;
  const results = [];

  for (const card of cards) {
    const { cardName, sku = null, quantity = 1 } = card;

    const productRes = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/products.json?title=${encodeURIComponent(cardName)}`, {
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
      // If no product found by title, attempt to search all variants by SKU
      if (!productData || !productData.products || productData.products.length === 0) {
        const variantsRes = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/variants.json`, {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': ACCESS_TOKEN,
            'Content-Type': 'application/json'
          }
        });

        const variantsText = await variantsRes.text();
        let variantsData;
        try {
          variantsData = JSON.parse(variantsText);
        } catch (parseErr) {
          return res.status(500).json({ error: 'Failed to parse variants data' });
        }

        const matchedVariant = variantsData.variants.find(v => v.sku === (sku || cardName));
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
    
    } catch (parseErr) {
      return res.status(500).json({ error: "Invalid JSON from Shopify", raw: productText });
    }

    if (!productData.products || productData.products.length === 0) {
      results.push({
      retailPrice: parseFloat(variant.price || 0), cardName, error: "Card not found in Shopify inventory" });
      continue;
    }

    
    
    const tradeInValue = parseFloat(variant.compare_at_price || variant.price) * 0.3;

    results.push({
      cardName,
      match: productData.product.title,
      tradeInValue,
      quantity,
      retailPrice: parseFloat(variant.price || 0)
    });
    totalValue += tradeInValue * quantity;
  }

  let giftCardCode = null;

  const isEstimate = req.query?.estimate === 'true';

  if (!isEstimate && payoutMethod?.toLowerCase() === "store-credit" && totalValue > 0) {
    const giftCardRes = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/gift_cards.json`, {
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": ACCESS_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        gift_card: {
          initial_value: totalValue.toFixed(2),
          note: `Trade-in credit issued by ${employeeName}`,
          currency: "CAD"
        }
      })
    });

    const giftCardData = await giftCardRes.json();
    giftCardCode = giftCardData.gift_card?.code || null;
  }

  return res.status(200).json({
    employee: employeeName,
    payoutMethod,
    results,
    total: totalValue.toFixed(2),
    giftCardCode
  });
};
