// kanban.js — W-JOB Kanban Candidatures

let _allApps = [];

document.addEventListener('DOMContentLoaded', async function () {
    showSkeletons();

    // Avatar + badges dynamiques, en parallèle du kanban
    const avatar = API.getMe().then(me => {
        const av = document.getElementById('user-avatar');
        if (me && av) av.textContent = (me.name || me.email || '?').substring(0, 2).toUpperCase();
    }).catch(() => {});

    const badges = API.getStats().then(stats => {
        if (!stats) return;
        const bj = document.getElementById('badge-jobs');
        const ba = document.getElementById('badge-apps');
        if (bj) bj.textContent = stats.jobs || 0;
        if (ba) ba.textContent = stats.applications || 0;
    }).catch(() => {});

    await Promise.all([avatar, badges, loadKanban()]);
    initFilters();
});

// Remplace le contenu d'exemple du HTML par des cartes de chargement
function showSkeletons() {
    ['draft', 'pending', 'sent', 'responded'].forEach(status => {
        const col = document.getElementById('kanban-' + status);
        if (!col) return;
        Array.from(col.children).forEach(child => {
            if (!child.classList.contains('col-header') && !child.classList.contains('add-card')) child.remove();
        });
        const cnt = document.getElementById('count-' + status);
        if (cnt) cnt.textContent = '–';
        const sk = document.createElement('div');
        sk.className = 'col-empty';
        sk.style.cssText = 'height:96px;border-radius:14px;margin-bottom:.6rem;background:linear-gradient(90deg,rgba(255,255,255,.03) 25%,rgba(255,255,255,.07) 50%,rgba(255,255,255,.03) 75%);background-size:200% 100%;animation:wjSk 1.4s infinite';
        const addBtn = col.querySelector('.add-card');
        addBtn ? col.insertBefore(sk, addBtn) : col.appendChild(sk);
    });
    if (!document.getElementById('wj-sk-style')) {
        const st = document.createElement('style');
        st.id = 'wj-sk-style';
        st.textContent = '@keyframes wjSk{0%{background-position:200% 0}100%{background-position:-200% 0}}';
        document.head.appendChild(st);
    }
}

// ── Chargement ────────────────────────────────────────────
async function loadKanban() {
    try {
        _allApps = (await API.getApplications()) || [];
        renderKanban(_allApps);
        updateStats(_allApps);
        updateFilterCounts(_allApps);
    } catch (e) {
        console.error('[W-JOB] Kanban error:', e);
    }
}

// ── Rendu colonnes ────────────────────────────────────────
function renderKanban(apps) {
    ['draft', 'pending', 'sent', 'responded'].forEach(status => {
        const col = document.getElementById('kanban-' + status);
        if (!col) return;

        const list = apps.filter(a => (a.status || 'draft') === status);
        const cnt  = document.getElementById('count-' + status);
        if (cnt) cnt.textContent = list.length;

        // Préserver header et bouton "ajouter"
        const header = col.querySelector('.col-header');
        const addBtn = col.querySelector('.add-card');

        // Supprimer uniquement les cartes et états vides
        Array.from(col.children).forEach(child => {
            if (!child.classList.contains('col-header') && !child.classList.contains('add-card')) {
                child.remove();
            }
        });

        if (list.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'col-empty';
            empty.style.cssText = 'text-align:center;padding:1.5rem 1rem;color:var(--muted);font-size:.8rem';
            empty.textContent = 'Aucune candidature';
            addBtn ? col.insertBefore(empty, addBtn) : col.appendChild(empty);
            return;
        }

        list.forEach(app => {
            const card = buildCard(app, status);
            addBtn ? col.insertBefore(card, addBtn) : col.appendChild(card);
        });
    });
}

// ── Construction d'une carte ──────────────────────────────
function buildCard(app, status) {
    const job      = app.job || {};
    const title    = job.title    || app.job_title || 'Offre supprimée';
    const company  = job.company  || app.company   || '';
    const location = job.location || app.location  || '';
    const score    = app.match_score || job.compatibility || 0;
    const match    = score > 0 ? Math.round(score) + '%' : '';
    const dateRaw  = app.createdDate || app.created_at;
    const date     = dateRaw
        ? new Date(dateRaw).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
        : '';

    const div = document.createElement('div');
    div.className = 'app-card ' + status;
    div.dataset.id = app.id;

    const initials = company.substring(0, 2).toUpperCase();
    const city = location ? location.split(/[·,]/)[0].trim() : '';

    div.innerHTML = `
      <div class="card-top">
        <div class="company-logo" style="font-weight:700;font-size:.75rem">${initials}</div>
        <div class="card-info">
          <div class="card-role">${escHtml(title)}</div>
          <div class="card-company">${escHtml(company)}${city ? ' · ' + escHtml(city) : ''}</div>
        </div>
        ${match ? `<span class="match-badge">${match}</span>` : ''}
      </div>
      <div class="card-footer">
        <span class="card-date">${date}</span>
        <div class="card-actions">
          ${status === 'draft' ? `<button class="btn-card-send" data-id="${app.id}">Envoyer</button>` : ''}
          <button class="btn-card-view" data-id="${app.id}">Voir</button>
          <button class="btn-card-delete" data-id="${app.id}" title="Supprimer">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>`;

    div.querySelector('.btn-card-view')?.addEventListener('click', e => {
        e.stopPropagation();
        viewApp(app);
    });
    div.querySelector('.btn-card-send')?.addEventListener('click', async e => {
        e.stopPropagation();
        await sendApp(app.id, e.currentTarget);
    });
    div.querySelector('.btn-card-delete')?.addEventListener('click', async e => {
        e.stopPropagation();
        await deleteApp(app.id, div);
    });
    div.addEventListener('click', () => viewApp(app));

    return div;
}

// ── Stats ─────────────────────────────────────────────────
function updateStats(apps) {
    const sent    = apps.filter(a => a.status === 'sent').length;
    const pending = apps.filter(a => a.status === 'pending').length;
    const scores  = apps.map(a => a.match_score || a.job?.compatibility || 0).filter(s => s > 0);
    const best    = scores.length ? Math.max(...scores) : 0;

    const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    s('stat-apps-total',   apps.length);
    s('stat-apps-sent',    sent);
    s('stat-apps-pending', pending);
    s('stat-apps-match',   best > 0 ? best + '%' : '—');
}

function updateFilterCounts(apps) {
    const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    s('fcount-all',       apps.length);
    s('fcount-draft',     apps.filter(a => (a.status || 'draft') === 'draft').length);
    s('fcount-pending',   apps.filter(a => a.status === 'pending').length);
    s('fcount-sent',      apps.filter(a => a.status === 'sent').length);
    s('fcount-responded', apps.filter(a => a.status === 'responded').length);
}

// ── Filtres ───────────────────────────────────────────────
function initFilters() {
    // Boutons filtre par statut
    document.querySelectorAll('.ftab[data-status]').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            filterColumns(this.dataset.status);
        });
    });

    // Recherche texte
    const searchInput = document.getElementById('search-apps');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const q = searchInput.value.toLowerCase().trim();
            document.querySelectorAll('.app-card').forEach(card => {
                const match = !q || card.textContent.toLowerCase().includes(q);
                card.style.display = match ? '' : 'none';
            });
        });
    }

    // Bouton "Nouvelle candidature"
    document.getElementById('btn-new-app')?.addEventListener('click', () => {
        window.location.href = '/jobs';
    });
}

function filterColumns(status) {
    ['draft', 'pending', 'sent', 'responded'].forEach(s => {
        const col = document.getElementById('kanban-' + s);
        if (!col) return;
        col.style.display = (status === 'all' || status === s) ? '' : 'none';
    });
}

// ── Actions ───────────────────────────────────────────────
async function sendApp(id, btn) {
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
        await API.updateApplicationStatus(id, 'sent');
        _allApps = (await API.getApplications()) || [];
        renderKanban(_allApps);
        updateStats(_allApps);
        updateFilterCounts(_allApps);
    } catch (e) {
        console.error('[W-JOB] Send error:', e);
        if (btn) { btn.disabled = false; btn.textContent = 'Envoyer'; }
    }
}

function deleteApp(id, cardEl) {
    // Afficher confirmation inline sur la carte
    const footer = cardEl.querySelector('.card-footer');
    if (!footer || cardEl.querySelector('.delete-confirm')) return;

    const confirmBar = document.createElement('div');
    confirmBar.className = 'delete-confirm';
    confirmBar.innerHTML = `
      <span class="delete-confirm-text">Supprimer ?</span>
      <button class="delete-confirm-yes">Oui</button>
      <button class="delete-confirm-no">Non</button>`;
    footer.replaceWith(confirmBar);

    confirmBar.querySelector('.delete-confirm-no').addEventListener('click', e => {
        e.stopPropagation();
        confirmBar.replaceWith(footer);
    });

    confirmBar.querySelector('.delete-confirm-yes').addEventListener('click', async e => {
        e.stopPropagation();
        cardEl.style.opacity = '.4';
        cardEl.style.pointerEvents = 'none';
        try {
            await API.deleteApplication(id);
            _allApps = _allApps.filter(a => a.id !== id);
            renderKanban(_allApps);
            updateStats(_allApps);
            updateFilterCounts(_allApps);
        } catch (err) {
            console.error('[W-JOB] Delete error:', err);
            cardEl.style.opacity = '';
            cardEl.style.pointerEvents = '';
            confirmBar.replaceWith(footer);
        }
    });
}

function viewApp(app) {
    const params = new URLSearchParams({ job_id: app.jobId ?? '', app_id: app.id });
    window.location.href = '/apply?' + params.toString();
}

function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
