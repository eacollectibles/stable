
module.exports = function handler(req, res) {
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

  return res.status(200).json({
    name: cardName,
    condition: matched.condition,
    tradeInValue: matched.price
  });
}
