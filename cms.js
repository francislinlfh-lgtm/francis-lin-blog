// cms.js — loads Firestore posts into the public blog (home feed + post page).
// Requires firebase-config.js first (db global). Single-author blog.

(function () {
  'use strict';

  var AUTHOR = 'Francis Lin';

  // ── Utilities ────────────────────────────────────────────────────────────────
  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safeUrl(u) {
    var s = String(u == null ? '' : u).trim();
    return /^https?:\/\//i.test(s) ? s : '';
  }
  function toMs(d) {
    var t = d && d.toDate ? d.toDate() : new Date(d || 0);
    return t.getTime ? t.getTime() : 0;
  }
  function formatDate(d) {
    if (!d) return '';
    var t = d.toDate ? d.toDate() : new Date(d);
    return t.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }
  function reveal() { document.body.style.opacity = '1'; }

  // ── localStorage cache (instant paint for repeat visits) ─────────────────────
  var CACHE_KEY = 'fl_posts_v1';
  var CACHE_TTL = 3600000; // 1 hour
  function cacheRead() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (Date.now() - p.ts > CACHE_TTL) return null;
      return p.data;
    } catch (_) { return null; }
  }
  function cacheWrite(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data })); } catch (_) {}
  }

  // ── HOME FEED ────────────────────────────────────────────────────────────────
  function leadHtml(a) {
    var img = safeUrl(a.imageUrl);
    var media = img
      ? '<div class="lead-media"><img src="' + esc(img) + '" alt="' + esc(a.imageCaption || a.title || '') + '" /></div>'
      : '';
    return '<a class="lead' + (img ? '' : ' lead-noimg') + '" href="article.html?id=' + encodeURIComponent(a.id) + '">'
      + media
      + '<div class="lead-text">'
      + '<div class="lead-kicker">Latest</div>'
      + '<h2 class="lead-title">' + esc(a.title || 'Untitled') + '</h2>'
      + (a.standfirst ? '<p class="lead-summary">' + esc(a.standfirst) + '</p>' : '')
      + '<div class="lead-meta">' + AUTHOR + ' &nbsp;·&nbsp; ' + esc(formatDate(a.date)) + '</div>'
      + '</div></a>';
  }

  function cardHtml(a) {
    var img = safeUrl(a.imageUrl);
    var media = img
      ? '<div class="post-card-media"><img src="' + esc(img) + '" alt="' + esc(a.imageCaption || a.title || '') + '" loading="lazy" /></div>'
      : '';
    return '<a class="post-card' + (img ? '' : ' post-card-noimg') + '" href="article.html?id=' + encodeURIComponent(a.id) + '">'
      + media
      + '<h3 class="post-card-title">' + esc(a.title || 'Untitled') + '</h3>'
      + (a.standfirst ? '<p class="post-card-summary">' + esc(a.standfirst) + '</p>' : '')
      + '<div class="post-card-meta">' + esc(formatDate(a.date)) + '</div>'
      + '</a>';
  }

  function renderFeed(posts) {
    var leadEl = document.getElementById('lead-post');
    var feedEl = document.getElementById('post-feed');
    var emptyEl = document.getElementById('feed-empty');
    if (!leadEl || !feedEl) return;

    if (!posts.length) {
      leadEl.innerHTML = '';
      feedEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = '';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    var sorted = posts.slice().sort(function (x, y) { return toMs(y.date) - toMs(x.date); });
    leadEl.innerHTML = leadHtml(sorted[0]);
    feedEl.innerHTML = sorted.slice(1).map(cardHtml).join('');
    leadEl.classList.remove('feed-hidden');
    feedEl.classList.remove('feed-hidden');
  }

  function loadHomeFeed() {
    var leadEl = document.getElementById('lead-post');
    if (!leadEl) return Promise.resolve();

    var cached = cacheRead();
    if (cached && cached.length) renderFeed(cached);

    // No orderBy → no composite index needed; sort client-side.
    return db.collection('articles').where('published', '==', true).get()
      .then(function (snap) {
        var posts = snap.docs.map(function (d) {
          var a = d.data();
          return {
            id: d.id,
            title: a.title || '',
            standfirst: a.standfirst || '',
            imageUrl: a.imageUrl || '',
            imageCaption: a.imageCaption || '',
            date: a.date || null
          };
        });
        renderFeed(posts);
        cacheWrite(posts);
      })
      .catch(function (e) {
        if (!cached) renderFeed([]);
        console.warn('cms: loadHomeFeed error', e);
      });
  }

  // ── POST PAGE ────────────────────────────────────────────────────────────────
  function loadArticlePage() {
    var params  = new URLSearchParams(window.location.search);
    var id      = params.get('id');
    var preview = params.get('preview') === '1';
    var headerSlot = document.getElementById('article-header-content');
    var bodySlot   = document.getElementById('article-body-content');

    function fail(msg) {
      if (headerSlot) headerSlot.innerHTML = '<p class="post-error">' + esc(msg) + '</p>';
    }

    if (!id) { fail('No post specified.'); return Promise.resolve(); }

    return db.collection('articles').doc(id).get().then(function (doc) {
      if (!doc.exists) { fail('Post not found.'); return; }
      var a = doc.data();

      if (!a.published && !preview) { fail('This post is not published yet.'); return; }

      if (preview && !a.published) {
        var banner = document.createElement('div');
        banner.className = 'preview-banner';
        banner.textContent = '⚠ Preview — this post is not published yet and is only visible via this link.';
        document.body.prepend(banner);
      }

      document.title = (a.title || 'Post') + ' — ' + AUTHOR;

      if (headerSlot) {
        var img = safeUrl(a.imageUrl);
        var views = typeof a.views === 'number' ? a.views : 0;
        var viewStr = a.published ? ' &nbsp;·&nbsp; ' + views.toLocaleString() + (views === 1 ? ' view' : ' views') : '';
        headerSlot.innerHTML =
          '<h1 class="post-title" id="article-headline">' + esc(a.title || 'Untitled') + '</h1>'
          + (a.standfirst ? '<p class="post-standfirst">' + esc(a.standfirst) + '</p>' : '')
          + '<div class="post-byline">' + AUTHOR
            + (a.date ? ' &nbsp;·&nbsp; ' + esc(formatDate(a.date)) : '')
            + viewStr + '</div>'
          + (img
              ? '<figure class="post-cover"><img src="' + esc(img) + '" alt="' + esc(a.imageCaption || '') + '" />'
                + (a.imageCaption ? '<figcaption>' + esc(a.imageCaption) + '</figcaption>' : '')
                + '</figure>'
              : '');
      }

      if (bodySlot) bodySlot.innerHTML = '<article class="post-body">' + (a.body || '') + '</article>';

      if (!preview) {
        db.collection('articles').doc(id).update({
          views: firebase.firestore.FieldValue.increment(1)
        }).catch(function () {});
      }

      loadReadNext(id);
    }).catch(function (e) {
      fail('Error loading post.');
      console.warn('cms: loadArticlePage error', e);
    });
  }

  // "Read next" — most recent posts, excluding the current one.
  function loadReadNext(currentId) {
    var slot = document.getElementById('read-next');
    if (!slot) return;
    db.collection('articles').where('published', '==', true).limit(12).get()
      .then(function (snap) {
        var others = snap.docs
          .filter(function (d) { return d.id !== currentId; })
          .map(function (d) { return { id: d.id, a: d.data() }; })
          .sort(function (x, y) { return toMs(y.a.date) - toMs(x.a.date); })
          .slice(0, 3);
        if (!others.length) { slot.closest('.read-next-wrap') && (slot.closest('.read-next-wrap').style.display = 'none'); return; }
        slot.innerHTML = others.map(function (o) {
          return '<a class="read-next-item" href="article.html?id=' + encodeURIComponent(o.id) + '">'
            + '<span class="read-next-title">' + esc(o.a.title || 'Untitled') + '</span>'
            + '<span class="read-next-date">' + esc(formatDate(o.a.date)) + '</span></a>';
        }).join('');
      })
      .catch(function () {});
  }

  // ── ROUTER ───────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.dataset.page;
    var maxWait = new Promise(function (r) { setTimeout(r, 3000); });
    var loads = page === 'article' ? loadArticlePage()
              : page === 'index'   ? loadHomeFeed()
              : Promise.resolve();
    Promise.race([loads, maxWait]).finally(reveal);
  });

})();
