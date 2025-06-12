import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const logPath = path.join(process.cwd(), 'data', 'trade-log.json');
  const { employee, payoutMethod, cards } = req.body;
  const timestamp = new Date().toISOString();

  const newEntry = { employee, payoutMethod, timestamp, cards };

  try {
    let existing = [];
    if (fs.existsSync(logPath)) {
      const fileData = fs.readFileSync(logPath, 'utf8');
      existing = JSON.parse(fileData);
    }
    existing.push(newEntry);
    fs.writeFileSync(logPath, JSON.stringify(existing, null, 2));
    res.status(200).json({ success: true, entry: newEntry });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error writing log' });
  }
}