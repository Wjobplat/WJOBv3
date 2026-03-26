// kanban.js — W-JOB Kanban Candidatures
// Peuple les colonnes kanban depuis Supabase via API

document.addEventListener('DOMContentLoaded', function () {
    console.log('[W-JOB] Kanban v1.0 chargé');
    loadKanban();
});

async function loadKanban() {
    try {
        const apps = await API.getApplications();
        renderKanban(apps || []);
        updateStats(apps || []);
    } catch (e) {
        console.error('[W-JOB] Kanban error:', e);
    }
}

function renderKanban(apps) {
    const columns = {
        draft:     document.getElementById('kanban-draft'),
        pending:   document.getElementById('kanban-pending'),
        sent:      document.getElementById('kanban-sent'),
        responded: document.getElementById('kanban-responded')
    };
    const counts = {
        draft:     document.getElementById('count-draft'),
        pending:   document.getElementById('count-pending'),
        sent:      document.getElementById('count-sent'),
        responded: document.getElementById('count-responded')
    };

    // Group by status
    const grouped = { draft: [], pending: [], sent: [], responded: [] };
    apps.forEach(app => {
        const s = app.status || 'draft';
        if (grouped[s]) grouped[s].push(app);
        else grouped.draft.push(app);
    });

    // Render each column
    Object.entries(grouped).forEach(([status, list]) => {
        const col = columns[status];
        const cnt = counts[status];
        if (cnt) cnt.textContent = list.length;
        if (!col) return;

        // Remove static placeholder cards (keep only the "add" button if present)
        const addBtn = col.querySelector('.add-card');
        col.innerHTML = '';
        if (addBtn) col.appendChild(addBtn);

        if (list.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'text-align:center;padding:1.5rem;color:var(--muted);font-size:.8rem';
            empty.textContent = 'Aucune candidature';
            col.insertBefore(empty, col.firstChild);
            return;
        }

        list.forEach(app => {
            const card = buildCard(app, status);
            if (addBtn) col.insertBefore(card, addBtn);
            else col.appendChild(card);
        });
    });
}

function buildCard(app, status) {
    const job = app.job || {};
    const title   = app.job_title || job.title   || 'Poste';
    const company = app.company   || job.company  || 'Entreprise';
    const location= app.location  || job.location || '';
    const match   = app.match_score ? `${Math.round(app.match_score)}%` : '';
    const date    = app.created_at
        ? new Date(app.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short'})
        : '';

    const tagColors = {
        draft:     '#4b5563',
        pending:   '#d97706',
        sent:      '#059669',
        responded: '#2563eb'
    };
    const tagLabels = {
        draft: 'Brouillon', pending: 'En attente', sent: 'Envoyée', responded: 'Réponse'
    };

    const div = document.createElement('div');
    div.className = 'app-card ' + (status === 'draft' ? 'draft' : status === 'pending' ? 'pending' : status === 'sent' ? 'sent' : 'responded');

    const initials = company.substring(0, 2).toUpperCase();

    div.innerHTML = `
      <div class="card-top">
        <div class="company-logo" style="background:rgba(16,185,129,.14);color:var(--em-l);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:.75rem">${initials}</div>
        <div class="card-info">
          <div class="card-role">${escHtml(title)}</div>
          <div class="card-company">${escHtml(company)}${location ? ' · ' + escHtml(location) : ''}</div>
        </div>
        ${match ? `<span class="match-badge">${match}</span>` : ''}
      </div>
      ${app.tags ? `<div class="card-tags">${app.tags.slice(0,3).map(t=>`<span class="tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
      <div class="card-footer">
        <span class="card-date">${date}</span>
        <div class="card-actions">
          ${status === 'draft' ? `<button class="btn-send" onclick="sendApp('${app.id}')">Envoyer</button>` : ''}
          <button class="btn-view" onclick="viewApp('${app.id}')">Voir</button>
        </div>
      </div>`;

    return div;
}

function updateStats(apps) {
    const total     = apps.length;
    const sent      = apps.filter(a => a.status === 'sent').length;
    const pending   = apps.filter(a => a.status === 'pending').length;

    const elTotal   = document.getElementById('stat-total-jobs');
    const elSent    = document.getElementById('stat-sent');
    const elPending = document.getElementById('stat-pending');

    if (elTotal)   elTotal.textContent   = total;
    if (elSent)    elSent.textContent    = sent;
    if (elPending) elPending.textContent = pending;
}

async function sendApp(id) {
    try {
        await API.updateApplicationStatus(id, 'sent');
        await loadKanban();
    } catch (e) {
        console.error('[W-JOB] Send error:', e);
    }
}

function viewApp(id) {
    window.location.href = `application-review.html?id=${id}`;
}

function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
