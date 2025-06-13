import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { q } = req.query;

  try {
    const shopifyRes = await fetch(`https://your-shopify-store.myshopify.com/admin/api/2023-01/products.json`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_PASSWORD,
        'Content-Type': 'application/json'
      }
    });

    const data = await shopifyRes.json();
    const products = data.products || [];

    // Fuzzy search logic
    const matched = products.filter(p =>
      p.title.toLowerCase().includes(q.toLowerCase()) ||
      p.variants[0]?.sku?.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 5); // limit to 5 matches

    const results = matched.map(product => ({
      title: product.title,
      sku: product.variants[0]?.sku,
      price: product.variants[0]?.price,
      image: product.images?.[0]?.src || null
    }));

    res.status(200).json(results);
  } catch (err) {
    console.error("Shopify fetch error:", err);
    res.status(500).json({ error: "Failed to search products" });
  }
}