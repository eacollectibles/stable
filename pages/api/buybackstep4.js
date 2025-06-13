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
    const { cardName, quantity = 1 } = card;
    let productRes = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/products.json?title=${encodeURIComponent(cardName)}`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    let productText = await productRes.text();
    let productData;
    try { productData = JSON.parse(productText); }
    catch (err) { return res.status(500).json({ error: 'Invalid JSON from Shopify', raw: productText }); }
    if (!productData.products || productData.products.length === 0) {
      results.push({ cardName, match: null, itemValue: 0, tradeInValue: 0, quantity });
      continue;
    }
    const variant = productData.products[0].variants[0];
    const itemValue = parseFloat(variant.compare_at_price || variant.price || 0);
    const tradeInValue = itemValue * 0.3;
    results.push({
      cardName,
      match: productData.products[0].title,
      itemValue,
      tradeInValue,
      quantity
    });
    totalValue += tradeInValue * quantity;
  }
  let giftCardCode = null;
  if (payoutMethod?.toLowerCase() === 'store-credit' && totalValue > 0) {
    const giftCardRes = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/gift_cards.json`, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        gift_card: {
          initial_value: totalValue.toFixed(2),
          note: `Trade-in credit issued by ${employeeName}`,
          currency: 'CAD'
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