// Dashboard JavaScript — W-JOB Design v8.0
// IDs dans index.html (nouveau design) :
//   KPIs       : kpi-offers | kpi-apps | kpi-companies | kpi-recruiters
//   Badges nav : badge-jobs | badge-apps
//   Répartition: dist-count-sent/pending/responded/draft + dist-bar-sent/pending/responded/draft
//   Timeline   : activity-timeline
//   Dernières  : latest-apps-list
//   Sync text  : sync-text

document.addEventListener('DOMContentLoaded', function () {
    console.log('[W-JOB] Dashboard v8.0 chargé');
    loadDashboard();
});

async function loadDashboard() {
    try {
        const [stats, activity] = await Promise.all([
            API.getStats(),
            API.getActivity()
        ]);

        renderKPIs(stats);
        renderDistribution(stats);
        renderTimeline(activity);
        renderLatestApps();
        updateSyncText();

    } catch (error) {
        console.error('[W-JOB] Dashboard load error:', error);
        setSyncText('Erreur de connexion');
    }
}

// ── KPI Cards ────────────────────────────────────────────
function renderKPIs(stats) {
    countUp('kpi-offers',    stats.totalJobs         || 0);
    countUp('kpi-apps',      stats.totalApplications || 0);
    countUp('kpi-companies', stats.totalCompanies    || 0);
    countUp('kpi-recruiters',stats.totalRecruiters   || 0);

    // Nav badges
    const bJobs = document.getElementById('badge-jobs');
    const bApps = document.getElementById('badge-apps');
    if (bJobs) bJobs.textContent = stats.totalJobs || 0;
    if (bApps) bApps.textContent = stats.totalApplications || 0;

    // KPI subs
    const sub = document.getElementById('kpi-apps-sub');
    if (sub) sub.textContent = `${stats.pendingCount || 0} en attente de réponse`;
}

// ── Distribution bars ────────────────────────────────────
function renderDistribution(stats) {
    const total = Math.max(stats.totalApplications || 1, 1);
    const sent      = stats.sentCount      || 0;
    const pending   = stats.pendingCount   || 0;
    const responded = stats.respondedCount || 0;
    const draft     = stats.draftCount     || 0;

    setDistItem('dist-count-sent',      'dist-bar-sent',      sent,      total);
    setDistItem('dist-count-pending',   'dist-bar-pending',   pending,   total);
    setDistItem('dist-count-responded', 'dist-bar-responded', responded, total);
    setDistItem('dist-count-draft',     'dist-bar-draft',     draft,     total);
}

function setDistItem(countId, barId, value, total) {
    const countEl = document.getElementById(countId);
    const barEl   = document.getElementById(barId);
    if (countEl) countEl.textContent = value;
    if (barEl) {
        setTimeout(() => {
            barEl.style.width = Math.round((value / total) * 100) + '%';
        }, 400);
    }
}

// ── Activity Timeline ─────────────────────────────────────
function renderTimeline(activity) {
    const el = document.getElementById('activity-timeline');
    if (!el) return;

    if (!activity || activity.length === 0) {
        el.innerHTML = '<div class="empty-msg">Aucune activité récente.</div>';
        return;
    }

    el.innerHTML = activity.slice(0, 5).map(item => {
        const dotColor = item.type === 'cv' ? 'var(--em)' :
                         item.type === 'email' ? '#fbbf24' : '#93c5fd';
        const time = item.created_at
            ? new Date(item.created_at).toLocaleString('fr-FR', {day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})
            : (item.date || '');
        return `
        <div class="activity-item">
          <div class="act-dot" style="background:${dotColor}"></div>
          <div>
            <div class="act-text">${item.description || item.title || item.action || ''}</div>
            <div class="act-time">${time}</div>
          </div>
        </div>`;
    }).join('');
}

// ── Latest Applications ───────────────────────────────────
async function renderLatestApps() {
    const el = document.getElementById('latest-apps-list');
    if (!el) return;

    const statusMap = {
        draft:     { label: 'Brouillon', cls: 's-draft' },
        pending:   { label: 'En attente', cls: 's-pending' },
        sent:      { label: 'Envoyée', cls: 's-sent' },
        responded: { label: 'Réponse', cls: 's-responded' }
    };

    try {
        const apps = await API.getApplications();
        if (!apps || apps.length === 0) {
            el.innerHTML = '<div class="empty-msg">Aucune candidature pour le moment.</div>';
            return;
        }

        el.innerHTML = apps.slice(0, 5).map(app => {
            const job     = app.job || {};
            const title   = app.job_title || job.title   || 'Poste';
            const company = app.company   || job.company || 'Entreprise';
            const status  = app.status || 'draft';
            const sm      = statusMap[status] || { label: status, cls: 's-draft' };
            const initials = company.substring(0,2).toUpperCase();
            return `
            <div class="app-item">
              <div class="app-logo">${initials}</div>
              <div class="app-info">
                <div class="app-role">${title}</div>
                <div class="app-company">${company}</div>
              </div>
              <span class="app-status ${sm.cls}">${sm.label}</span>
            </div>`;
        }).join('');

    } catch (e) {
        console.error('[W-JOB] Latest apps error:', e);
        el.innerHTML = '<div class="empty-msg">Impossible de charger les candidatures.</div>';
    }
}

// ── Sync text ─────────────────────────────────────────────
function updateSyncText() {
    setSyncText('Synchronisé · ' + new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}));
}
function setSyncText(msg) {
    const el = document.getElementById('sync-text');
    if (el) el.textContent = msg;
}

// ── Animated Counter ──────────────────────────────────────
function countUp(id, target, duration) {
    const el = document.getElementById(id);
    if (!el) return;
    duration = duration || 1000;
    const step = target / (duration / 16);
    let v = 0;
    const t = setInterval(() => {
        v = Math.min(v + step, target);
        el.textContent = Math.floor(v);
        if (v >= target) clearInterval(t);
    }, 16);
}
