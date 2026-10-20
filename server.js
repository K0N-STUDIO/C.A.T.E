const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const PORT = process.env.PORT || 3000;
const DB_ACCESS_ALLOWED_IDS = new Set([
  '1325481209827950766',
  '458679676685254666',
]);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'participants.sqlite3');
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(error) {
      if (error) {
        reject(error);
        return;
      }
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(rows);
    });
  });
}

async function initDb() {
  await run(`
    CREATE TABLE IF NOT EXISTS participants (
      discord_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      signed_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
}

app.post('/api/participants/sign', async (req, res) => {
  const { id, name } = req.body || {};

  if (!id || !name) {
    res.status(400).json({ error: 'id and name are required' });
    return;
  }

  try {
    await run(
      `
      INSERT INTO participants (discord_id, name, signed_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(discord_id) DO UPDATE SET
        name = excluded.name,
        signed_at = datetime('now')
      `,
      [String(id), String(name)]
    );

    const row = await get(
      'SELECT name, discord_id AS id, signed_at AS signedAt FROM participants WHERE discord_id = ?',
      [String(id)]
    );

    res.json({ ok: true, participant: row });
  } catch (error) {
    res.status(500).json({ error: 'failed to save participant' });
  }
});

app.get('/api/participants/:discordId', async (req, res) => {
  const discordId = String(req.params.discordId || '');
  if (!discordId) {
    res.status(400).json({ error: 'discord id is required' });
    return;
  }

  try {
    const row = await get(
      'SELECT name, discord_id AS id, signed_at AS signedAt FROM participants WHERE discord_id = ?',
      [discordId]
    );

    if (!row) {
      res.json({ exists: false });
      return;
    }

    res.json({ exists: true, participant: row });
  } catch (error) {
    res.status(500).json({ error: 'failed to read participant' });
  }
});

app.get('/api/participants', async (req, res) => {
  const requesterId = String(req.query.requesterId || '');
  if (!DB_ACCESS_ALLOWED_IDS.has(requesterId)) {
    res.status(403).json({ error: 'forbidden' });
    return;
  }

  try {
    const rows = await all(
      'SELECT name, discord_id AS id, signed_at AS signedAt FROM participants ORDER BY datetime(signed_at) DESC'
    );
    res.json({ participants: rows });
  } catch (error) {
    res.status(500).json({ error: 'failed to load participants' });
  }
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`C.A.T.E server is running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error('Failed to initialize database:', error);
    process.exit(1);
  });
