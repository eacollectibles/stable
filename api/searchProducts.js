export default async function handler(req, res) {
  const query = req.query.q;
  if (!query) return res.status(400).json({ error: 'Missing search query' });

  const SHOPIFY_API_KEY = process.env.SHOPIFY_API_KEY;
  const SHOPIFY_API_PASSWORD = process.env.SHOPIFY_API_PASSWORD;
  const SHOPIFY_STORE = process.env.SHOPIFY_STORE;

  const endpoint = `https://${SHOPIFY_STORE}/admin/api/2024-04/graphql.json`;

  const graphqlQuery = {
    query: `
      query {
        products(first: 5, query: "${query}") {
          edges {
            node {
              id
              title
              tags
              variants(first: 1) {
                edges {
                  node {
                    sku
                    price
                  }
                }
              }
              metafields(first: 5) {
                edges {
                  node {
                    namespace
                    key
                    value
                  }
                }
              }
            }
          }
        }
      }
    `
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_API_PASSWORD,
      },
      body: JSON.stringify(graphqlQuery),
    });

    const json = await response.json();

    const results = json.data.products.edges.map(edge => {
      const product = edge.node;
      const variant = product.variants.edges[0]?.node || {};
      const cardNumberMetafield = product.metafields.edges.find(mf =>
        mf.node.key === 'card_number'
      );

      return {
        title: product.title,
        sku: variant.sku || '',
        price: variant.price || '',
        tags: product.tags,
        card_number: cardNumberMetafield?.node.value || '',
      };
    });

    res.status(200).json(results);
  } catch (err) {
    console.error('Shopify GraphQL error:', err);
    res.status(500).json({ error: 'Failed to fetch from Shopify' });
  }
}