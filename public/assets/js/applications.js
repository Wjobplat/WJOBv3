// Applications - Multi-Step Wizard
let currentStep = 1;
let maxStep = 1;
let selectedFile = null;
let analysisData = null;
let searchResults = [];
let selectedJobs = new Set();

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
        console.error('Analyse error:', e);
        setProgress('Erreur', 0);
        showToast("Erreur lors de l'analyse: " + (e.message || ''), 'error');
        goToStep(1);
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
async function startSearch() {
    maxStep = 3;
    goToStep(3);

    document.getElementById('search-loading').classList.remove('hidden');
    document.getElementById('search-results').classList.add('hidden');

    try {
        // Fetch real jobs from Supabase
        const jobs = await API.getJobs();
        let recruiters = [];
        try { recruiters = await API.getRecruiters(); } catch (e) { /* table may not exist */ }

        // Map jobs to the format expected by the UI
        searchResults = jobs.map((job, i) => {
            // Try to find a matching recruiter by company name
            const recruiter = recruiters.find(r => r.company && job.company && r.company.toLowerCase() === job.company.toLowerCase())
                || { name: 'Recruteur', email: 'contact@' + (job.company || 'entreprise').toLowerCase().replace(/\s+/g, '') + '.com', linkedin: '' };

            return {
                id: job.id,
                title: job.title,
                company: job.company,
                location: job.location || 'Non sp\u00e9cifi\u00e9',
                contract: job.contractType || job.contract_type || 'CDI',
                description: job.description || 'Aucune description disponible.',
                recruiter: { name: recruiter.name, email: recruiter.email, linkedin: recruiter.linkedin || '' },
                strengths: (job.skills || []).slice(0, 3).map(s => typeof s === 'string' ? s : s.name || s),
                weaknesses: []
            };
        });

        document.getElementById('search-loading').classList.add('hidden');
        document.getElementById('search-results').classList.remove('hidden');

        if (searchResults.length === 0) {
            document.getElementById('results-count').textContent = "Aucun emploi trouv\u00e9. Ajoutez des offres dans l'onglet Emplois.";
        } else {
            document.getElementById('results-count').textContent = `${searchResults.length} r\u00e9sultat(s) trouv\u00e9(s)`;
        }

        renderResults();
    } catch (e) {
        console.error('Search error:', e);
        showToast('Erreur lors de la recherche', 'error');
        document.getElementById('search-loading').classList.add('hidden');
        document.getElementById('search-results').classList.remove('hidden');
        document.getElementById('results-count').textContent = 'Erreur de chargement des offres.';
    }
}

function renderResults() {
    const grid = document.getElementById('results-grid');
    grid.innerHTML = '';

    searchResults.forEach((job, i) => {
        const card = document.createElement('div');
        card.className = `result-card ${selectedJobs.has(job.id) ? 'selected' : ''}`;
        card.style.opacity = '0';
        card.onclick = () => toggleJobSelection(job.id);

        card.innerHTML = `
            <div style="margin-bottom: var(--space-lg);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: var(--space-sm);">
                    <div>
                        <div style="color: var(--color-text-secondary); font-size: 0.82rem; font-weight: 600;">${job.company}</div>
                        <div style="font-size: 1.1rem; font-weight: 700;">${job.title}</div>
                    </div>
                    <span class="badge badge-sent">${job.contract}</span>
                </div>
                <div style="display: flex; gap: var(--space-md); color: var(--color-text-secondary); font-size: 0.82rem; margin-bottom: var(--space-md);">
                    <span>\ud83d\udccd ${job.location}</span>
                </div>
                <p style="color: var(--color-text-secondary); font-size: 0.85rem; line-height: 1.6; margin-bottom: var(--space-md);">${job.description}</p>
            </div>

            <div style="margin-bottom: var(--space-lg);">
                <div style="margin-bottom: var(--space-sm);">
                    ${job.strengths.map(s => `<span class="result-tag tag-strength">\u2713 ${s}</span>`).join('')}
                </div>
                <div>
                    ${job.weaknesses.map(w => `<span class="result-tag tag-weakness">\u26a0 ${w}</span>`).join('')}
                </div>
            </div>

            <div style="padding-top: var(--space-md); border-top: 1px solid var(--glass-border); display: flex; align-items: center; gap: var(--space-md);">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--gradient-primary); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700; font-size: 0.8rem;">${job.recruiter.name.charAt(0)}</div>
                <div>
                    <div style="font-weight: 600; font-size: 0.85rem;">${job.recruiter.name}</div>
                    <div style="color: var(--color-text-muted); font-size: 0.75rem;">${job.recruiter.email}</div>
                </div>
            </div>
        `;

        grid.appendChild(card);

        // Stagger animation
        setTimeout(() => {
            card.style.transition = 'all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)';
            card.style.opacity = '1';
        }, i * 100);
    });
}

function toggleJobSelection(id) {
    if (selectedJobs.has(id)) {
        selectedJobs.delete(id);
    } else {
        selectedJobs.add(id);
    }

    // Update card visuals
    document.querySelectorAll('.result-card').forEach((card, i) => {
        card.classList.toggle('selected', selectedJobs.has(searchResults[i].id));
    });

    // Update button
    const count = selectedJobs.size;
    document.getElementById('selected-count').textContent = count;
    document.getElementById('apply-selected-btn').disabled = count === 0;
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
