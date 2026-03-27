// jobs.js — W-JOB Emplois
// Charge les offres depuis Supabase et peuple la grille

document.addEventListener('DOMContentLoaded', function () {
    console.log('[W-JOB] Jobs v1.0 chargé');
    loadJobs();
    initFilters();
});

// ── Variables globales ─────────────────────────────────────
let _allJobs   = [];
let _activeFilter = 'all'; // 'all' | 'CDI' | 'CDD' | 'Stage' | 'Alternance' | 'remote'
let _searchQuery  = '';
let _locationQuery = '';

// ── Chargement des offres ──────────────────────────────────
async function loadJobs() {
    const grid = document.getElementById('job-grid');
    if (!grid) return;

    // Affiche un loader pendant le chargement
    grid.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--muted);font-size:.9rem;">Chargement des offres...</div>';

    try {
        const jobs = await API.getJobs();
        _allJobs = jobs || [];
        renderJobs(_allJobs);
        updateStats(_allJobs);
    } catch (e) {
        console.error('[W-JOB] Jobs load error:', e);
        grid.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--muted);">Impossible de charger les offres. Vérifiez votre connexion.</div>';
    }
}

// ── Rendu des cartes emploi ────────────────────────────────
function renderJobs(jobs) {
    const grid = document.getElementById('job-grid');
    if (!grid) return;

    // Mise à jour du compteur
    const cnt = document.getElementById('results-count');
    if (cnt) cnt.textContent = jobs.length;

    if (jobs.length === 0) {
        grid.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--muted);font-size:.9rem;">Aucune offre trouvée. Uploadez votre CV pour générer des offres personnalisées !</div>';
        return;
    }

    grid.innerHTML = '';
    jobs.forEach((job, i) => {
        const card = buildJobCard(job, i);
        grid.appendChild(card);
    });
}

// ── Construction d'une carte emploi ───────────────────────
const LOGO_COLORS = [
    { bg: 'rgba(16,185,129,.14)',  color: 'var(--em-l)' },
    { bg: 'rgba(245,158,11,.12)', color: '#fbbf24' },
    { bg: 'rgba(59,130,246,.14)', color: '#93c5fd' },
    { bg: 'rgba(167,139,250,.14)',color: '#c4b5fd' },
    { bg: 'rgba(236,72,153,.12)', color: '#f9a8d4' },
    { bg: 'rgba(20,184,166,.14)', color: '#5eead4' },
];

// SVG icons compacts pour les méta
const SVG = {
    company:  '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
    location: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
    contract: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
    salary:   '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',
    calendar: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    save:     '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
    logo:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>',
};

function buildJobCard(job, index) {
    const lc       = LOGO_COLORS[index % LOGO_COLORS.length];
    const score    = Math.round(job.compatibility || job.match_score || 75);
    const circumf  = 113;
    const offset   = Math.round(circumf * (1 - score / 100));
    const isFeatured = score >= 88;

    const postedDate = job.postedDate
        ? (() => {
            const diff = Math.floor((Date.now() - new Date(job.postedDate)) / 86400000);
            if (diff === 0) return "Aujourd'hui";
            if (diff === 1) return 'Il y a 1j';
            return `Il y a ${diff}j`;
          })()
        : '';

    const skills = Array.isArray(job.skills) ? job.skills : [];
    const tags = skills.slice(0, 5).map((s, si) =>
        `<span class="job-tag${si < 2 ? ' highlight' : ''}">${escHtml(s)}</span>`
    ).join('');

    const div = document.createElement('div');
    div.className = `job-card${isFeatured ? ' featured' : ''} fade-in fi4`;
    div.style.animationDelay = `${index * 0.08}s`;
    div.dataset.jobId = job.id;

    div.innerHTML = `
      <div class="job-top">
        <div class="job-logo" style="background:${lc.bg};color:${lc.color}">${SVG.logo}</div>
        <div class="job-info">
          <div class="job-role">${escHtml(job.title || 'Poste')}</div>
          <div class="job-meta">
            <span class="job-meta-item">${SVG.company} ${escHtml(job.company || '')}</span>
            ${job.location ? `<span class="job-meta-item">${SVG.location} ${escHtml(job.location)}</span>` : ''}
            ${job.contractType ? `<span class="job-meta-item">${SVG.contract} ${escHtml(job.contractType)}</span>` : ''}
            ${job.salary ? `<span class="job-meta-item">${SVG.salary} ${escHtml(job.salary)}</span>` : ''}
            ${job.remote ? `<span class="job-meta-item">🌐 Remote</span>` : ''}
          </div>
        </div>
        <div class="job-score">
          <div class="score-ring">
            <svg width="44" height="44" viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(16,185,129,.12)" stroke-width="3"/>
              <circle cx="22" cy="22" r="18" fill="none" stroke="#10b981" stroke-width="3"
                stroke-dasharray="${circumf}" stroke-dashoffset="${offset}" stroke-linecap="round"/>
            </svg>
            <span class="score-val">${score}%</span>
          </div>
        </div>
      </div>
      ${tags ? `<div class="job-tags">${tags}</div>` : ''}
      <div class="job-footer">
        <span class="job-date">${SVG.calendar} ${postedDate}</span>
        <div class="job-actions">
          <button class="btn-save" data-id="${job.id}">${SVG.save} Sauvegarder</button>
          <button class="btn-apply" data-id="${job.id}">Candidater</button>
        </div>
      </div>`;

    // Événements
    div.querySelector('.btn-apply').addEventListener('click', (e) => {
        e.stopPropagation();
        window.location.href = `/applications?job_id=${job.id}`;
    });
    div.querySelector('.btn-save').addEventListener('click', (e) => {
        e.stopPropagation();
        const btn = e.currentTarget;
        btn.style.borderColor = 'rgba(16,185,129,.4)';
        btn.style.color = 'var(--em-l)';
        showToast('Offre sauvegardée !', 'success');
    });
    div.addEventListener('click', () => {
        window.location.href = `/applications?job_id=${job.id}`;
    });

    return div;
}

// ── Mise à jour des stats ──────────────────────────────────
function updateStats(jobs) {
    const total     = jobs.length;
    const companies = new Set(jobs.map(j => j.company).filter(Boolean)).size;
    const scores    = jobs.map(j => j.compatibility || j.match_score || 0).filter(s => s > 0);
    const avgMatch  = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
    const today     = new Date().toISOString().split('T')[0];
    const newToday  = jobs.filter(j => (j.postedDate || '').startsWith(today)).length;

    const statVals = document.querySelectorAll('.stats-row .stat-val');
    if (statVals[0]) statVals[0].textContent = total;
    if (statVals[1]) statVals[1].textContent = newToday;
    if (statVals[2]) statVals[2].textContent = avgMatch > 0 ? avgMatch + '%' : '—';
    if (statVals[3]) statVals[3].textContent = companies;

    const cnt = document.getElementById('results-count');
    if (cnt) cnt.textContent = total;
}

// ── Filtres ────────────────────────────────────────────────
function initFilters() {
    // Boutons de filtre de type de contrat
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const text = this.textContent.trim();
            if (text.includes('Tous')) _activeFilter = 'all';
            else if (text.includes('Remote') || text.includes('Télétravail')) _activeFilter = 'remote';
            else _activeFilter = text;
            applyFilters();
        });
    });

    // Recherche textuelle
    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
        searchInput.addEventListener('input', function () {
            _searchQuery = this.value.toLowerCase().trim();
            applyFilters();
        });
    }

    // Filtre localisation
    const locationInput = document.getElementById('filter-location');
    if (locationInput) {
        locationInput.addEventListener('input', function () {
            _locationQuery = this.value.toLowerCase().trim();
            applyFilters();
        });
    }
}

function applyFilters() {
    let filtered = _allJobs;

    if (_activeFilter !== 'all') {
        if (_activeFilter === 'remote') {
            filtered = filtered.filter(j => j.remote);
        } else {
            filtered = filtered.filter(j =>
                (j.contractType || '').toLowerCase().includes(_activeFilter.toLowerCase())
            );
        }
    }

    if (_searchQuery) {
        filtered = filtered.filter(j =>
            (j.title || '').toLowerCase().includes(_searchQuery) ||
            (j.company || '').toLowerCase().includes(_searchQuery) ||
            (j.description || '').toLowerCase().includes(_searchQuery) ||
            (j.skills || []).some(s => s.toLowerCase().includes(_searchQuery))
        );
    }

    if (_locationQuery) {
        filtered = filtered.filter(j =>
            (j.location || '').toLowerCase().includes(_locationQuery)
        );
    }

    renderJobs(filtered);
}

function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
