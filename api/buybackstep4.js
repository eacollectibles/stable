
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { cardName } = req.body;
  if (!cardName) {
    return res.status(400).json({ error: 'Missing card name' });
  }

  // Mock product database
  const mockProducts = {
    'Pikachu': { price: 1.25, condition: 'NM' },
    'Charizard': { price: 45.00, condition: 'LP' },
    'Blue-Eyes White Dragon': { price: 30.00, condition: 'MP' },
    'Dark Magician': { price: 20.00, condition: 'NM' },
    'Luffy': { price: 5.00, condition: 'NM' }
  };

  const matched = mockProducts[cardName];
  if (!matched) {
    return res.status(404).json({ error: 'Card not found' });
  }

  return 
    let giftCardCode = null;
    if (payoutMethod === "store-credit" && totalValue > 0) {
      try {
        const giftCardRes = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2023-10/gift_cards.json`, {
          method: "POST",
          headers: {
            "X-Shopify-Access-Token": ACCESS_TOKEN,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            gift_card: {
              initial_value: totalValue.toFixed(2),
              note: `Buyback payout`,
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
    giftCardCode,
    name: cardName,
    condition: matched.condition,
    tradeInValue: matched.price
  });
}
