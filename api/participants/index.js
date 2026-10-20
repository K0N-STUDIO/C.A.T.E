const { listParticipants } = require('../_lib/participants-db');

const DB_ACCESS_ALLOWED_IDS = new Set([
  '1325481209827950766',
  '458679676685254666',
]);

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const requesterId = String(req.query.requesterId || '');
  if (!DB_ACCESS_ALLOWED_IDS.has(requesterId)) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  try {
    const participants = await listParticipants();
    res.status(200).json({ participants });
  } catch (error) {
    res.status(500).json({ error: 'failed to load participants' });
  }
};
