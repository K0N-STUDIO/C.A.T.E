const PASSWORD = 'SevenEdges';
const DB_ACCESS_ALLOWED_IDS = new Set([
  '1325481209827950766',
  '458679676685254666',
]);

const state = {
  passwordUnlocked: false,
  discordVerified: false,
  discordUser: null,
};

const tabs = document.querySelectorAll('.tab');
const panels = document.querySelectorAll('.panel');
const passwordForm = document.getElementById('passwordForm');
const passwordInput = document.getElementById('passwordInput');
const status = document.getElementById('status');
const oauthBlock = document.getElementById('oauthBlock');
const authState = document.getElementById('authState');
const archiveTab = document.getElementById('archiveTab');
const openArchiveButton = document.getElementById('openArchiveButton');
const discordButton = document.getElementById('discordButton');
const briefingUser = document.getElementById('briefingUser');
const signContractButton = document.getElementById('signContractButton');
const contractState = document.getElementById('contractState');
const openDbButton = document.getElementById('openDbButton');
const dbAccessState = document.getElementById('dbAccessState');
const participantsDbPanel = document.getElementById('participantsDbPanel');
const participantsDbBody = document.getElementById('participantsDbBody');
const participantsDbEmpty = document.getElementById('participantsDbEmpty');

function getParticipantName(user) {
  return user?.global_name || user?.username || 'Unknown';
}

function getCurrentParticipant() {
  if (!state.discordUser?.id) {
    return null;
  }

  return {
    name: getParticipantName(state.discordUser),
    id: state.discordUser.id,
  };
}

async function apiSignContract(participant) {
  const response = await fetch('/api/participants/sign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(participant),
  });

  if (!response.ok) {
    let message = 'Failed to sign contract';
    try {
      const payload = await response.json();
      if (payload?.error) {
        message = payload.error;
      }
    } catch (error) {
      // Ignore JSON parse errors and keep default message.
    }

    throw new Error(message);
  }

  return response.json();
}

async function apiGetParticipant(discordId) {
  const response = await fetch(`/api/participants/${encodeURIComponent(discordId)}`);

  if (!response.ok) {
    throw new Error('Failed to fetch participant');
  }

  return response.json();
}

async function apiGetParticipants(requesterId) {
  const response = await fetch(`/api/participants?requesterId=${encodeURIComponent(requesterId)}`);

  if (!response.ok) {
    throw new Error('Failed to fetch participants database');
  }

  return response.json();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function renderParticipantsDb() {
  if (!participantsDbBody || !participantsDbEmpty) {
    return;
  }

  if (!state.discordUser?.id) {
    participantsDbBody.innerHTML = '';
    participantsDbEmpty.style.display = 'block';
    participantsDbEmpty.textContent = 'Невозможно загрузить БД: отсутствует Discord ID.';
    return;
  }

  let list = [];
  try {
    const payload = await apiGetParticipants(state.discordUser.id);
    list = Array.isArray(payload.participants) ? payload.participants : [];
  } catch (error) {
    participantsDbBody.innerHTML = '';
    participantsDbEmpty.style.display = 'block';
    participantsDbEmpty.textContent = 'Ошибка загрузки БД с сервера.';
    return;
  }

  if (!list.length) {
    participantsDbBody.innerHTML = '';
    participantsDbEmpty.style.display = 'block';
    participantsDbEmpty.textContent = 'В БД пока нет участников.';
    return;
  }

  const rows = list
    .map((entry) => {
      const signedAtText = entry.signedAt
        ? new Date(entry.signedAt).toLocaleString()
        : '-';
      return `
        <tr>
          <td>${escapeHtml(entry.name || 'Unknown')}</td>
          <td>${escapeHtml(entry.id || '-')}</td>
          <td>${escapeHtml(signedAtText)}</td>
        </tr>
      `;
    })
    .join('');

  participantsDbBody.innerHTML = rows;
  participantsDbEmpty.style.display = 'none';
}

function isCurrentUserDbAllowed() {
  return !!(state.discordVerified && state.discordUser?.id && DB_ACCESS_ALLOWED_IDS.has(state.discordUser.id));
}

function updateDbAccessUi() {
  if (!openDbButton || !dbAccessState) {
    return;
  }

  if (!state.discordVerified || !state.discordUser?.id) {
    openDbButton.disabled = true;
    dbAccessState.textContent = 'Доступ к БД: требуется верификация Discord';
    return;
  }

  if (isCurrentUserDbAllowed()) {
    openDbButton.disabled = false;
    dbAccessState.textContent = 'Доступ к БД: разрешен';
    return;
  }

  openDbButton.disabled = true;
  dbAccessState.textContent = 'Доступ к БД: отказано для вашего Discord ID';
}

async function updateContractUi() {
  if (!signContractButton || !contractState) {
    return;
  }

  if (!state.discordVerified || !state.discordUser?.id) {
    signContractButton.disabled = true;
    contractState.textContent = 'Для подписания требуется верификация Discord';
    return;
  }

  signContractButton.disabled = true;
  contractState.textContent = 'Проверка статуса контракта...';

  try {
    const payload = await apiGetParticipant(state.discordUser.id);
    const signed = !!payload.exists;
    signContractButton.disabled = signed;
    contractState.innerHTML = signed
      ? `Контракт уже подписан: ${getParticipantName(state.discordUser)} (${state.discordUser.id})<br><a href="https://forms.gle/s7c6ab9mLWh6R6Go7" target="_blank" rel="noopener noreferrer">Подтвердить допуск</a>`
      : 'Контракт не подписан';
  } catch (error) {
    signContractButton.disabled = false;
    contractState.textContent = 'Ошибка связи с сервером БД';
  }
}

function hideParticipantsDbPanel() {
  if (participantsDbPanel) {
    participantsDbPanel.classList.add('hidden');
  }
}

function activateTab(target) {
  tabs.forEach((tab) => {
    const active = tab.dataset.tab === target;
    tab.classList.toggle('active', active);
  });

  panels.forEach((panel) => {
    const active = panel.dataset.panel === target;
    panel.classList.toggle('active', active);
  });
}

function updateArchiveAccess() {
  const canOpenArchive = state.passwordUnlocked && state.discordVerified;
  archiveTab.disabled = !canOpenArchive;
  openArchiveButton.disabled = !canOpenArchive;
}

function updateBriefingUser() {
  if (!briefingUser) {
    return;
  }

  if (!state.discordUser) {
    briefingUser.textContent = 'Briefing | User: '; 
    return;
  }

  const name = getParticipantName(state.discordUser);
  briefingUser.textContent = `Briefing | User: ${name} (${state.discordUser.id})`;
}

function getOAuthToken() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const queryParams = new URLSearchParams(window.location.search);

  const hashToken = hashParams.get('access_token');
  if (hashToken) {
    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
    return hashToken;
  }

  return queryParams.get('token') || queryParams.get('access_token');
}

function hasOAuthCode() {
  const queryParams = new URLSearchParams(window.location.search);
  return queryParams.has('code');
}

function buildDiscordOAuthUrl() {
  const clientId = discordButton?.dataset?.clientId;
  if (!clientId) {
    return null;
  }

  const redirectUri = `${window.location.origin}${window.location.pathname}`;
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'token',
    redirect_uri: redirectUri,
    scope: 'identify',
  });

  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

async function fetchDiscordUser(token) {
  const response = await fetch('https://discord.com/api/users/@me', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Discord profile request failed');
  }

  return response.json();
}

async function verifyDiscordFromToken() {
  if (hasOAuthCode()) {
    authState.textContent = 'Received code. Use response_type=token or add backend code exchange.';
    return;
  }

  const token = getOAuthToken();
  if (!token) {
    return;
  }

  authState.textContent = 'Verifying Discord token...';

  try {
    const user = await fetchDiscordUser(token);
    state.discordVerified = true;
    state.discordUser = user;
    authState.textContent = `Discord verified: ${user.username} (${user.id})`;
    updateBriefingUser();
    updateArchiveAccess();
    await updateContractUi();
    updateDbAccessUi();
  } catch (error) {
    state.discordVerified = false;
    state.discordUser = null;
    authState.textContent = 'Discord verification failed';
    updateBriefingUser();
    updateArchiveAccess();
    updateContractUi();
    updateDbAccessUi();
    hideParticipantsDbPanel();
  }
}

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;

    if (tab.disabled && target === 'archive') {
      return;
    }

    activateTab(target);

    if (target === 'archive') {
      updateContractUi();
      updateDbAccessUi();
    }
  });
});

passwordForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const value = passwordInput.value.trim();

  if (value === PASSWORD) {
    state.passwordUnlocked = true;
    status.textContent = 'Access granted';
    status.className = 'status success';
    oauthBlock.classList.add('visible');
    passwordInput.value = '';
    updateArchiveAccess();
  } else {
    state.passwordUnlocked = false;
    status.textContent = 'Incorrect code';
    status.className = 'status error';
    oauthBlock.classList.remove('visible');
    hideParticipantsDbPanel();
    authState.textContent = state.discordVerified
      ? `Discord verified: ${state.discordUser?.username || 'Unknown'} (${state.discordUser?.id || '-'})`
      : 'Awaiting verification';
    updateArchiveAccess();
    passwordInput.focus();
  }
});

discordButton.addEventListener('click', () => {
  if (!state.passwordUnlocked) {
    return;
  }

  const oauthUrl = buildDiscordOAuthUrl();
  if (!oauthUrl) {
    authState.textContent = 'OAuth client id is missing';
    return;
  }

  window.location.href = oauthUrl;
});

openArchiveButton.addEventListener('click', () => {
  if (!state.passwordUnlocked || !state.discordVerified) {
    return;
  }

  activateTab('archive');
  updateContractUi();
  updateDbAccessUi();
});

signContractButton?.addEventListener('click', async () => {
  if (!state.passwordUnlocked || !state.discordVerified) {
    return;
  }

  const participant = getCurrentParticipant();
  if (!participant) {
    return;
  }

  signContractButton.disabled = true;
  contractState.textContent = 'Подписание контракта...';

  try {
    await apiSignContract(participant);
    contractState.innerHTML = `Контракт подписан: ${participant.name} (${participant.id})<br><a href="https://forms.gle/s7c6ab9mLWh6R6Go7" target="_blank" rel="noopener noreferrer">Подтвердить допуск</a>`;
    signContractButton.disabled = true;
    if (!participantsDbPanel?.classList.contains('hidden')) {
      await renderParticipantsDb();
    }
  } catch (error) {
    signContractButton.disabled = false;
    contractState.textContent = `Не удалось подписать контракт на сервере: ${error.message}`;
  }
});

openDbButton?.addEventListener('click', async () => {
  if (!isCurrentUserDbAllowed()) {
    dbAccessState.textContent = 'Доступ к БД: отказано для вашего Discord ID';
    hideParticipantsDbPanel();
    return;
  }

  await renderParticipantsDb();
  participantsDbPanel?.classList.remove('hidden');
});

updateBriefingUser();
updateArchiveAccess();
updateContractUi();
updateDbAccessUi();
verifyDiscordFromToken();