const $ = selector => document.querySelector(selector);
const topics = [
  ['Technology', '✦'], ['Climate', '❋'], ['Science', '◎'], ['Health', '♡'],
  ['Business', '↗'], ['Sports', '⚑'], ['Culture', '◈'],
];
const topicDescriptions = {
  Technology: 'Artificial intelligence, computing, software and new technology',
  Climate: 'Climate change, renewable energy, sustainability and nature conservation',
  Science: 'Scientific discovery, space exploration, astronomy and materials research',
  Health: 'Health, wellbeing, sleep and access to healthcare',
  Business: 'Business, finance, entrepreneurship and the economy',
  Sports: 'Sports, football, cricket, running and athletic performance',
  Culture: 'Arts, cinema, history, language and cultural communities',
};
const storageKey = 'current.profile.v1';
let stored = {};
try { stored = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch { /* A fresh profile is safe if storage is unavailable. */ }
let selectedTopics = new Set(Array.isArray(stored.topics) ? stored.topics.filter(t => t in topicDescriptions) : []);
let liked = new Set(Array.isArray(stored.liked) ? stored.liked.filter(id => typeof id === 'string') : []);
let saved = new Set(Array.isArray(stored.saved) ? stored.saved.filter(id => typeof id === 'string') : []);
let allArticles = [];
let recommendation = null;
let view = 'feed';
let category = 'All';
let modelReady = false;
let modelFailed = false;
let requestId = 0;
let toastTimer;
let appliedInterests = [];
let appliedLiked = [];
$('#interest-text').value = typeof stored.text === 'string' ? stored.text.slice(0, 300) : '';

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ topics: [...selectedTopics], text: $('#interest-text').value, liked: [...liked], saved: [...saved] }));
  } catch { toast('Browser storage is unavailable. Changes will last for this session.'); }
}

function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message;
  $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3500);
}

function notice(message = '') {
  $('#notice').textContent = message;
  $('#notice').hidden = !message;
}

function setBusy(busy) {
  $('#article-grid').setAttribute('aria-busy', String(busy));
  document.querySelectorAll('.category-button, #result-limit').forEach(control => { control.disabled = busy; });
  $('#compare-button').disabled = busy || !recommendation;
}

function renderTopics() {
  $('#topic-chips').innerHTML = topics.map(([name, icon]) => `<button class="topic-chip ${selectedTopics.has(name) ? 'selected' : ''}" data-topic="${name}" aria-pressed="${selectedTopics.has(name)}"><span aria-hidden="true">${icon}</span>${name}</button>`).join('');
}

function getInterests() {
  const interests = [...selectedTopics].map(topic => topicDescriptions[topic]);
  const text = $('#interest-text').value.trim();
  if (text) interests.push(text);
  return interests;
}

function renderCategories() {
  $('#categories').innerHTML = ['All', ...topics.map(([name]) => name)].map(name => `<button class="category-button ${category === name ? 'active' : ''}" data-category="${name}" aria-pressed="${category === name}">${name}</button>`).join('');
}

const bookmark = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';
const heart = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg>';

function art(type) {
  const drawings = {
    Technology: '<g class="art-stroke" stroke-width="1"><ellipse cx="190" cy="70" rx="73" ry="30" transform="rotate(-28 190 70)"/><ellipse cx="190" cy="70" rx="73" ry="30" transform="rotate(28 190 70)"/><ellipse cx="190" cy="70" rx="73" ry="30" transform="rotate(90 190 70)"/><circle cx="190" cy="70" r="12"/><path d="M0 110H380M0 115H380" opacity=".18"/></g><circle class="art-fill" cx="190" cy="70" r="6" opacity=".6"/>',
    Climate: '<g class="art-stroke" stroke-width="1.2"><path d="M180 121V46M180 83C145 81 128 55 131 30C168 31 185 54 180 83ZM182 99C213 98 235 77 238 49C205 49 181 69 182 99Z"/><path d="M144 44L180 83M225 64L182 99"/><circle cx="185" cy="76" r="58" stroke-dasharray="2 6" opacity=".6"/></g>',
    Science: '<g class="art-stroke" stroke-width="1"><circle cx="191" cy="69" r="40"/><ellipse cx="191" cy="69" rx="90" ry="18" transform="rotate(-20 191 69)"/><circle cx="191" cy="69" r="54" stroke-dasharray="1 8"/><path d="M88 36h8M92 32v8M278 96h8M282 92v8"/></g><circle class="art-fill" cx="254" cy="31" r="3"/><circle class="art-fill" cx="127" cy="106" r="2"/>',
    Health: '<g class="art-stroke" stroke-width="1.2"><path d="M0 83h119l16-16 18 31 26-61 24 61 17-29 14 14h146"/><circle cx="191" cy="72" r="49" opacity=".3"/><circle cx="191" cy="72" r="61" opacity=".2"/></g>',
    Business: '<g class="art-stroke" stroke-width="1.1"><path d="M107 103h164M127 102V76h23v26M166 102V58h23v44M205 102V33h23v69M112 56l43-20 32 7 66-25M240 18h13v13"/><path d="M108 113h164" opacity=".4"/></g>',
    Sports: '<g class="art-stroke" stroke-width="1.1"><ellipse cx="190" cy="71" rx="95" ry="45"/><ellipse cx="190" cy="71" rx="81" ry="35"/><ellipse cx="190" cy="71" rx="66" ry="25"/><path d="M120 101l20-16M132 110l22-19M190 26v20"/></g><circle class="art-fill" cx="246" cy="47" r="5"/>',
    Culture: '<g class="art-stroke" stroke-width="1.1"><path d="M133 109V56a57 57 0 0 1 114 0v53M150 109V57a40 40 0 0 1 80 0v52M166 109V58a24 24 0 0 1 48 0v51M116 111h149"/><path d="M116 118h149" opacity=".4"/></g>',
  };
  return `<svg viewBox="0 0 380 140" aria-hidden="true">${drawings[type] || drawings.Technology}</svg>`;
}

function card(article) {
  const ranked = typeof article.score === 'number';
  const explanation = ranked
    ? `${article.interestSimilarity < 0.25 ? 'Closest available interest' : 'Connected to'}: ${article.matchedInterest}`
    : article.tags.slice(0, 2).join(' · ');
  return `<article class="article-card tone-${article.category.toLowerCase()}">
    <div class="card-art">${art(article.category)}<span class="card-art-label">${article.category.toUpperCase()} / IDEAS IN FOCUS</span><button class="bookmark-button ${saved.has(article.id) ? 'saved' : ''}" data-save="${article.id}" aria-pressed="${saved.has(article.id)}" aria-label="${saved.has(article.id) ? 'Unsave' : 'Save'}: ${escapeHtml(article.title)}">${bookmark}</button></div>
    <div class="card-content"><div class="card-meta"><span>${article.category}</span>${ranked ? `<span class="similarity" title="Cosine similarity, not a probability">↗ ${article.score.toFixed(3)} similarity</span>` : '<span>Sample story</span>'}</div>
    <button class="card-title" data-read="${article.id}">${escapeHtml(article.title)}</button><p class="card-summary">${escapeHtml(article.summary)}</p>
    <div class="match-reason"><span aria-hidden="true">✳</span><span>${escapeHtml(explanation)}</span></div><div class="card-bottom"><span>Current collection · ${article.readMinutes} min read</span><button class="like-button ${liked.has(article.id) ? 'liked' : ''}" data-like="${article.id}" aria-pressed="${liked.has(article.id)}" aria-label="${liked.has(article.id) ? 'Unlike' : 'Like'}: ${escapeHtml(article.title)}">${heart}${liked.has(article.id) ? 'Liked' : 'Like'}</button></div></div></article>`;
}

function renderFeed() {
  const savedCount = saved.size;
  $('#saved-count').textContent = savedCount;
  $('#feedback-note').textContent = liked.size ? `${liked.size} liked ${liked.size === 1 ? 'story shapes' : 'stories shape'} your recommendations.` : 'Like a story to help shape your feed.';
  const headings = {
    feed: ['YOUR DAILY DISCOVERY', 'Curated around you', recommendation ? 'A reading list shaped by the meaning behind your interests.' : 'Start with a few interests to find stories that resonate.'],
    explore: ['ROOM FOR CURIOSITY', 'A wider perspective', 'Explore the entire sample collection. Like a story to shape your recommendations.'],
    saved: ['WORTH COMING BACK TO', 'Your reading list', 'A quiet corner for the stories you want to keep.'],
  };
  const [kicker, title, description] = headings[view];
  $('#feed-kicker').textContent = kicker;
  $('#feed-heading').innerHTML = `${title}<span class="green-period">.</span>`;
  $('#feed-description').textContent = description;
  $('#compare-button').disabled = !recommendation;
  $('#compare-button').hidden = view !== 'feed';
  const hasProfile = getInterests().length || liked.size;
  $('#personalize').disabled = !modelReady;
  $('#personalize').innerHTML = `${modelReady ? (recommendation ? 'Refresh my feed' : 'Build my feed') : modelFailed ? 'Model unavailable' : 'Model loading…'} <span aria-hidden="true">→</span>`;
  let list;
  if (view === 'feed') list = recommendation?.articles || [];
  else list = allArticles.filter(article => (view !== 'saved' || saved.has(article.id)) && (category === 'All' || category === article.category));
  if (view !== 'feed') list = list.slice(0, Number($('#result-limit').value));
  $('#article-grid').innerHTML = list.map(card).join('');
  $('#empty-state').hidden = list.length > 0;
  if (list.length) {
    $('#results-meta').textContent = `${list.length} ${list.length === 1 ? 'story' : 'stories'} · ${view === 'feed' ? 'Ordered by semantic similarity' : view === 'saved' ? 'Saved in this browser' : 'Explore at your own pace'}`;
  } else {
    $('#results-meta').textContent = '';
    let title = 'Follow your curiosity.';
    let text = modelReady ? 'Choose a topic or describe an interest, then build your personalized feed.' : 'The semantic model is preparing. You can browse sample stories in Explore while you wait.';
    if (view === 'saved') { title = 'A space for good stories.'; text = category === 'All' ? 'Tap the bookmark on any story to save it here.' : 'No saved stories in this category. Try another category.'; }
    else if (view === 'explore' || recommendation) { title = 'Nothing here just yet.'; text = 'Try another category to discover more stories.'; }
    else if (hasProfile && modelReady) { text = 'Your interests are ready. Build your feed to discover related stories.'; }
    if (modelFailed && view === 'feed') { title = 'The model needs a moment.'; text = 'The embedding model could not load. Check the server terminal and restart. Explore and saved stories are still available.'; }
    $('#empty-state').innerHTML = `<div class="empty-icon" aria-hidden="true">✳</div><h3>${title}</h3><p>${text}</p>`;
  }
}

async function buildFeed({ useApplied = false } = {}) {
  if (!modelReady) return;
  const interests = useApplied ? appliedInterests : getInterests();
  if (!interests.length && !liked.size) {
    recommendation = null;
    appliedInterests = [];
    appliedLiked = [];
    renderFeed();
    notice('Choose at least one topic, describe an interest, or like a story in Explore.');
    return;
  }
  const currentRequest = ++requestId;
  notice();
  persist();
  $('#personalize').disabled = true;
  $('#personalize').textContent = 'Finding your connections…';
  setBusy(true);
  $('#article-grid').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div>';
  $('#empty-state').hidden = true;
  $('#results-meta').textContent = 'Comparing the meaning of your interests with the collection…';
  const requestLiked = [...liked];
  try {
    const response = await fetch('/api/recommend', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ interests, likedIds: requestLiked, category, limit: Number($('#result-limit').value) }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Unable to build your feed.');
    if (currentRequest !== requestId) return;
    recommendation = result;
    appliedInterests = interests;
    appliedLiked = requestLiked;
    renderFeed();
  } catch (error) {
    if (currentRequest !== requestId) return;
    recommendation = null;
    renderFeed();
    notice(error.message || 'Connection lost. Check that the local server is running.');
  } finally {
    if (currentRequest === requestId) setBusy(false);
  }
}

function switchView(next) {
  requestId++;
  setBusy(false);
  view = next;
  category = 'All';
  notice();
  document.querySelectorAll('[data-view]').forEach(button => {
    const active = button.dataset.view === view;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
  });
  renderCategories();
  renderFeed();
  if (view === 'feed' && recommendation) buildFeed({ useApplied: true });
}

function readArticle(id) {
  const article = allArticles.find(item => item.id === id);
  if (!article) return;
  $('#article-content').innerHTML = `<span class="small muted">${article.category} · ${article.readMinutes} min read · Illustrative sample</span><h2 id="article-title">${escapeHtml(article.title)}</h2><p class="dialog-lead">${escapeHtml(article.summary)}</p><div class="article-body">${article.body.split('\n\n').map(paragraph => `<p>${escapeHtml(paragraph)}</p>`).join('')}</div><div class="article-tags">${article.tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div><div class="explanation-box small">This original sample article is part of the project’s demonstration dataset, not live news reporting.</div>`;
  $('#article-dialog').showModal();
}

function showComparison() {
  if (!recommendation) return;
  const list = (articles, semantic) => `<ol>${articles.slice(0, 5).map(article => `<li><div>${escapeHtml(article.title)}<small>${semantic ? `${article.score.toFixed(3)} cosine similarity` : `${Math.round(article.keywordScore * 100)}% query-term overlap`}</small></div></li>`).join('')}</ol>`;
  $('#comparison-content').innerHTML = `<div class="comparison-query"><b>Applied interests:</b> ${escapeHtml(appliedInterests.join(' · ') || 'Liked stories only')}<br><span>${appliedLiked.length} liked stories · ${escapeHtml(category)} categories</span></div><div class="comparison-grid"><section><h3>Semantic meaning</h3>${list(recommendation.articles, true)}</section><section><h3>Keyword overlap</h3>${list(recommendation.keywordArticles, false)}</section></div>`;
  $('#compare-dialog').showModal();
}

document.addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.topic) {
    const topic = button.dataset.topic;
    selectedTopics.has(topic) ? selectedTopics.delete(topic) : selectedTopics.add(topic);
    renderTopics(); persist();
    if (recommendation) notice('Your interests changed. Select “Refresh my feed” to apply them.');
  }
  if (button.dataset.view) switchView(button.dataset.view);
  if (button.dataset.category) {
    category = button.dataset.category;
    renderCategories();
    if (view === 'feed' && recommendation) buildFeed({ useApplied: true }); else renderFeed();
  }
  if (button.dataset.save) {
    const id = button.dataset.save;
    saved.has(id) ? saved.delete(id) : saved.add(id);
    persist(); renderFeed(); toast(saved.has(id) ? 'Added to your reading list.' : 'Removed from your reading list.');
  }
  if (button.dataset.like) {
    const id = button.dataset.like;
    liked.has(id) ? liked.delete(id) : liked.add(id);
    persist(); renderFeed();
    toast(liked.has(id) ? 'Liked. Your next feed will include this signal.' : 'Like removed.');
    if (view === 'feed' && recommendation) buildFeed({ useApplied: true });
  }
  if (button.dataset.read) readArticle(button.dataset.read);
  if (button.dataset.close) $(`#${button.dataset.close}`).close();
});

$('#interest-text').addEventListener('input', () => {
  persist();
  if (recommendation) notice('Your interests changed. Select “Refresh my feed” to apply them.');
});
$('#personalize').addEventListener('click', () => {
  if (view !== 'feed') { recommendation = null; switchView('feed'); }
  buildFeed();
});
$('#result-limit').addEventListener('change', () => view === 'feed' && recommendation ? buildFeed({ useApplied: true }) : renderFeed());
$('#how-button').addEventListener('click', () => $('#how-dialog').showModal());
$('#how-footer').addEventListener('click', () => $('#how-dialog').showModal());
$('#compare-button').addEventListener('click', showComparison);
$('#reset-profile').addEventListener('click', () => {
  requestId++;
  selectedTopics.clear(); liked.clear(); $('#interest-text').value = '';
  recommendation = null; appliedInterests = []; appliedLiked = [];
  persist(); renderTopics(); switchView('feed'); toast('Interests and likes reset. Saved stories are still here.');
});

async function checkModel() {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) throw new Error('Unable to reach the server.');
    const health = await response.json();
    modelReady = health.status === 'ready';
    modelFailed = health.status === 'error';
    $('#status-dot').className = `status-dot ${modelReady ? '' : modelFailed ? 'error' : 'loading'}`;
    $('#model-status').textContent = modelReady ? 'Semantic engine ready' : modelFailed ? 'Model unavailable' : 'Preparing semantic engine';
    $('#model-detail').textContent = modelReady ? 'MiniLM embeddings · Runs on your computer. No API key needed.' : health.message;
    renderFeed();
    if (modelReady && (getInterests().length || liked.size) && view === 'feed') await buildFeed();
    if (!modelReady && !modelFailed) setTimeout(checkModel, 2500);
  } catch {
    $('#model-status').textContent = 'Server disconnected';
    $('#model-detail').textContent = 'Start the local server with npm start. Reconnecting shortly…';
    setTimeout(checkModel, 5000);
  }
}

async function initialize() {
  renderTopics(); renderCategories(); renderFeed();
  try {
    const response = await fetch('/api/articles');
    if (!response.ok) throw new Error('Could not load the article collection.');
    const data = await response.json();
    allArticles = data.articles;
    const ids = new Set(allArticles.map(a => a.id));
    liked = new Set([...liked].filter(id => ids.has(id)));
    saved = new Set([...saved].filter(id => ids.has(id)));
    renderFeed();
    await checkModel();
  } catch (error) { notice(`${error.message} Refresh this page after the server is running.`); }
}

initialize();
