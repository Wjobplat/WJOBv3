// Candidatures page - Search, Sort, Animated tabs & application listing
let allApplications = [];

document.addEventListener('DOMContentLoaded', async () => {
    const user = await requireAuth();
    if (!user) return;
    // Show skeleton loading
    showSkeletons();
    try {
        allApplications = await API.getApplications();
        updateCounts();
        renderApplications(allApplications);
        // Position the indicator on the first tab
        requestAnimationFrame(() => moveIndicator(document.querySelector('.animated-tab.active')));
    } catch (e) {
        console.error(e);
        showToast('Erreur de chargement des candidatures', 'error');
    }

    // Search input
    const searchInput = document.getElementById('search-candidatures');
    if (searchInput) {
        searchInput.addEventListener('input', () => applyFilters());
    }
    // Sort select
    const sortSelect = document.getElementById('sort-candidatures');
    if (sortSelect) {
        sortSelect.addEventListener('change', () => applyFilters());
    }
});

// =============================================
// SKELETON LOADING
// =============================================
function showSkeletons() {
    const container = document.getElementById('applications-container');
    if (!container) return;
    const grid = document.createElement('div');
    grid.className = 'job-grid';
    for (let i = 0; i < 6; i++) {
        const card = document.createElement('div');
        card.className = 'skeleton-card';
        card.innerHTML = `
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line"></div>
        `;
        grid.appendChild(card);
    }
    container.innerHTML = '';
    container.appendChild(grid);
}

// =============================================
// ANIMATED TAB INDICATOR
// =============================================
function moveIndicator(tabEl) {
    const indicator = document.getElementById('tab-indicator');
    const container = document.getElementById('tabs-container');
    if (!indicator || !tabEl || !container) return;

    const containerRect = container.getBoundingClientRect();
    const tabRect = tabEl.getBoundingClientRect();

    indicator.style.left = (tabRect.left - containerRect.left) + 'px';
    indicator.style.width = tabRect.width + 'px';
}

function filterByStatus(status, tabEl) {
    // Update active tab
    document.querySelectorAll('.animated-tab').forEach(t => t.classList.remove('active'));
    tabEl.classList.add('active');

    // Slide indicator
    moveIndicator(tabEl);

    // Apply all filters (status + search + sort)
    applyFilters(status);
}

// =============================================
// SEARCH & SORT
// =============================================
function applyFilters(statusOverride) {
    const activeTab = document.querySelector('.animated-tab.active');
    const status = statusOverride || (activeTab ? activeTab.dataset.status : 'all');

    const searchTerm = (document.getElementById('search-candidatures')?.value || '').toLowerCase();
    const sortBy = document.getElementById('sort-candidatures')?.value || 'date-desc';

    // Filter by status
    let filtered = status === 'all' ? [...allApplications] : allApplications.filter(a => a.status === status);

    // Filter by search
    if (searchTerm) {
        filtered = filtered.filter(a => {
            const company = (a.job?.company || '').toLowerCase();
            const title = (a.job?.title || '').toLowerCase();
            return company.includes(searchTerm) || title.includes(searchTerm);
        });
    }

    // Sort
    switch (sortBy) {
        case 'date-asc':
            filtered.sort((a, b) => new Date(a.createdDate || 0) - new Date(b.createdDate || 0));
            break;
        case 'date-desc':
            filtered.sort((a, b) => new Date(b.createdDate || 0) - new Date(a.createdDate || 0));
            break;
        case 'company':
            filtered.sort((a, b) => (a.job?.company || '').localeCompare(b.job?.company || ''));
            break;
        case 'status':
            filtered.sort((a, b) => (a.status || '').localeCompare(b.status || ''));
            break;
    }

    renderApplications(filtered);
}

// =============================================
// COUNTS
// =============================================
function updateCounts() {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('count-all',       allApplications.length);
    set('count-draft',     allApplications.filter(a => a.status === 'draft').length);
    set('count-pending',   allApplications.filter(a => a.status === 'pending').length);
    set('count-sent',      allApplications.filter(a => a.status === 'sent').length);
    set('count-responded', allApplications.filter(a => a.status === 'responded').length);
}

// =============================================
// RENDER
// =============================================
function renderApplications(apps) {
    const container = document.getElementById('applications-container');
    if (!container) return;
    container.innerHTML = '';

    if (apps.length === 0) {
        container.innerHTML = `
            <div class="card" style="text-align: center; padding: var(--space-2xl);">
                <div style="margin-bottom: var(--space-md); opacity: 0.3;">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                    </svg>
                </div>
                <p style="color: var(--color-text-muted); margin-bottom: var(--space-lg);">Aucune candidature trouvée.</p>
                <a href="applications.html" class="btn btn-primary">Démarrer une recherche</a>
            </div>`;
        return;
    }

    const grid = document.createElement('div');
    grid.className = 'job-grid';

    apps.forEach((app, i) => {
        const job = app.job || {};
        const statusLabels = {
            draft: 'Brouillon',
            pending: 'En attente',
            sent: 'Envoyée',
            responded: 'Réponse reçue',
            to_modify: 'À modifier'
        };

        const hasCv = app.cv_path ? `<span title="CV joint" style="margin-left:8px;display:inline-flex;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
            </svg>
        </span>` : '';
        const hasCover = app.cover_letter ? `<span title="Lettre de motivation" style="margin-left:4px;display:inline-flex;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
            </svg>
        </span>` : '';

        const card = document.createElement('div');
        card.className = 'job-card';
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';

        card.innerHTML = `
            <div class="job-card-header">
                <div>
                    <div class="job-company">${job.company || 'Entreprise'}</div>
                    <div class="job-title">${job.title || 'Poste'}</div>
                </div>
                <span class="badge badge-${app.status}">${statusLabels[app.status] || app.status}</span>
            </div>
            ${app.sentDate ? `<div class="job-detail" style="display:flex;align-items:center;gap:0.3rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                </svg>
                Envoyée le ${formatDate(app.sentDate)}
            </div>` : ''}
            ${app.responseDate ? `<div class="job-detail" style="display:flex;align-items:center;gap:0.3rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                Réponse le ${formatDate(app.responseDate)}
            </div>` : ''}
            <div class="job-detail" style="margin-left: auto;">${hasCv}${hasCover}</div>
            ${app.notes ? `<p style="color: var(--color-text-muted); font-size: 0.85rem; margin-bottom: var(--space-md); display:flex; align-items:center; gap:0.3rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
                ${app.notes}
            </p>` : ''}
            <div class="job-footer">
                <span></span>
                <a href="application-review.html?id=${app.id}" class="btn btn-primary btn-sm">Réviser</a>
            </div>
        `;

        grid.appendChild(card);

        // Staggered entrance animation
        setTimeout(() => {
            card.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, i * 80);
    });

    container.appendChild(grid);
}

// Handle window resize for indicator
window.addEventListener('resize', () => {
    const activeTab = document.querySelector('.animated-tab.active');
    if (activeTab) moveIndicator(activeTab);
});
