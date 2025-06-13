import fetch from 'node-fetch';

export default async function handler(req, res) {
  const { q } = req.query;

  const query = `
    {
      products(first: 5, query: "sku:${q}") {
        edges {
          node {
            title
            images(first: 1) {
              edges {
                node {
                  originalSrc
                }
              }
            }
            variants(first: 5) {
              edges {
                node {
                  sku
                  price
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetch('https://ea-collectibles.myshopify.com/admin/api/2023-01/graphql.json', {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_PASSWORD,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    const result = await response.json();

    const placeholder = "https://via.placeholder.com/60x60.png?text=No+Image";
    const matched = [];

    const products = result.data?.products?.edges || [];

    for (const edge of products) {
      const product = edge.node;
      const variants = product.variants.edges;

      for (const variantEdge of variants) {
        const variant = variantEdge.node;
        if (variant.sku?.toLowerCase() === q.toLowerCase()) {
          matched.push({
            title: product.title,
            sku: variant.sku,
            price: variant.price,
            image: product.images?.edges?.[0]?.node?.originalSrc || placeholder,
            debug: "Matched via GraphQL"
          });
        }
      }
    }

    res.status(200).json(matched);
  } catch (err) {
    console.error("GraphQL fetch error:", err);
    res.status(500).json({ error: "GraphQL SKU search failed" });
  }
}