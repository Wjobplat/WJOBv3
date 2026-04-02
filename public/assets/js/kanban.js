// kanban.js — W-JOB Kanban Candidatures

let _allApps = [];

document.addEventListener('DOMContentLoaded', async function () {
    // Avatar + badges dynamiques
    try {
        const me = await API.getMe();
        if (me) {
            const av = document.getElementById('user-avatar');
            if (av) av.textContent = (me.name || me.email || 'MM').substring(0, 2).toUpperCase();
        }
    } catch (e) {}

    try {
        const stats = await API.getStats();
        if (stats) {
            const bj = document.getElementById('badge-jobs');
            const ba = document.getElementById('badge-apps');
            if (bj) bj.textContent = stats.jobs || 0;
            if (ba) ba.textContent = stats.applications || 0;
        }
    } catch (e) {}

    await loadKanban();
    initFilters();
});

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
        </div>
      </div>`;

    div.querySelector('.btn-card-view')?.addEventListener('click', e => {
        e.stopPropagation();
        viewApp(app.id);
    });
    div.querySelector('.btn-card-send')?.addEventListener('click', async e => {
        e.stopPropagation();
        await sendApp(app.id, e.currentTarget);
    });
    div.addEventListener('click', () => viewApp(app.id));

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

function viewApp(id) {
    window.location.href = '/application-review?id=' + id;
}

function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
