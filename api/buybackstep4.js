let tradeLog = [];

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { employee, payoutMethod, cards } = req.body;
  const timestamp = new Date().toISOString();

  const newEntry = { employee, payoutMethod, timestamp, cards };
  tradeLog.push(newEntry);

  res.status(200).json({ success: true, entry: newEntry });
}