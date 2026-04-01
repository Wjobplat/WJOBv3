// apply.js — W-JOB Candidature wizard
// Page : /apply?job_id=xxx   (optionnel: &app_id=xxx pour reprendre un brouillon)

let _jobId   = null;
let _appId   = null;
let _job     = null;
let _profile = null;
let _hasCV   = false;
let _saveTimer = null;
let _saving  = false;

// ── Init ──────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(location.search);
    _jobId = params.get('job_id');
    const existingAppId = params.get('app_id');

    if (!_jobId) {
        showToast('Aucune offre sélectionnée.', 'error');
        setTimeout(() => location.href = '/jobs', 1500);
        return;
    }

    try {
        // Charger l'offre + le profil en parallèle
        const [job, me] = await Promise.all([
            API.getJobById(_jobId),
            API.getMe()
        ]);
        _job     = job;
        _profile = enrichProfile(me);

        renderJobCard(_job);
        updateAvatar(_profile);

        // Chercher brouillon existant
        const existing = existingAppId
            ? { id: existingAppId }
            : await API.getApplicationByJobId(_jobId);

        if (existing) {
            _appId = existing.id;
            // Charger les données du brouillon
            const apps = await API.getApplications();
            const app  = apps.find(a => a.id === _appId);
            if (app) {
                if (app.coverLetter) {
                    document.getElementById('letter-textarea').value = app.coverLetter;
                    updateLetterUI(app.coverLetter);
                }
                if (app.cv_path) {
                    _hasCV = true;
                    showCVStatus(app.cv_path);
                }
                if (app.customEmail) {
                    document.getElementById('email-subject').value = app.customEmail.split('\n')[0].replace(/^Objet\s*:\s*/i, '');
                    document.getElementById('email-body').value = app.customEmail.split('\n').slice(1).join('\n').trim();
                    document.getElementById('email-preview').classList.remove('hidden');
                }
            }
            updateStatus('draft');
            showSaveIndicator('Brouillon chargé');
        } else {
            // Créer un nouveau brouillon
            const result = await API.createApplication({ jobId: _jobId, status: 'draft' });
            _appId = result.id;
            updateStatus('draft');
        }

        updateSendBtn();
    } catch (e) {
        console.error('[apply] init error:', e);
        const msg = e?.message || 'Erreur de chargement.';
        document.getElementById('job-card').innerHTML = `
          <div style="display:flex;align-items:center;gap:.75rem;color:#f87171;font-size:.85rem">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:18px;height:18px;flex-shrink:0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            ${esc(msg)} — <a href="/jobs" style="color:#f87171;text-decoration:underline">Retour aux emplois</a>
          </div>`;
        showToast(msg, 'error');
    }

    initEvents();
    initTheme();
});

// ── Job card ──────────────────────────────────────────────
function renderJobCard(job) {
    const initials = (job.company || 'E').substring(0, 2).toUpperCase();
    const score = job.compatibility ? Math.round(job.compatibility) + '%' : null;
    const tags = [job.contractType, job.location ? job.location.split(/[·,]/)[0].trim() : null, job.remote ? 'Télétravail' : null].filter(Boolean);

    document.getElementById('job-card').innerHTML = `
      <div class="jc-top">
        <div class="jc-logo">${initials}</div>
        <div class="jc-info">
          <div class="jc-title">${esc(job.title)}</div>
          <div class="jc-company">${esc(job.company)}${job.location ? ' · ' + esc(job.location.split(/[·,]/)[0].trim()) : ''}</div>
          <div class="jc-tags">
            ${tags.map(t => `<span class="jc-tag">${esc(t)}</span>`).join('')}
            ${job.salary ? `<span class="jc-tag jc-tag-salary">${esc(job.salary)}</span>` : ''}
            ${score ? `<span class="jc-tag jc-tag-score">${score} match</span>` : ''}
          </div>
        </div>
      </div>
      ${job.description ? `
      <div class="jc-desc-toggle" id="desc-toggle" onclick="toggleDesc()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        Voir la description du poste
      </div>
      <div class="jc-desc hidden" id="job-desc">${esc(job.description)}</div>
      ` : ''}`;
}

window.toggleDesc = function () {
    const desc = document.getElementById('job-desc');
    const btn  = document.getElementById('desc-toggle');
    if (!desc) return;
    const open = !desc.classList.contains('hidden');
    desc.classList.toggle('hidden', open);
    btn.innerHTML = open
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg> Voir la description`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg> Masquer la description`;
};

// ── CV ────────────────────────────────────────────────────
function initEvents() {
    // CV upload
    const dropzone = document.getElementById('cv-dropzone');
    const input    = document.getElementById('cv-input');

    if (dropzone) {
        dropzone.addEventListener('click', () => !_hasCV && input.click());
        dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragover'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', e => {
            e.preventDefault(); dropzone.classList.remove('dragover');
            if (e.dataTransfer.files[0]) handleCVFile(e.dataTransfer.files[0]);
        });
    }
    if (input) input.addEventListener('change', () => input.files[0] && handleCVFile(input.files[0]));

    document.getElementById('cv-remove-btn')?.addEventListener('click', removeCV);

    // Lettre
    const textarea = document.getElementById('letter-textarea');
    if (textarea) {
        textarea.addEventListener('input', () => {
            updateLetterUI(textarea.value);
            scheduleSave();
        });
    }

    // AI letter buttons
    document.getElementById('gen-letter-btn')?.addEventListener('click', () => letterAction('generate'));
    document.getElementById('improve-btn')?.addEventListener('click', () => letterAction('improve'));
    document.getElementById('shorten-btn')?.addEventListener('click', () => letterAction('shorten'));
    document.getElementById('punch-btn')?.addEventListener('click', () => letterAction('punch'));

    // Email
    document.getElementById('gen-email-btn')?.addEventListener('click', generateEmail);
    document.getElementById('copy-email-btn')?.addEventListener('click', copyEmail);
    document.getElementById('claude-btn')?.addEventListener('click', rewriteForClaude);
    document.getElementById('email-subject')?.addEventListener('input', scheduleSave);
    document.getElementById('email-body')?.addEventListener('input', scheduleSave);

    // Actions
    document.getElementById('send-btn')?.addEventListener('click', sendApplication);
    document.getElementById('delete-btn')?.addEventListener('click', deleteApplication);
    document.getElementById('back-btn')?.addEventListener('click', () => location.href = '/jobs');
}

async function handleCVFile(file) {
    const allowed = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type) && !file.name.match(/\.(pdf|doc|docx)$/i)) {
        showToast('Format accepté : PDF, DOC, DOCX', 'error'); return;
    }
    if (file.size > 5 * 1024 * 1024) { showToast('Fichier trop lourd (max 5 Mo)', 'error'); return; }

    const dropzone = document.getElementById('cv-dropzone');
    dropzone.innerHTML = `<div class="dz-loading"><div class="spin"></div> Envoi en cours…</div>`;

    try {
        const formData = new FormData();
        formData.append('cv', file);
        await API.uploadCV(_appId, formData);
        _hasCV = true;
        showCVStatus(file.name);
        updateSendBtn();
        showSaveIndicator('CV enregistré');
        showToast('CV enregistré', 'success');
    } catch (e) {
        console.error('[apply] CV upload error:', e);
        showToast('Erreur upload CV', 'error');
        resetCVDropzone();
    }
}

function showCVStatus(filename) {
    const dropzone = document.getElementById('cv-dropzone');
    dropzone.innerHTML = `
      <div class="cv-file-row">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span class="cv-fname">${esc(typeof filename === 'string' ? filename.split('/').pop() : 'CV')}</span>
        <span class="cv-ok">✓ Enregistré</span>
        <button id="cv-remove-btn" class="cv-remove" title="Supprimer">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
    document.getElementById('cv-remove-btn')?.addEventListener('click', removeCV);
    document.getElementById('cv-check').innerHTML = `<span style="color:#10b981">✓</span>`;
}

function removeCV() {
    _hasCV = false;
    resetCVDropzone();
    document.getElementById('cv-check').innerHTML = `<span style="color:var(--muted)">—</span>`;
    updateSendBtn();
}

function resetCVDropzone() {
    document.getElementById('cv-dropzone').innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width:32px;height:32px;color:var(--em);margin-bottom:.75rem"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <div class="dz-text"><strong>Glissez votre CV ici</strong> ou cliquez pour sélectionner</div>
      <div class="dz-sub">PDF, DOC, DOCX · max 5 Mo</div>
      <input type="file" id="cv-input" accept=".pdf,.doc,.docx" style="display:none">`;
    document.getElementById('cv-input')?.addEventListener('change', e => e.target.files[0] && handleCVFile(e.target.files[0]));
}

// ── Lettre de motivation ──────────────────────────────────
async function letterAction(action) {
    if (!_job) {
        showToast('Offre non chargée. Revenez depuis la liste des emplois.', 'error');
        return;
    }

    const textarea  = document.getElementById('letter-textarea');
    const loadEl    = document.getElementById('letter-loading');
    const current   = textarea.value.trim();

    if (action !== 'generate' && !current) {
        showToast('Écrivez ou générez d\'abord une lettre.', 'error'); return;
    }

    setLetterBtnsDisabled(true);
    loadEl.classList.remove('hidden');
    textarea.style.opacity = '.4';

    try {
        const res = await fetch('/api/generate-letter', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job: _job, profile: _profile, currentLetter: current, action })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        textarea.value = data.letter;
        updateLetterUI(data.letter);
        scheduleSave();
        showToast(action === 'generate' ? 'Lettre générée ✓' : 'Lettre mise à jour ✓', 'success');
    } catch (e) {
        console.error('[apply] letter error:', e);
        showToast('Erreur IA. Réessayez.', 'error');
    } finally {
        setLetterBtnsDisabled(false);
        loadEl.classList.add('hidden');
        textarea.style.opacity = '1';
    }
}

function setLetterBtnsDisabled(d) {
    ['gen-letter-btn','improve-btn','shorten-btn','punch-btn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = d;
    });
}

function updateLetterUI(text) {
    const count = document.getElementById('char-count');
    if (count) count.textContent = text.length;

    const hasText = text.length > 20;
    ['improve-btn','shorten-btn','punch-btn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = !hasText;
    });
    document.getElementById('letter-check').innerHTML = hasText
        ? `<span style="color:#10b981">✓</span>`
        : `<span style="color:var(--muted)">—</span>`;
    updateSendBtn();
}

// ── Email ─────────────────────────────────────────────────
async function generateEmail() {
    const btn = document.getElementById('gen-email-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin-sm"></span> Génération…';

    try {
        const res = await fetch('/api/generate-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job: _job, profile: _profile })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        const lines = data.email.split('\n');
        const subjectLine = lines.find(l => l.toLowerCase().startsWith('objet'));
        const subject = subjectLine ? subjectLine.replace(/^objet\s*:\s*/i, '').trim() : `Candidature – ${_job.title}`;
        const body = lines.filter(l => !l.toLowerCase().startsWith('objet')).join('\n').trim();

        document.getElementById('email-subject').value = subject;
        document.getElementById('email-body').value = body;
        document.getElementById('email-preview').classList.remove('hidden');
        scheduleSave();
        showToast('Email généré ✓', 'success');
    } catch (e) {
        showToast('Erreur génération email', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '✨ Générer l\'email';
    }
}

function copyEmail() {
    const subj = document.getElementById('email-subject')?.value || '';
    const body = document.getElementById('email-body')?.value || '';
    navigator.clipboard.writeText(`Objet : ${subj}\n\n${body}`).then(() => showToast('Copié !', 'success'));
}

function rewriteForClaude() {
    const subj = document.getElementById('email-subject')?.value || '';
    const body = document.getElementById('email-body')?.value || '';
    const prompt = `Voici un email de candidature pour le poste de ${_job?.title || 'ce poste'} chez ${_job?.company || 'cette entreprise'}. Améliore-le pour qu'il soit plus percutant, personnel et mémorable. Garde la même structure (objet + corps). En français.\n\nObjet : ${subj}\n\n${body}`;
    navigator.clipboard.writeText(prompt).then(() => showToast('Prompt copié — collez-le dans Claude.ai ✓', 'success'));
}

// ── Auto-save ─────────────────────────────────────────────
function scheduleSave() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(autosave, 2000);
    document.getElementById('save-indicator').textContent = 'Non sauvegardé…';
}

async function autosave() {
    if (!_appId || _saving) return;
    _saving = true;
    try {
        await API.updateApplication(_appId, {
            coverLetter: document.getElementById('letter-textarea')?.value || '',
            customEmail: buildEmailString()
        });
        showSaveIndicator('Sauvegardé automatiquement');
    } catch (e) {
        console.warn('[apply] autosave failed:', e);
    } finally {
        _saving = false;
    }
}

function buildEmailString() {
    const subj = document.getElementById('email-subject')?.value || '';
    const body = document.getElementById('email-body')?.value || '';
    if (!subj && !body) return '';
    return `Objet : ${subj}\n\n${body}`;
}

function showSaveIndicator(msg) {
    const el = document.getElementById('save-indicator');
    if (el) {
        el.textContent = msg;
        el.style.color = 'var(--em-l)';
        setTimeout(() => { el.style.color = ''; }, 3000);
    }
}

// ── Envoi ─────────────────────────────────────────────────
function updateSendBtn() {
    const letter = document.getElementById('letter-textarea')?.value.trim() || '';
    const ready  = _hasCV && letter.length > 20;
    const btn    = document.getElementById('send-btn');
    if (btn) {
        btn.disabled = !ready;
        btn.title    = ready ? '' : 'CV et lettre de motivation requis';
    }
    updateStatus(ready ? 'ready' : 'draft');
}

async function sendApplication() {
    const letter = document.getElementById('letter-textarea')?.value.trim() || '';
    if (!_hasCV) { showToast('Ajoutez votre CV avant d\'envoyer.', 'error'); return; }
    if (letter.length < 20) { showToast('Ajoutez une lettre de motivation.', 'error'); return; }

    const btn = document.getElementById('send-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin-sm"></span> Envoi…';

    try {
        // Sauvegarder une dernière fois
        await API.updateApplication(_appId, { coverLetter: letter, customEmail: buildEmailString() });
        await API.updateApplicationStatus(_appId, 'sent');
        updateStatus('sent');
        showToast('Candidature envoyée ! ✓', 'success');
        setTimeout(() => location.href = '/candidatures', 1800);
    } catch (e) {
        console.error('[apply] send error:', e);
        showToast('Erreur lors de l\'envoi.', 'error');
        btn.disabled = false;
        btn.innerHTML = 'Envoyer la candidature';
    }
}

async function deleteApplication() {
    if (!confirm('Supprimer ce brouillon définitivement ?')) return;
    try {
        await API.deleteApplication(_appId);
        showToast('Brouillon supprimé.', 'success');
        setTimeout(() => location.href = '/jobs', 1200);
    } catch (e) {
        showToast('Erreur lors de la suppression.', 'error');
    }
}

// ── UI helpers ────────────────────────────────────────────
function updateStatus(s) {
    const badge = document.getElementById('status-badge');
    if (!badge) return;
    const cfg = {
        draft:  { label: 'Brouillon', cls: 'status-draft' },
        ready:  { label: 'Prêt à envoyer', cls: 'status-ready' },
        sent:   { label: 'Envoyé ✓', cls: 'status-sent' }
    };
    const c = cfg[s] || cfg.draft;
    badge.textContent = c.label;
    badge.className = 'status-badge ' + c.cls;
}

function updateAvatar(profile) {
    const av = document.getElementById('user-avatar');
    if (av && profile) av.textContent = (profile.name || profile.email || 'ME').substring(0, 2).toUpperCase();
}

function initTheme() {
    const root = document.documentElement;
    root.dataset.theme = localStorage.getItem('wjob-theme') || 'dark';
    function navBg() {
        const light = root.dataset.theme === 'light';
        const s = window.scrollY > 10;
        document.querySelector('.topnav').style.background = s
            ? (light ? 'rgba(240,253,248,.96)' : 'rgba(3,13,18,.9)')
            : (light ? 'rgba(240,253,248,.88)' : 'rgba(3,13,18,.75)');
    }
    document.getElementById('themeToggle')?.addEventListener('click', () => {
        const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
        const flash = document.getElementById('theme-flash');
        if (flash) { flash.className = next === 'light' ? 'flash-light' : 'flash-dark'; flash.addEventListener('animationend', () => flash.className = '', { once: true }); }
        root.dataset.theme = next;
        localStorage.setItem('wjob-theme', next);
        navBg();
    });
    window.addEventListener('scroll', navBg);
    document.getElementById('user-avatar')?.addEventListener('click', async () => {
        if (confirm('Se déconnecter ?')) { try { await API.logout(); } catch (e) {} location.href = '/login'; }
    });
}

// ── Enrichissement du profil ──────────────────────────────
// Fusionne les données Supabase auth avec le profil CV analysé (si dispo en localStorage)
function enrichProfile(me) {
    const base = me || {};
    try {
        const stored = localStorage.getItem('wjob_cv_profile');
        if (stored) {
            const cv = JSON.parse(stored);
            return {
                ...base,
                title:            cv.title            || base.title || '',
                skills:           cv.skills           || [],
                experience_years: cv.experience_years || 0,
                education:        cv.education        || '',
                summary:          cv.summary          || '',
                job_titles:       cv.job_titles       || [],
                languages:        cv.languages        || []
            };
        }
    } catch (e) {}
    return base;
}

function esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(message, type = 'info') {
    const c = document.getElementById('toast-container');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = message;
    c.appendChild(t);
    requestAnimationFrame(() => t.classList.add('toast-show'));
    setTimeout(() => { t.classList.remove('toast-show'); setTimeout(() => t.remove(), 300); }, 3500);
}
