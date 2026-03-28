// Applications - Multi-Step Wizard
let currentStep = 1;
let maxStep = 1;
let selectedFile = null;
let analysisData = null;
let searchResults = [];
let selectedJobs = new Set();
let activeFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
    // auth-guard.js gère déjà la redirection si non connecté
    setupFileUpload();
});

// =============================================
// STEP NAVIGATION
// =============================================
function goToStep(step) {
    if (step > maxStep) return; // Can't skip forward beyond completed

    currentStep = step;

    // Update wizard indicators
    document.querySelectorAll('.step-wizard-item').forEach(item => {
        const s = parseInt(item.dataset.step);
        item.classList.remove('active', 'completed');
        if (s === currentStep) item.classList.add('active');
        else if (s < currentStep) item.classList.add('completed');
    });

    // Update connectors
    document.querySelectorAll('.step-wizard-connector').forEach((c, i) => {
        c.classList.toggle('active', i + 1 < currentStep);
    });

    // Show correct panel with animation
    document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(`step-${step}`);
    panel.classList.add('active');
    // Re-trigger animation
    panel.style.animation = 'none';
    panel.offsetHeight; // Force reflow
    panel.style.animation = '';
}

// =============================================
// STEP 1: FILE UPLOAD
// =============================================
function setupFileUpload() {
    const dropzone = document.getElementById('cv-upload-area');
    const input = document.getElementById('cv-file-input');
    const startBtn = document.getElementById('start-analysis-btn');
    const removeBtn = document.getElementById('remove-file-btn');

    if (!dropzone || !input) return;

    // Handle Dropzone Click
    dropzone.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        if (selectedFile) return;
        input.click();
    });

    // Handle Drag & Drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (selectedFile) return;
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (selectedFile) return;
        if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    });

    // Handle File Selection (Standard Input)
    input.addEventListener('change', () => {
        if (input.files.length) handleFile(input.files[0]);
    });

    // Handle Buttons
    if (startBtn) {
        startBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            startAnalysis();
        };
    }

    if (removeBtn) {
        removeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeFile();
        };
    }
}

function handleFile(file) {
    if (file.type !== 'application/pdf') {
        showToast('Veuillez s\u00e9lectionner un fichier PDF', 'error');
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        showToast('Le fichier doit faire moins de 10 MB', 'error');
        return;
    }
    selectedFile = file;
    document.getElementById('dropzone-content').classList.add('hidden');
    document.getElementById('file-preview').classList.remove('hidden');
    document.getElementById('file-name').textContent = file.name;
    document.getElementById('file-size').textContent = (file.size / 1024 / 1024).toFixed(2) + ' MB';
}

function removeFile() {
    selectedFile = null;
    document.getElementById('cv-file-input').value = '';
    document.getElementById('file-preview').classList.add('hidden');
    document.getElementById('dropzone-content').classList.remove('hidden');
}

// =============================================
// STEP 2: AI ANALYSIS (REAL PROGRESS)
// =============================================
async function startAnalysis() {
    if (!selectedFile) return;

    maxStep = 2;
    goToStep(2);

    // Show loading
    document.getElementById('analysis-loading').classList.remove('hidden');
    document.getElementById('analysis-results').classList.add('hidden');

    const bar = document.getElementById('analysis-bar');
    const statusText = document.getElementById('analysis-status-text');

    function setProgress(text, percent) {
        statusText.textContent = text;
        bar.style.width = percent + '%';
    }

    try {
        // Step 1: Prepare file
        setProgress('Pr\u00e9paration du fichier (' + (selectedFile.size / 1024).toFixed(0) + ' KB)...', 10);
        const formData = new FormData();
        formData.append('cv', selectedFile);

        // Step 2: Upload to Supabase + send to webhook
        setProgress('Upload du CV vers le serveur...', 25);

        const res = await API.analyzeCV(formData);

        // Step 3: Show real result
        if (res.profile && Object.keys(res.profile).length > 0) {
            setProgress('Analyse IA termin\u00e9e !', 100);
        } else {
            setProgress(res.analysis || 'Analyse termin\u00e9e', 100);
        }

        await delay(600);

        if (res.success) {
            analysisData = res;
            displayAnalysis(res);
            maxStep = 3;
        }
    } catch (e) {
        const msg = e?.message || e?.error || String(e);
        console.error('Analyse error:', msg, e);
        setProgress('❌ ' + msg, 0);
        showToast('Erreur analyse: ' + msg, 'error');
        setTimeout(() => goToStep(1), 4000);
    }
}

function displayAnalysis(data) {
    document.getElementById('analysis-loading').classList.add('hidden');
    document.getElementById('analysis-results').classList.remove('hidden');

    const p = data.profile || {};
    const skills = data.recommendations || p.skills || [];
    const name = p.name || '';
    const title = p.title || '';
    const summary = data.analysis || p.summary || '';
    const exp = p.experience_years != null ? p.experience_years : null;
    const education = p.education || '';
    const languages = p.languages || [];
    const jobTitles = p.job_titles || [];

    const initials = name ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : 'CV';

    const profile = document.getElementById('ai-profile');
    profile.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:1rem;">

        <!-- Header identité -->
        <div style="display:flex;align-items:center;gap:1rem;padding:1.25rem 1.5rem;background:linear-gradient(135deg,rgba(16,185,129,.1) 0%,rgba(20,184,166,.06) 100%);border:1px solid rgba(16,185,129,.2);border-radius:14px;">
          <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#059669,#10b981);display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:800;color:#fff;flex-shrink:0;box-shadow:0 0 20px rgba(16,185,129,.35);">${initials}</div>
          <div style="flex:1;min-width:0;">
            ${name ? `<div style="font-size:1.1rem;font-weight:700;color:#f0fdf8;margin-bottom:2px;">${name}</div>` : ''}
            ${title ? `<div style="font-size:0.82rem;color:#34d399;font-weight:500;">${title}</div>` : ''}
          </div>
          ${exp !== null ? `<div style="text-align:center;flex-shrink:0;"><div style="font-size:1.5rem;font-weight:800;color:#34d399;line-height:1;">${exp}</div><div style="font-size:0.65rem;color:#6b9e8e;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">ans exp.</div></div>` : ''}
        </div>

        <!-- Résumé -->
        ${summary ? `
        <div style="padding:1rem 1.25rem;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;">
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b9e8e;margin-bottom:0.5rem;">Profil</div>
          <p style="font-size:0.88rem;line-height:1.7;color:#a3c4bc;margin:0;">${summary}</p>
        </div>` : ''}

        <!-- Compétences -->
        ${skills.length > 0 ? `
        <div style="padding:1rem 1.25rem;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;">
          <div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b9e8e;margin-bottom:0.75rem;">Compétences</div>
          <div style="display:flex;flex-wrap:wrap;gap:0.4rem;">
            ${skills.map(s => `<span style="padding:.28rem .7rem;background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.25);border-radius:999px;font-size:.75rem;font-weight:600;color:#34d399;">${s}</span>`).join('')}
          </div>
        </div>` : ''}

        <!-- Infos complémentaires -->
        ${(education || languages.length > 0 || jobTitles.length > 0) ? `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:0.75rem;">
          ${education ? `<div style="padding:.9rem 1rem;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;"><div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b9e8e;margin-bottom:.35rem;">Formation</div><div style="font-size:.8rem;color:#a3c4bc;">${education}</div></div>` : ''}
          ${languages.length > 0 ? `<div style="padding:.9rem 1rem;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;"><div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b9e8e;margin-bottom:.35rem;">Langues</div><div style="font-size:.8rem;color:#a3c4bc;">${languages.join(', ')}</div></div>` : ''}
          ${jobTitles.length > 0 ? `<div style="padding:.9rem 1rem;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;"><div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6b9e8e;margin-bottom:.35rem;">Postes recherchés</div><div style="font-size:.8rem;color:#a3c4bc;">${jobTitles.slice(0,3).join(', ')}</div></div>` : ''}
        </div>` : ''}

      </div>
    `;
}

// =============================================
// STEP 3: SEARCH RESULTS
// =============================================
function computeCompatibility(job, profile) {
    let score = 0;
    const jobTitle = (job.title || '').toLowerCase();
    const jobDesc = (job.description || '').toLowerCase();
    const jobSkillsArr = (job.skills || []).map(s => (typeof s === 'string' ? s : s.name || '').toLowerCase());
    const allJobText = jobTitle + ' ' + jobDesc + ' ' + jobSkillsArr.join(' ');

    // Title match (40pts)
    const jobTitles = profile.job_titles || [];
    const keywords = profile.search_keywords || [];
    const allProfileTitles = [...jobTitles, ...keywords].map(t => t.toLowerCase());
    const titleHit = allProfileTitles.some(t => allJobText.includes(t) || t.includes(jobTitle.split(' ')[0]));
    if (titleHit) score += 40;
    else if (allProfileTitles.some(t => allJobText.split(' ').some(w => t.includes(w) && w.length > 3))) score += 18;

    // Skills match (60pts)
    const profileSkills = (profile.skills || []).map(s => s.toLowerCase());
    const matchedSkills = [];
    for (const skill of profileSkills) {
        if (skill.length > 2 && allJobText.includes(skill)) matchedSkills.push(skill);
    }
    if (profileSkills.length > 0) {
        score += Math.round((matchedSkills.length / Math.min(profileSkills.length, 8)) * 60);
    }

    // Clamp between 28-97
    score = Math.min(97, Math.max(28, score));
    return { score, matchedSkills: matchedSkills.slice(0, 4) };
}

async function startSearch() {
    maxStep = 3;
    goToStep(3);
    selectedJobs.clear();
    activeFilter = 'all';

    document.getElementById('search-loading').classList.remove('hidden');
    document.getElementById('search-results').classList.add('hidden');

    // Reset loading steps
    ['astep-1','astep-2','astep-3','astep-4'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active','done');
    });

    function stepActive(id) {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('done'); el.classList.add('active'); }
    }
    function stepDone(id) {
        const el = document.getElementById(id);
        if (el) { el.classList.remove('active'); el.classList.add('done'); }
    }

    try {
        // Step 1: Read profile
        stepActive('astep-1');
        const profile = (analysisData && analysisData.profile) ? analysisData.profile : {};
        await delay(600);
        stepDone('astep-1');

        // Step 2: AI searches the web for jobs
        stepActive('astep-2');
        const apiKey = localStorage.getItem('wjob_anthropic_key') || '';
        const searchRes = await fetch('/api/search-jobs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ profile, apiKey })
        });
        if (!searchRes.ok) {
            const err = await searchRes.json().catch(() => ({}));
            throw new Error(err.error || 'Erreur recherche emplois');
        }
        const searchData = await searchRes.json();
        const jobs = searchData.jobs || [];
        stepDone('astep-2');

        // Step 3: Compute compatibility
        stepActive('astep-3');

        searchResults = jobs.map(job => {
            const compat = computeCompatibility(job, profile);
            const slug = (job.company || 'entreprise').toLowerCase().replace(/[^a-z0-9]/g, '');
            return {
                id: job.id,
                title: job.title,
                company: job.company,
                location: job.location || 'Non spécifié',
                contract: job.contract_type || 'CDI',
                description: job.description || '',
                salary: job.salary || null,
                source: job.source || null,
                recruiter: {
                    name: job.recruiter_name || 'Service RH',
                    email: job.recruiter_email || `recrutement@${slug}.com`
                },
                skills: (job.skills || []).slice(0, 6).map(s => typeof s === 'string' ? s : s.name || s),
                score: compat.score,
                matchedSkills: compat.matchedSkills
            };
        });

        // Sort by score desc
        searchResults.sort((a, b) => b.score - a.score);
        await delay(400);
        stepDone('astep-3');

        // Step 4: Recruiter info
        stepActive('astep-4');
        await delay(350);
        stepDone('astep-4');
        await delay(250);

        // Show results
        document.getElementById('search-loading').classList.add('hidden');
        document.getElementById('search-results').classList.remove('hidden');

        // Reset filter pills to "Toutes"
        document.querySelectorAll('.sr-pill').forEach(p => p.classList.remove('active'));
        const allPill = document.querySelector('.sr-pill[data-filter="all"]');
        if (allPill) allPill.classList.add('active');

        document.getElementById('results-count').textContent =
            searchResults.length > 0
                ? `${searchResults.length} offre(s) trouvée(s) par l'IA`
                : 'Aucune offre trouvée';

        renderResults();
        setupFilters();

    } catch (e) {
        const msg = e?.message || e?.details || (typeof e === 'string' ? e : JSON.stringify(e));
        console.error('Search error:', msg, e);
        document.getElementById('search-loading').classList.add('hidden');
        document.getElementById('search-results').classList.remove('hidden');
        document.getElementById('results-count').textContent = 'Erreur de chargement';
        const errEl = document.getElementById('sr-error');
        if (errEl) {
            errEl.classList.remove('hidden');
            const sub = errEl.querySelector('.sr-state-sub');
            if (sub && msg) sub.textContent = msg;
        }
        showToast('Erreur recherche : ' + msg, 'error');
    }
}

function renderResults() {
    const grid = document.getElementById('results-grid');
    // Clear only result cards (preserve empty/error state divs)
    grid.querySelectorAll('.result-card').forEach(c => c.remove());

    const emptyEl = document.getElementById('sr-empty');
    const errorEl = document.getElementById('sr-error');
    if (emptyEl) emptyEl.classList.add('hidden');
    if (errorEl) errorEl.classList.add('hidden');

    let list = searchResults;
    if (activeFilter === 'top') {
        list = list.filter(j => j.score >= 75);
    } else if (['CDI','CDD','Alternance'].includes(activeFilter)) {
        list = list.filter(j => (j.contract || '').toLowerCase() === activeFilter.toLowerCase());
    }

    if (list.length === 0) {
        if (emptyEl) {
            const sub = emptyEl.querySelector('.sr-state-sub');
            if (sub) sub.textContent = activeFilter === 'all'
                ? 'Aucune offre disponible pour le moment.'
                : 'Aucun résultat pour ce filtre. Essayez "Toutes".';
            emptyEl.classList.remove('hidden');
        }
        document.getElementById('results-count').textContent = '0 résultat';
        return;
    }

    document.getElementById('results-count').textContent =
        `${list.length} offre(s)${activeFilter !== 'all' ? ' filtrées' : ' — triées par compatibilité'}`;

    list.forEach((job, i) => {
        const compatClass = job.score >= 75 ? 'high' : job.score >= 50 ? 'mid' : 'low';
        const isSelected = selectedJobs.has(job.id);

        const card = document.createElement('div');
        card.className = `result-card${isSelected ? ' selected' : ''}`;
        card.dataset.jobId = job.id;
        card.style.opacity = '0';
        card.onclick = () => toggleJobSelection(job.id, card);

        card.innerHTML = `
            <div class="rc-top">
                <div>
                    <div class="rc-company">${job.company}</div>
                    <div class="rc-title">${job.title}</div>
                </div>
                <div class="rc-compat ${compatClass}">${job.score}%</div>
            </div>
            <div class="rc-meta">
                <span class="rc-meta-item">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    ${job.location}
                </span>
                <span class="rc-contract">${job.contract}</span>
            </div>
            ${job.matchedSkills.length > 0 ? `
            <div class="rc-skills">
                ${job.matchedSkills.map(s => `<span class="rc-skill">${s}</span>`).join('')}
            </div>` : ''}
            <div class="rc-footer">
                <div class="rc-recruiter">
                    <div class="rc-avatar">${job.recruiter.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="rc-rec-name">${job.recruiter.name}</div>
                        <div class="rc-rec-email">${job.recruiter.email}</div>
                    </div>
                </div>
                <div class="rc-check">
                    <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
            </div>
        `;

        grid.appendChild(card);

        setTimeout(() => {
            card.style.transition = 'opacity .35s ease, transform .35s cubic-bezier(.16,1,.3,1)';
            card.style.opacity = '1';
        }, i * 55);
    });
}

function toggleJobSelection(id, card) {
    if (!card) card = document.querySelector(`.result-card[data-job-id="${id}"]`);

    if (selectedJobs.has(id)) {
        selectedJobs.delete(id);
        if (card) card.classList.remove('selected');
    } else {
        selectedJobs.add(id);
        if (card) card.classList.add('selected');
    }

    const count = selectedJobs.size;
    document.getElementById('selected-count').textContent = count;
    document.getElementById('apply-selected-btn').disabled = count === 0;
}

function setupFilters() {
    document.querySelectorAll('.sr-pill').forEach(pill => {
        pill.onclick = () => {
            document.querySelectorAll('.sr-pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            activeFilter = pill.dataset.filter;
            renderResults();
        };
    });
}

// =============================================
// STEP 4: APPLY
// =============================================
// Crée les candidatures sélectionnées (statut draft) et redirige vers /candidatures
async function applySelectedJobs() {
    const btn = document.getElementById('apply-selected-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Envoi en cours…'; }

    const selected = searchResults.filter(j => selectedJobs.has(j.id));
    let ok = 0;

    for (const job of selected) {
        try {
            await API.createApplication({ jobId: job.id, status: 'draft', notes: '' });
            ok++;
        } catch (e) {
            console.error('Apply error:', e);
        }
    }

    showToast(`${ok} candidature(s) créée(s) ! Redirection…`, 'success');
    setTimeout(() => { window.location.href = '/candidatures'; }, 1800);
}

// =============================================
// UTILITY
// =============================================
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
