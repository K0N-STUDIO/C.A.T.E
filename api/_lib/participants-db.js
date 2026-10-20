const { neon } = require('@neondatabase/serverless');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const sql = neon(databaseUrl);

let schemaReadyPromise = null;

function getRows(result) {
  if (Array.isArray(result)) {
    return result;
  }

  if (result && Array.isArray(result.rows)) {
    return result.rows;
  }

  return [];
}

async function ensureSchema() {
  if (!schemaReadyPromise) {
    schemaReadyPromise = sql`
      CREATE TABLE IF NOT EXISTS participants (
        discord_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  }

  await schemaReadyPromise;
}

async function upsertParticipant(id, name) {
  await ensureSchema();

  const result = await sql`
    INSERT INTO participants (discord_id, name, signed_at)
    VALUES (${id}, ${name}, NOW())
    ON CONFLICT (discord_id) DO UPDATE SET
      name = EXCLUDED.name,
      signed_at = NOW()
    RETURNING name, discord_id AS id, signed_at AS "signedAt"
  `;

  const rows = getRows(result);

  return rows[0] || null;
}

async function getParticipantById(id) {
  await ensureSchema();

  const result = await sql`
    SELECT name, discord_id AS id, signed_at AS "signedAt"
    FROM participants
    WHERE discord_id = ${id}
    LIMIT 1
  `;

  const rows = getRows(result);

  return rows[0] || null;
}

async function listParticipants() {
  await ensureSchema();

  const result = await sql`
    SELECT name, discord_id AS id, signed_at AS "signedAt"
    FROM participants
    ORDER BY signed_at DESC
  `;

  return getRows(result);
}

module.exports = {
  upsertParticipant,
  getParticipantById,
  listParticipants,
};
