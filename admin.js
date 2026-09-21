// admin.js — single-author blog admin for "Francis Lin".
// Requires firebase-config.js first (db, auth, storage globals) + Quill.

(function () {
  'use strict';

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function safeImg(u) {
    var s = String(u == null ? '' : u).trim();
    return /^https?:\/\//i.test(s) ? s : '';
  }
  function fmtDate(ts) {
    if (!ts) return '—';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg, type) {
    var el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'show' + (type ? ' toast-' + type : '');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.className = ''; }, 3500);
  }

  // ── State ─────────────────────────────────────────────────────────────────
  var currentUser = null;
  var quill = null;
  var editingId = null;
  var currentImageUrl = '';

  // ── Auth ──────────────────────────────────────────────────────────────────
  function showSignIn(msg) {
    document.body.style.display = '';
    var sv = document.getElementById('signin-view');
    var shell = document.getElementById('admin-shell');
    if (sv) sv.style.display = 'flex';
    if (shell) shell.style.display = 'none';
    var m = document.getElementById('signin-msg');
    if (m) m.textContent = msg || '';
  }

  function showAdmin(user) {
    currentUser = user;
    document.body.style.display = '';
    document.getElementById('signin-view').style.display = 'none';
    document.getElementById('admin-shell').style.display = 'flex';
    document.getElementById('sidebar-email').textContent = user.email;

    if (!quill) {
      quill = new Quill('#editor-container', {
        theme: 'snow',
        modules: {
          toolbar: [
            [{ header: [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            ['blockquote', 'code-block'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            [{ indent: '-1' }, { indent: '+1' }],
            ['link', 'image'],
            ['clean']
          ]
        }
      });
    }
    switchTab('dashboard');
  }

  document.getElementById('google-signin-btn').addEventListener('click', function () {
    var msg = document.getElementById('signin-msg');
    if (msg) msg.textContent = '';
    auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(function (e) {
      if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
        if (msg) msg.textContent = 'Sign-in failed. Please try again.';
      }
    });
  });

  document.getElementById('signout-btn').addEventListener('click', function () { auth.signOut(); });

  auth.onAuthStateChanged(async function (user) {
    if (!user) { showSignIn(); return; }
    try {
      var doc = await db.collection('adminEmails').doc(user.email).get();
      if (doc.exists) { showAdmin(user); return; }
    } catch (_) {}
    showSignIn('That account isn’t authorized for this blog.');
  });

  // ── Tabs ──────────────────────────────────────────────────────────────────
  function switchTab(name) {
    document.querySelectorAll('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
    document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
    var panel = document.getElementById('tab-' + name);
    if (panel) panel.classList.add('active');
    var nav = document.querySelector('.nav-item[data-tab="' + name + '"]');
    if (nav) nav.classList.add('active');
    if (name === 'dashboard') loadDashboardTab();
    if (name === 'articles')  loadArticlesTab();
    if (name === 'editor' && editingId === null) resetEditor();
  }

  document.querySelectorAll('.nav-item').forEach(function (item) {
    item.addEventListener('click', function () {
      var tab = item.dataset.tab;
      if (tab === 'editor') startNewArticle();
      else switchTab(tab);
    });
  });

  // ── Dashboard ─────────────────────────────────────────────────────────────
  async function loadDashboardTab() {
    ['stat-published', 'stat-drafts', 'stat-views'].forEach(function (id) {
      document.getElementById(id).textContent = '…';
    });
    try {
      var snap = await db.collection('articles').get();
      var published = 0, drafts = 0, views = 0;
      snap.docs.forEach(function (doc) {
        var a = doc.data();
        if (a.published) { published++; views += (a.views || 0); } else { drafts++; }
      });
      document.getElementById('stat-published').textContent = published.toLocaleString();
      document.getElementById('stat-drafts').textContent    = drafts.toLocaleString();
      document.getElementById('stat-views').textContent     = views.toLocaleString();

      var recent = snap.docs
        .map(function (d) { return { id: d.id, a: d.data() }; })
        .sort(function (x, y) { return articleMs(y.a) - articleMs(x.a); })
        .slice(0, 8);
      var el = document.getElementById('dashboard-recent');
      if (!recent.length) {
        el.innerHTML = '<p style="color:#999;font-size:13px;">No posts yet.</p>';
      } else {
        el.innerHTML = recent.map(function (r) {
          var a = r.a;
          var badge = a.published
            ? '<span class="badge badge-green" style="margin-left:6px;">Published</span>'
            : '<span class="badge badge-gray" style="margin-left:6px;">Draft</span>';
          return '<div class="dashboard-recent-row">'
            + '<div class="dashboard-recent-title">'
            + '<a href="article.html?id=' + encodeURIComponent(r.id) + '" target="_blank" style="color:var(--text);text-decoration:none;">'
            + (a.title ? esc(a.title) : '<em>Untitled</em>') + '</a>' + badge + '</div>'
            + '<div class="dashboard-recent-meta">' + fmtDate(a.date) + '</div>'
            + '<button class="btn btn-secondary btn-sm" data-id="' + esc(r.id) + '" onclick="adminEditArticle(this.dataset.id)">Edit</button>'
            + '</div>';
        }).join('');
      }
    } catch (e) {
      document.getElementById('stat-published').textContent = '!';
      console.error('Dashboard load error:', e);
    }
  }
  document.getElementById('refresh-dashboard-btn').addEventListener('click', loadDashboardTab);

  // ── Posts table ───────────────────────────────────────────────────────────
  var articlesData = [];
  var articlesSort = 'date'; // 'date' | 'views'

  function articleViews(a) { return typeof a.views === 'number' ? a.views : 0; }
  function articleMs(a) {
    var d = a.date;
    var t = d && d.toDate ? d.toDate() : new Date(d || 0);
    return t.getTime ? t.getTime() : 0;
  }

  async function loadArticlesTab() {
    var tbody = document.getElementById('articles-tbody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#999;"><span class="spinner"></span> Loading…</td></tr>';
    try {
      await autoPublishScheduled();
      var snap = await db.collection('articles').get();
      if (snap.empty) {
        articlesData = [];
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:#999;">No posts yet. Click “+ New Post”.</td></tr>';
        return;
      }
      articlesData = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
      renderArticlesTable();
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="5" style="color:#c00;padding:16px;">Error loading posts: ' + esc(e.message) + '</td></tr>';
    }
  }

  function renderArticlesTable() {
    var tbody = document.getElementById('articles-tbody');
    if (!tbody) return;
    var rows = articlesData.slice().sort(function (x, y) {
      return articlesSort === 'views'
        ? (articleViews(y) - articleViews(x)) || (articleMs(y) - articleMs(x))
        : (articleMs(y) - articleMs(x));
    });
    tbody.innerHTML = rows.map(function (a) {
      var pubBadge = a.published
        ? '<span class="badge badge-green">Published</span>'
        : (a.scheduledAt ? '<span class="badge badge-yellow">Scheduled</span>' : '<span class="badge badge-gray">Draft</span>');
      var dateDisplay = a.scheduledAt
        ? '<span title="Scheduled: ' + fmtDate(a.scheduledAt) + '" style="color:var(--warning);">⏰ ' + fmtDate(a.scheduledAt) + '</span>'
        : fmtDate(a.date);
      var viewsDisplay = a.published ? articleViews(a).toLocaleString() : '—';
      return '<tr data-id="' + esc(a.id) + '">'
        + '<td class="table-title">' + (a.title ? esc(a.title) : '<em>Untitled</em>') + '</td>'
        + '<td>' + pubBadge + '</td>'
        + '<td style="white-space:nowrap;font-family:var(--font-sans);font-size:13px;">' + dateDisplay + '</td>'
        + '<td style="text-align:right;font-variant-numeric:tabular-nums;font-family:var(--font-sans);font-size:13px;color:' + (a.published ? 'var(--text)' : '#9ca3af') + ';">' + viewsDisplay + '</td>'
        + '<td><div class="action-btns">'
        + '<button class="btn btn-secondary btn-sm" onclick="adminEditArticle(this.closest(\'tr\').dataset.id)">Edit</button>'
        + '<button class="btn btn-sm ' + (a.published ? 'btn-secondary' : 'btn-success') + '" onclick="adminTogglePublished(this.closest(\'tr\').dataset.id, ' + !!a.published + ')">' + (a.published ? 'Unpublish' : 'Publish') + '</button>'
        + '<button class="btn btn-danger btn-sm" onclick="adminDeleteArticle(this.closest(\'tr\').dataset.id)">Delete</button>'
        + '</div></td></tr>';
    }).join('');
    var dateTh = document.getElementById('th-date-sort');
    var viewsTh = document.getElementById('th-views-sort');
    if (dateTh)  dateTh.textContent  = 'Date'  + (articlesSort === 'date'  ? ' ▾' : '');
    if (viewsTh) viewsTh.textContent = 'Views' + (articlesSort === 'views' ? ' ▾' : '');
  }

  (function initSortHeaders() {
    var dateTh = document.getElementById('th-date-sort');
    var viewsTh = document.getElementById('th-views-sort');
    if (dateTh)  dateTh.addEventListener('click',  function () { articlesSort = 'date';  renderArticlesTable(); });
    if (viewsTh) viewsTh.addEventListener('click', function () { articlesSort = 'views'; renderArticlesTable(); });
  })();

  // Auto-publish scheduled posts whose time has passed (index-free).
  async function autoPublishScheduled() {
    try {
      var nowMs = Date.now();
      var snap = await db.collection('articles').where('published', '==', false).get();
      if (snap.empty) return;
      var batch = db.batch();
      var due = 0;
      snap.docs.forEach(function (doc) {
        var s = doc.data().scheduledAt;
        if (!s) return;
        var ms = s.toDate ? s.toDate().getTime() : new Date(s).getTime();
        if (ms <= nowMs) { batch.update(doc.ref, { published: true }); due++; }
      });
      if (due === 0) return;
      await batch.commit();
      showToast(due + ' scheduled post(s) auto-published.', 'success');
    } catch (_) {}
  }

  window.adminEditArticle = function (id) { startEditArticle(id); };

  window.adminDeleteArticle = async function (id) {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    try {
      await db.collection('articles').doc(id).delete();
      showToast('Post deleted.', 'success');
      loadArticlesTab();
    } catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
  };

  window.adminTogglePublished = async function (id, current) {
    try {
      await db.collection('articles').doc(id).update({ published: !current });
      showToast(current ? 'Post unpublished.' : 'Post published!', 'success');
      loadArticlesTab();
    } catch (e) { showToast('Update failed: ' + e.message, 'error'); }
  };

  // ── Editor ────────────────────────────────────────────────────────────────
  function resetEditor() {
    editingId = null;
    currentImageUrl = '';
    document.getElementById('editor-heading').textContent = 'New Post';
    document.getElementById('edit-article-id').value = '';
    document.getElementById('f-title').value = '';
    document.getElementById('f-standfirst').value = '';
    document.getElementById('f-image').value = '';
    document.getElementById('f-image-caption').value = '';
    document.getElementById('f-scheduled-at').value = '';
    document.getElementById('f-published').checked = false;
    document.getElementById('image-preview-wrap').style.display = 'none';
    document.getElementById('image-preview').src = '';
    var st = document.getElementById('cover-upload-status');
    if (st) st.style.display = 'none';
    if (quill) quill.setContents([]);
  }

  function startNewArticle() {
    resetEditor();
    switchTab('editor');
    document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
    document.querySelector('.nav-item[data-tab="editor"]').classList.add('active');
  }

  async function startEditArticle(id) {
    try {
      var doc = await db.collection('articles').doc(id).get();
      if (!doc.exists) { showToast('Post not found.', 'error'); return; }
      var a = doc.data();
      editingId = id;
      currentImageUrl = a.imageUrl || '';
      document.getElementById('editor-heading').textContent = 'Edit Post';
      document.getElementById('edit-article-id').value = id;
      document.getElementById('f-title').value = a.title || '';
      document.getElementById('f-standfirst').value = a.standfirst || '';
      document.getElementById('f-image').value = a.imageUrl || '';
      document.getElementById('f-image-caption').value = a.imageCaption || '';
      document.getElementById('f-published').checked = !!a.published;

      if (a.scheduledAt) {
        var d = a.scheduledAt.toDate ? a.scheduledAt.toDate() : new Date(a.scheduledAt);
        var pad = function (n) { return String(n).padStart(2, '0'); };
        document.getElementById('f-scheduled-at').value =
          d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' + pad(d.getHours()) + ':' + pad(d.getMinutes());
      } else {
        document.getElementById('f-scheduled-at').value = '';
      }

      if (a.imageUrl) {
        document.getElementById('image-preview').src = a.imageUrl;
        document.getElementById('image-preview-wrap').style.display = 'block';
      } else {
        document.getElementById('image-preview-wrap').style.display = 'none';
      }

      if (quill) {
        if (a.body) quill.clipboard.dangerouslyPasteHTML(a.body);
        else quill.setContents([]);
      }

      switchTab('editor');
      document.querySelectorAll('.nav-item').forEach(function (n) { n.classList.remove('active'); });
      document.querySelector('.nav-item[data-tab="editor"]').classList.add('active');
    } catch (e) { showToast('Failed to load post: ' + e.message, 'error'); }
  }

  // Live URL preview
  document.getElementById('f-image').addEventListener('input', function () {
    var url = this.value.trim();
    var wrap = document.getElementById('image-preview-wrap');
    var img = document.getElementById('image-preview');
    if (url) { img.src = url; wrap.style.display = 'block'; }
    else { wrap.style.display = 'none'; img.src = ''; }
  });

  // ── Cover image upload → Firebase Storage (article_images/) ────────────────
  document.getElementById('cover-upload-btn').addEventListener('click', function () {
    var input = document.getElementById('cover-file');
    input.value = '';
    input.click();
  });
  document.getElementById('cover-file').addEventListener('change', async function () {
    var file = this.files && this.files[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) { showToast('Please choose an image file.', 'error'); return; }
    if (file.size > 8 * 1024 * 1024) { showToast('Image must be under 8 MB.', 'error'); return; }
    var st = document.getElementById('cover-upload-status');
    st.style.display = ''; st.textContent = 'Uploading…';
    try {
      var ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      var path = 'article_images/' + Date.now() + '_' + Math.random().toString(36).slice(2, 8) + '.' + ext;
      var ref = storage.ref(path);
      await ref.put(file, { contentType: file.type });
      var url = await ref.getDownloadURL();
      document.getElementById('f-image').value = url;
      document.getElementById('image-preview').src = url;
      document.getElementById('image-preview-wrap').style.display = 'block';
      st.textContent = 'Uploaded ✓';
      setTimeout(function () { st.style.display = 'none'; }, 2500);
    } catch (e) {
      st.textContent = 'Upload failed: ' + e.message;
    } finally {
      this.value = '';
    }
  });

  document.getElementById('editor-cancel-btn').addEventListener('click', function () { switchTab('articles'); });
  document.getElementById('save-draft-btn').addEventListener('click', function () { saveArticle(false); });
  document.getElementById('publish-btn').addEventListener('click', function () { saveArticle(true); });
  document.getElementById('preview-btn').addEventListener('click', async function () {
    var id = await saveArticle(false, true, { preview: true });
    if (id) window.open('article.html?id=' + id + '&preview=1', '_blank');
  });

  // Returns saved id, or null on failure.
  async function saveArticle(publish, returnId, opts) {
    opts = opts || {};
    var title = document.getElementById('f-title').value.trim();
    if (!title) {
      showToast('Title is required.', 'error');
      document.getElementById('f-title').focus();
      return null;
    }
    var imageUrl = document.getElementById('f-image').value.trim() || currentImageUrl;

    var scheduledAt = null;
    var schedStr = document.getElementById('f-scheduled-at').value;
    if (schedStr) {
      var sd = new Date(schedStr);
      if (!isNaN(sd)) scheduledAt = firebase.firestore.Timestamp.fromDate(sd);
    }

    // Fetch existing once (published-preservation for preview + date preservation).
    var existing = null;
    if (editingId) {
      try { existing = (await db.collection('articles').doc(editingId).get()).data() || null; } catch (_) {}
    }

    // Preview must never change live status.
    var isPublished = opts.preview
      ? (editingId ? !!(existing && existing.published) : false)
      : (publish || document.getElementById('f-published').checked);

    var data = {
      title:        title,
      standfirst:   document.getElementById('f-standfirst').value.trim(),
      imageUrl:     imageUrl,
      imageCaption: document.getElementById('f-image-caption').value.trim(),
      body:         quill ? quill.root.innerHTML : '',
      published:    isPublished,
      scheduledAt:  scheduledAt
    };

    if (!editingId) {
      data.date = firebase.firestore.FieldValue.serverTimestamp();
      data.views = 0;
    } else {
      data.date = (existing && existing.date) || firebase.firestore.FieldValue.serverTimestamp();
    }

    try {
      var savedId;
      if (editingId) {
        await db.collection('articles').doc(editingId).update(data);
        savedId = editingId;
        showToast('Post updated!', 'success');
      } else {
        var ref = await db.collection('articles').add(data);
        savedId = ref.id;
        editingId = savedId;
        showToast('Post created!', 'success');
      }
      if (returnId) return savedId;
      switchTab('articles');
      return savedId;
    } catch (e) {
      showToast('Save failed: ' + e.message, 'error');
      return null;
    }
  }

  // Escape from editor back to the list
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.getElementById('tab-editor').classList.contains('active')) {
      switchTab('articles');
    }
  });

})();
