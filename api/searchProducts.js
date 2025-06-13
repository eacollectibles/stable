import fetch from 'node-fetch';

const getAllProducts = async () => {
  const allProducts = [];
  let url = 'https://your-shopify-store.myshopify.com/admin/api/2023-01/products.json?limit=250';
  let hasNextPage = true;

  while (hasNextPage) {
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_PASSWORD,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) throw new Error("Failed to fetch products");

    const data = await response.json();
    allProducts.push(...(data.products || []));

    const linkHeader = response.headers.get("link");
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      url = match ? match[1] : null;
      hasNextPage = !!url;
    } else {
      hasNextPage = false;
    }
  }

  return allProducts;
};

export default async function handler(req, res) {
  const { q } = req.query;

  try {
    const products = await getAllProducts();
    const placeholder = "https://via.placeholder.com/60x60.png?text=No+Image";

    const matched = [];
    const allSkus = [];

    for (const product of products) {
      for (const variant of product.variants) {
        const sku = variant.sku || "";
        allSkus.push(sku);

        if (sku.toLowerCase().includes(q.toLowerCase())) {
          matched.push({
            title: product.title,
            sku: sku,
            price: variant.price,
            image: product.images?.[0]?.src || placeholder,
            debug: `Matched SKU: ${sku}`
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

      if (matched.length >= 5) break;
    }

    res.status(200).json({ matched, allSkus });
  } catch (err) {
    console.error("Shopify fetch error:", err);
    res.status(500).json({ error: "Failed to search all products" });
  }
}