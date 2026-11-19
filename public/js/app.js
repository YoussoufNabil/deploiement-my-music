const state = { music: [], currentIndex: -1, user: null };
const $ = selector => document.querySelector(selector);
const audio = $('#audio-player');

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  const data = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  window.setTimeout(() => node.classList.remove('show'), 2600);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function updateAccount() {
  $('#user-label').textContent = state.user ? `Bonjour, ${state.user.name}` : 'Bienvenue';
  $('#auth-open').classList.toggle('hidden', Boolean(state.user));
  $('#logout-button').classList.toggle('hidden', !state.user);
}

async function loadUser() {
  try {
    const data = await api('/api/auth/me');
    state.user = data.user;
  } catch (_error) {
    state.user = null;
  }
  updateAccount();
}

async function loadMusic(query = '') {
  const container = $('#track-list');
  container.innerHTML = '<div class="empty-state"><span class="loader"></span><p>Chargement du catalogue…</p></div>';
  try {
    const data = await api(`/api/musiques${query ? `?q=${encodeURIComponent(query)}` : ''}`);
    state.music = data.music || [];
    $('#track-count').textContent = `${state.music.length} titre${state.music.length > 1 ? 's' : ''}`;
    renderMusic();
  } catch (error) {
    container.innerHTML = `<div class="empty-state"><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function renderMusic() {
  const container = $('#track-list');
  if (!state.music.length) {
    container.innerHTML = '<div class="empty-state"><p>Aucun titre trouvé.</p><small>Connecte-toi pour ajouter un morceau.</small></div>';
    return;
  }
  container.innerHTML = state.music.map((track, index) => `
    <article class="track-card">
      <div class="track-art">${track.cover_url ? `<img src="${escapeHtml(track.cover_url)}" alt="Pochette de ${escapeHtml(track.titre)}">` : '♫'}</div>
      <div class="track-meta">
        <h3>${escapeHtml(track.titre)}</h3>
        <p>${escapeHtml(track.artiste)}</p>
        <div class="track-tags"><small>${escapeHtml(track.genre || 'Musique')}</small><div class="track-actions">
          <button class="icon-button" data-like="${track.id}" title="J'aime" aria-label="J'aime">♡</button>
          <button class="icon-button play-track" data-play="${index}" title="Écouter" aria-label="Écouter">▶</button>
        </div></div>
      </div>
    </article>`).join('');
}

async function playTrack(index) {
  const track = state.music[index];
  if (!track) return;
  try {
    const data = await api(`/api/musiques/${track.id}/stream`);
    audio.src = data.url;
    await audio.play();
    state.currentIndex = index;
    $('#player-title').textContent = track.titre;
    $('#player-artist').textContent = track.artiste;
    $('#player-cover').innerHTML = track.cover_url ? `<img src="${escapeHtml(track.cover_url)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:9px">` : '♫';
    $('#play-button').textContent = 'Ⅱ';
    $('#play-button').setAttribute('aria-label', 'Pause');
  } catch (error) {
    toast(error.message || 'Lecture impossible.');
  }
}

$('#track-list').addEventListener('click', async event => {
  const playButton = event.target.closest('[data-play]');
  const likeButton = event.target.closest('[data-like]');
  if (playButton) return playTrack(Number(playButton.dataset.play));
  if (likeButton) {
    if (!state.user) { $('#auth-dialog').showModal(); return; }
    try {
      await api(`/api/musiques/${likeButton.dataset.like}/like`, { method: 'POST' });
      likeButton.textContent = '♥';
      toast('Ajouté à tes favoris.');
    } catch (error) { toast(error.message); }
  }
});

$('#search-input').addEventListener('input', event => {
  window.clearTimeout(window.searchTimer);
  window.searchTimer = window.setTimeout(() => loadMusic(event.target.value.trim()), 250);
});

$('#auth-open').addEventListener('click', () => $('#auth-dialog').showModal());
$('#upload-open').addEventListener('click', () => {
  if (!state.user) { $('#auth-dialog').showModal(); toast('Connecte-toi pour publier un morceau.'); return; }
  $('#upload-dialog').showModal();
});
$('#logout-button').addEventListener('click', async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch (_error) {}
  state.user = null; updateAccount(); toast('Déconnexion effectuée.');
});

document.querySelectorAll('[data-close]').forEach(button => {
  button.addEventListener('click', () => $(`#${button.dataset.close}`).close());
});

$('#switch-auth').addEventListener('click', () => {
  const register = $('#register-form');
  const showRegister = register.classList.contains('hidden');
  register.classList.toggle('hidden', !showRegister);
  $('#login-form').classList.toggle('hidden', showRegister);
  $('#auth-title').textContent = showRegister ? 'Créer un compte' : 'Connexion';
  $('#switch-text').textContent = showRegister ? 'Déjà membre ?' : 'Pas encore de compte ?';
  $('#switch-auth').textContent = showRegister ? 'Se connecter' : 'Créer un compte';
  $('#auth-message').textContent = '';
});

$('#login-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const data = await api('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) });
    state.user = data.user; updateAccount(); $('#auth-dialog').close(); event.currentTarget.reset(); toast('Connexion réussie.');
  } catch (error) { $('#auth-message').textContent = error.message; }
});

$('#register-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const data = await api('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) });
    state.user = data.user; updateAccount(); $('#auth-dialog').close(); event.currentTarget.reset(); toast('Compte créé. Bienvenue !');
  } catch (error) { $('#auth-message').textContent = error.message; }
});

$('#upload-form').addEventListener('submit', async event => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button[type="submit"]');
  button.disabled = true; button.textContent = 'Envoi…';
  try {
    await api('/api/musiques', { method: 'POST', body: new FormData(event.currentTarget) });
    $('#upload-dialog').close(); event.currentTarget.reset(); await loadMusic($('#search-input').value.trim()); toast('Morceau publié.');
  } catch (error) { $('#upload-message').textContent = error.message; }
  finally { button.disabled = false; button.textContent = 'Publier le morceau'; }
});

$('#play-button').addEventListener('click', async () => {
  if (!audio.src && state.music.length) return playTrack(0);
  if (audio.paused) { await audio.play().catch(() => {}); $('#play-button').textContent = 'Ⅱ'; }
  else { audio.pause(); $('#play-button').textContent = '▶'; }
});
$('#previous-button').addEventListener('click', () => playTrack(Math.max(0, state.currentIndex - 1)));
$('#next-button').addEventListener('click', () => playTrack(Math.min(state.music.length - 1, state.currentIndex + 1)));
audio.addEventListener('timeupdate', () => {
  const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
  $('#seek-bar').value = duration ? (audio.currentTime / duration) * 100 : 0;
  const minutes = Math.floor(audio.currentTime / 60);
  const seconds = String(Math.floor(audio.currentTime % 60)).padStart(2, '0');
  $('#time-label').textContent = `${minutes}:${seconds}`;
});
$('#seek-bar').addEventListener('input', event => {
  if (Number.isFinite(audio.duration)) audio.currentTime = (Number(event.target.value) / 100) * audio.duration;
});
audio.addEventListener('ended', () => { if (state.currentIndex < state.music.length - 1) playTrack(state.currentIndex + 1); else $('#play-button').textContent = '▶'; });

async function loadNews() {
  try {
    const data = await api('/api/news');
    if (!data.news?.length) return;
    $('#news-list').innerHTML = data.news.map(item => `<article class="news-card"><h3>${escapeHtml(item.titre)}</h3><p>${escapeHtml(item.contenu)}</p></article>`).join('');
  } catch (_error) { /* News are optional in the first version. */ }
}

(async function init() {
  await loadUser();
  await Promise.all([loadMusic(), loadNews()]);
})();
