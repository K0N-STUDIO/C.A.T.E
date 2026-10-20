const { upsertParticipant } = require('../_lib/participants-db');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const { id, name } = req.body || {};
  if (!id || !name) {
    res.status(400).json({ error: 'id and name are required' });
    return;
  }

  try {
    const participant = await upsertParticipant(String(id), String(name));
    res.status(200).json({ ok: true, participant });
  } catch (error) {
    res.status(500).json({ error: 'failed to save participant' });
  }
};
