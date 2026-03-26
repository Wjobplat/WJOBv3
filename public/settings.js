// Settings page - API-powered
document.addEventListener('DOMContentLoaded', async function () {
    const user = await requireAuth();
    if (!user) return;
    console.log('[W-JOB] Tip: Visit settings.html?admin=1 to enable all administrative features if you are not role:admin in Supabase.');
    loadProfile();
    loadConfig();
    loadLogs();
    loadConsent();
    checkAdminAccess();
});

async function loadProfile() {
    try {
        const user = await API.getMe();
        document.getElementById('profile-firstname').value = user.firstName || '';
        document.getElementById('profile-lastname').value = user.lastName || '';
        document.getElementById('profile-email').value = user.email || '';
    } catch (e) {
        console.error('Profile load error:', e);
    }
}

async function saveProfile() {
    const statusEl = document.getElementById('profile-status');
    try {
        statusEl.textContent = 'Enregistrement...';
        statusEl.style.color = 'var(--color-text-secondary)';
        await API.updateProfile({
            firstName: document.getElementById('profile-firstname').value.trim(),
            lastName: document.getElementById('profile-lastname').value.trim(),
            email: document.getElementById('profile-email').value.trim()
        });
        showToast('Profil mis \u00e0 jour avec succ\u00e8s', 'success');
        statusEl.textContent = '\u2713 Enregistr\u00e9';
        statusEl.style.color = 'var(--color-primary)';
        setTimeout(() => { statusEl.textContent = ''; }, 3000);
    } catch (e) {
        showToast(e.message || 'Erreur lors de la sauvegarde', 'error');
        statusEl.textContent = '\u2717 Erreur';
        statusEl.style.color = 'var(--color-danger)';
    }
}


async function checkAdminAccess() {
    try {
        const isAdmin = await API.isAdmin();
        if (isAdmin) {
            const adminSection = document.getElementById('admin-section');
            if (adminSection) adminSection.style.display = 'block';
        }
    } catch (e) { console.error('Admin check failed', e); }
}

async function loadConfig() {
    // Always set the incoming URL immediately, regardless of API status
    const siteUrl = window.location.origin;
    const incomingEl = document.getElementById('incoming-url');

    try {
        const user = await API.getMe();
        if (incomingEl && user && user.id) {
            incomingEl.textContent = `${siteUrl}/api/webhook?user_id=${user.id}`;
        } else if (incomingEl) {
            incomingEl.textContent = `${siteUrl}/api/webhook`;
        }

        const config = await API.getWebhookConfig();
        document.getElementById('outgoing-url').value = config.outgoingUrl || '';
        document.getElementById('webhook-secret').value = config.secret || '';
        document.getElementById('webhook-enabled').checked = !!config.enabled;

        const events = config.events || {};
        const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
        setCheck('evt-job-created', events['job.created']);
        setCheck('evt-recruiter-found', events['recruiter.found']);
        setCheck('evt-app-generated', events['application.generated']);
        setCheck('evt-status-changed', events['application.status_changed']);
    } catch (e) {
        console.warn('Webhook config not available (table may not exist yet):', e.message);
        // Set sensible defaults so the UI is not stuck on "Chargement..."
        if (incomingEl) incomingEl.textContent = `${siteUrl}/api/webhook`;
        const outEl = document.getElementById('outgoing-url');
        if (outEl) outEl.value = '';
        const secEl = document.getElementById('webhook-secret');
        if (secEl) secEl.value = 'wjob_sec_' + Math.random().toString(36).substr(2, 9);
        const enEl = document.getElementById('webhook-enabled');
        if (enEl) enEl.checked = false;
    }
}

async function saveConfig() {
    try {
        await API.saveWebhookConfig({
            outgoingUrl: document.getElementById('outgoing-url').value,
            secret: document.getElementById('webhook-secret').value,
            enabled: document.getElementById('webhook-enabled').checked,
            events: {
                'job.created': document.getElementById('evt-job-created').checked,
                'recruiter.found': document.getElementById('evt-recruiter-found').checked,
                'application.generated': document.getElementById('evt-app-generated').checked,
                'application.status_changed': document.getElementById('evt-status-changed').checked
            }
        });
        showToast('Configuration webhook enregistr\u00e9e', 'success');
    } catch (e) {
        console.error('Webhook save error:', e);
        showToast('Erreur: ' + (e.message || 'Sauvegarde impossible'), 'error');
    }
}

async function testWebhook() {
    try {
        const result = await API.testWebhook();
        if (result.success) showToast('Test webhook r\u00e9ussi !', 'success');
        else showToast(result.message || 'Test \u00e9chou\u00e9', 'warning');
        loadLogs();
    } catch (e) {
        console.error('Webhook test error:', e);
        showToast('Erreur du test: ' + (e.message || ''), 'error');
    }
}

function copySecret() {
    const secret = document.getElementById('webhook-secret').value;
    navigator.clipboard.writeText(secret).then(() => showToast('Secret copi\u00e9 !', 'success'));
}

async function loadLogs() {
    try {
        const logs = await API.getWebhookLogs();
        const container = document.getElementById('webhook-logs');
        if (!logs.length) { container.innerHTML = '<p style="text-align: center; color: var(--color-text-muted); padding: var(--space-lg);">Aucun \u00e9v\u00e9nement enregistr\u00e9</p>'; return; }
        container.innerHTML = '';
        logs.forEach(log => {
            const div = document.createElement('div');
            div.className = 'log-item';
            div.innerHTML = `
                <div class="log-status ${log.status}"></div>
                <span>${log.direction === 'incoming' ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="7 13 12 18 17 13"></polyline><line x1="12" y1="6" x2="12" y2="18"></line></svg>' : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 11 12 6 7 11"></polyline><line x1="12" y1="18" x2="12" y2="6"></line></svg>'}</span>
                <span class="log-event">${log.event}</span>
                <span style="color: var(--color-text-secondary); font-size: 0.8rem; flex: 1;">${log.details || ''}</span>
                <span class="log-time">${formatRelativeTime(log.timestamp)}</span>
            `;
            container.appendChild(div);
        });
    } catch (e) { console.error('Log load error:', e); }
}

async function loadConsent() {
    try {
        const consent = await API.getConsent();
        document.getElementById('consent-processing').checked = consent.dataProcessing;
        document.getElementById('consent-analytics').checked = consent.analytics;
        document.getElementById('consent-webhook').checked = consent.webhookSharing;
    } catch (e) { console.error('Consent load error:', e); }
}

async function saveConsent() {
    try {
        await API.saveConsent({
            dataProcessing: document.getElementById('consent-processing').checked,
            analytics: document.getElementById('consent-analytics').checked,
            webhookSharing: document.getElementById('consent-webhook').checked
        });
        showToast('Consentements mis \u00e0 jour', 'success');
    } catch (e) { showToast('Erreur de sauvegarde', 'error'); }
}

async function exportData() {
    try {
        await API.exportData();
        showToast('Export t\u00e9l\u00e9charg\u00e9', 'success');
    } catch (e) {
        showToast("Erreur lors de l'export", 'error');
    }
}

async function deleteData() {
    if (!confirm('ATTENTION : Cette action est irr\u00e9versible.\nToutes vos donn\u00e9es seront supprim\u00e9es.\n\n\u00cates-vous s\u00fbr de vouloir continuer ?')) return;
    if (!confirm('Derni\u00e8re confirmation : voulez-vous vraiment supprimer TOUTES vos donn\u00e9es ?')) return;
    try {
        const result = await API.deleteData();
        showToast(result.message, 'success');
        setTimeout(() => window.location.href = 'index.html', 2000);
    } catch (e) { showToast('Erreur de suppression', 'error'); }
}
