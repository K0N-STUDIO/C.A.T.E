const { getParticipantById } = require('../_lib/participants-db');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const discordId = String(req.query.discordId || '');
  if (!discordId) {
    res.status(400).json({ error: 'discord id is required' });
    return;
  }

  try {
    const participant = await getParticipantById(discordId);
    if (!participant) {
      res.status(200).json({ exists: false });
      return;
    }

    res.status(200).json({ exists: true, participant });
  } catch (error) {
    res.status(500).json({ error: 'failed to read participant' });
  }
};
