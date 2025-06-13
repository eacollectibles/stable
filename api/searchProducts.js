import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { q } = req.query;

  try {
    const shopifyRes = await fetch(`https://your-shopify-store.myshopify.com/admin/api/2023-01/products.json?limit=250`, {
      method: 'GET',
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_PASSWORD,
        'Content-Type': 'application/json'
      }
    });

    const data = await shopifyRes.json();
    const products = data.products || [];

    const placeholder = "https://via.placeholder.com/60x60.png?text=No+Image";
    const debugSkus = [];

    const matched = [];

    for (const product of products) {
      for (const variant of product.variants) {
        debugSkus.push(variant.sku || "(no sku)");

        if (variant.sku?.toLowerCase().includes(q.toLowerCase())) {
          matched.push({
            title: product.title,
            sku: variant.sku,
            price: variant.price,
            image: product.images?.[0]?.src || placeholder,
            debug: `Matched SKU: ${variant.sku}`
          });
          break;
        }
      }

      if (!matched.length && product.title.toLowerCase().includes(q.toLowerCase())) {
        matched.push({
          title: product.title,
          sku: product.variants[0]?.sku,
          price: product.variants[0]?.price,
          image: product.images?.[0]?.src || placeholder,
          debug: `Matched Title: ${product.title}`
        });
      }
    }

    res.status(200).json({ matched: matched.slice(0, 5), debugSkus });
  } catch (err) {
    console.error("Shopify fetch error:", err);
    res.status(500).json({ error: "Failed to search products" });
  }
}