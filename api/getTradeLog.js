import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const logPath = path.join(process.cwd(), 'data', 'trade-log.json');
  try {
    if (!fs.existsSync(logPath)) return res.status(200).json([]);
    const data = fs.readFileSync(logPath, 'utf8');
    const logs = JSON.parse(data);
    res.status(200).json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to load trade log' });
  }
}