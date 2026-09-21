// cms.js — static personal blog for "Francis Lin".
// Posts come from posts.js (window.POSTS). Firebase is optional and only used
// on the post page to count views; the blog renders fine without it.

(function () {
  'use strict';

  var AUTHOR = 'Francis Lin';
  var POSTS = (window.POSTS || []).slice();

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function formatDate(d) {
    if (!d) return '';
    var t = new Date(String(d).length <= 10 ? d + 'T00:00:00' : d);
    return isNaN(t) ? '' : t.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  function sorted() {
    return POSTS.slice().sort(function (a, b) { return String(b.date || '').localeCompare(String(a.date || '')); });
  }
  function byId(id) {
    for (var i = 0; i < POSTS.length; i++) if (POSTS[i].id === id) return POSTS[i];
    return null;
  }
  function reveal() { document.body.style.opacity = '1'; }

  // ── HOME FEED ────────────────────────────────────────────────────────────────
  function leadHtml(p) {
    return '<a class="lead lead-noimg" href="article.html?id=' + encodeURIComponent(p.id) + '">'
      + '<div class="lead-text">'
      + '<div class="lead-kicker">Latest</div>'
      + '<h2 class="lead-title">' + esc(p.title || 'Untitled') + '</h2>'
      + (p.summary ? '<p class="lead-summary">' + esc(p.summary) + '</p>' : '')
      + '<div class="lead-meta">' + AUTHOR + ' &nbsp;·&nbsp; ' + esc(formatDate(p.date)) + '</div>'
      + '</div></a>';
  }
  function cardHtml(p) {
    return '<a class="post-card post-card-noimg" href="article.html?id=' + encodeURIComponent(p.id) + '">'
      + '<h3 class="post-card-title">' + esc(p.title || 'Untitled') + '</h3>'
      + (p.summary ? '<p class="post-card-summary">' + esc(p.summary) + '</p>' : '')
      + '<div class="post-card-meta">' + esc(formatDate(p.date)) + '</div>'
      + '</a>';
  }
  function renderHome() {
    var leadEl = document.getElementById('lead-post');
    var feedEl = document.getElementById('post-feed');
    var emptyEl = document.getElementById('feed-empty');
    if (!leadEl || !feedEl) return;
    var ps = sorted();
    if (!ps.length) { if (emptyEl) emptyEl.style.display = ''; return; }
    if (emptyEl) emptyEl.style.display = 'none';
    leadEl.innerHTML = leadHtml(ps[0]);
    feedEl.innerHTML = ps.slice(1).map(cardHtml).join('');
    leadEl.classList.remove('feed-hidden');
    feedEl.classList.remove('feed-hidden');
  }

  // ── POST PAGE ────────────────────────────────────────────────────────────────
  function renderPost() {
    var id = new URLSearchParams(location.search).get('id');
    var headerSlot = document.getElementById('article-header-content');
    var bodySlot = document.getElementById('article-body-content');
    var p = byId(id);
    if (!p) { if (headerSlot) headerSlot.innerHTML = '<p class="post-error">Post not found.</p>'; return; }

    document.title = (p.title || 'Post') + ' — ' + AUTHOR;
    if (headerSlot) {
      headerSlot.innerHTML =
        '<h1 class="post-title">' + esc(p.title || 'Untitled') + '</h1>'
        + (p.summary ? '<p class="post-standfirst">' + esc(p.summary) + '</p>' : '')
        + '<div class="post-byline">' + AUTHOR
          + (p.date ? ' &nbsp;·&nbsp; ' + esc(formatDate(p.date)) : '')
          + '<span id="post-views"></span></div>';
    }
    if (bodySlot) bodySlot.innerHTML = '<article class="post-body">' + (p.body || '') + '</article>';

    countView(p.id);
    renderReadNext(p.id);
  }

  // Optional Firestore view counter — silent no-op if Firebase/rules absent.
  function countView(id) {
    if (typeof db === 'undefined' || !db) return;
    try {
      var ref = db.collection('postViews').doc(id);
      ref.get().then(function (s) {
        var n = (s.exists && typeof s.data().count === 'number') ? s.data().count : 0;
        var el = document.getElementById('post-views');
        var v = n + 1;
        if (el) el.textContent = '  ·  ' + v.toLocaleString() + (v === 1 ? ' view' : ' views');
      }).catch(function () {});
      ref.set({ count: firebase.firestore.FieldValue.increment(1) }, { merge: true }).catch(function () {});
    } catch (_) {}
  }

  function renderReadNext(id) {
    var slot = document.getElementById('read-next');
    if (!slot) return;
    var others = sorted().filter(function (p) { return p.id !== id; }).slice(0, 3);
    if (!others.length) {
      var wrap = slot.closest('.read-next-wrap');
      if (wrap) wrap.style.display = 'none';
      return;
    }
    slot.innerHTML = others.map(function (p) {
      return '<a class="read-next-item" href="article.html?id=' + encodeURIComponent(p.id) + '">'
        + '<span class="read-next-title">' + esc(p.title || 'Untitled') + '</span>'
        + '<span class="read-next-date">' + esc(formatDate(p.date)) + '</span></a>';
    }).join('');
  }

  // ── ROUTER ───────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.dataset.page;
    if (page === 'article') renderPost();
    else if (page === 'index') renderHome();
    reveal();
  });

})();
