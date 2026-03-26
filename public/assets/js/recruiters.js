// recruiters.js — W-JOB Recruteurs
// Charge les recruteurs depuis Supabase et peuple la grille

document.addEventListener('DOMContentLoaded', function () {
    console.log('[W-JOB] Recruiters v1.0 chargé');
    loadRecruiters();
});

// ── Chargement ─────────────────────────────────────────────
async function loadRecruiters() {
    const container = document.getElementById('recruiters-container');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--muted);font-size:.9rem;grid-column:1/-1;">Chargement des recruteurs...</div>';

    try {
        const recruiters = await API.getRecruiters();
        renderRecruiters(recruiters || []);
        updateStats(recruiters || []);
    } catch (e) {
        console.error('[W-JOB] Recruiters load error:', e);
        container.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--muted);grid-column:1/-1;">Impossible de charger les recruteurs.</div>';
    }
}

// ── Rendu des cartes recruteur ─────────────────────────────
const AVATAR_GRADS = [
    'linear-gradient(135deg,#059669,#10b981)',
    'linear-gradient(135deg,#2563eb,#3b82f6)',
    'linear-gradient(135deg,#7c3aed,#a78bfa)',
    'linear-gradient(135deg,#b45309,#d97706)',
    'linear-gradient(135deg,#0e7490,#06b6d4)',
    'linear-gradient(135deg,#be185d,#f472b6)',
    'linear-gradient(135deg,#065f46,#34d399)',
    'linear-gradient(135deg,#1e3a8a,#60a5fa)',
];

const SVG_COMPANY = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
const SVG_MAIL   = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';

function renderRecruiters(recruiters) {
    const container = document.getElementById('recruiters-container');
    if (!container) return;

    if (recruiters.length === 0) {
        container.innerHTML = '<div style="text-align:center;padding:4rem;color:var(--muted);font-size:.9rem;grid-column:1/-1;">Aucun recruteur pour le moment.<br><br>Uploadez votre CV pour que l\'agent IA trouve des recruteurs correspondant à votre profil !</div>';
        return;
    }

    container.innerHTML = '';
    recruiters.forEach((rec, i) => {
        const card = buildRecruiterCard(rec, i);
        container.appendChild(card);
    });
}

function buildRecruiterCard(rec, index) {
    const grad    = AVATAR_GRADS[index % AVATAR_GRADS.length];
    const name    = rec.name || 'Recruteur';
    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const role    = rec.position || rec.role || 'Recruteur';
    const company = rec.company || '';
    const email   = rec.email || '';
    const tags    = Array.isArray(rec.tags) ? rec.tags : (company ? [company] : []);

    // Statut aléatoire basé sur l'index pour la démo
    // En prod, utiliser rec.status si disponible
    const statusMap = [
        { cls: 's-replied',   label: 'Répondu' },
        { cls: 's-contacted', label: 'Contacté' },
        { cls: 's-pending',   label: 'En attente' },
    ];
    const status = rec.status
        ? { cls: `s-${rec.status}`, label: rec.status === 'replied' ? 'Répondu' : rec.status === 'contacted' ? 'Contacté' : 'En attente' }
        : statusMap[index % statusMap.length];

    const contactedDate = rec.contacted_at || rec.updated_at
        ? new Date(rec.contacted_at || rec.updated_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
        : '';

    const tagsHtml = tags.slice(0, 3).map(t =>
        `<span class="rec-tag">${escHtml(t)}</span>`
    ).join('');

    const div = document.createElement('div');
    div.className = 'recruiter-card fade-in fi4';
    div.style.animationDelay = `${0.08 + index * 0.08}s`;

    div.innerHTML = `
      <div class="rec-top">
        <div class="rec-avatar" style="background:${grad}">${escHtml(initials)}</div>
        <div class="rec-info">
          <div class="rec-name">${escHtml(name)}</div>
          <div class="rec-role">${escHtml(role)}</div>
          <div class="rec-company">${SVG_COMPANY} ${escHtml(company)}</div>
        </div>
        <span class="status-badge ${status.cls}">${status.label}</span>
      </div>
      ${tagsHtml ? `<div class="rec-tags">${tagsHtml}</div>` : ''}
      <div class="rec-footer">
        <span class="rec-date">${contactedDate ? `Contacté le ${contactedDate}` : 'Non contacté'}</span>
        <div class="rec-actions">
          <button class="btn-view" data-id="${rec.id}">Voir profil</button>
          <button class="btn-contact" data-email="${escHtml(email)}" data-name="${escHtml(name)}">${SVG_MAIL} ${email ? 'Relancer' : 'Contacter'}</button>
        </div>
      </div>`;

    // Bouton Contacter : génère un email IA et ouvre le client mail
    div.querySelector('.btn-contact').addEventListener('click', async function () {
        const btn = this;
        if (!email) {
            showToast('Aucun email disponible pour ce recruteur', 'warning');
            return;
        }
        btn.disabled = true;
        btn.textContent = '⏳ Génération...';
        try {
            const result = await API.generateAiEmail({
                job: {
                    title: role,
                    company: company,
                    recruiter: { name, email }
                }
            });
            // Ouvre le client mail avec l'email pré-rempli
            const subject = encodeURIComponent(`Candidature — ${role} — ${company}`);
            const body    = encodeURIComponent(result.email || '');
            window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
            showToast('Email généré et prêt à envoyer !', 'success');

            // Enregistre un agent_action
            await supabase.from('agent_actions').insert({
                event: 'recruiter.contact',
                status: 'success',
                result: { message: `Email généré pour ${name} (${email})` }
            }).catch(() => {});
        } catch (e) {
            console.error('[W-JOB] generateAiEmail error:', e);
            showToast('Erreur lors de la génération de l\'email', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = `${SVG_MAIL} Relancer`;
        }
    });

    // Bouton Voir profil : ouvre le profil LinkedIn si dispo, sinon mailto
    div.querySelector('.btn-view').addEventListener('click', function () {
        if (rec.linkedin_url) {
            window.open(rec.linkedin_url, '_blank');
        } else if (email) {
            window.open(`mailto:${email}`, '_blank');
        } else {
            showToast('Aucun profil disponible', 'info');
        }
    });

    return div;
}

// ── Mise à jour des stats ──────────────────────────────────
function updateStats(recruiters) {
    const total    = recruiters.length;
    const contacts = recruiters.filter(r => r.status === 'contacted' || r.status === 'replied').length;

    const elTotal = document.getElementById('total-recruiters');
    const elCont  = document.getElementById('total-contacts');

    if (elTotal) elTotal.textContent = total;
    if (elCont)  elCont.textContent  = contacts;
}

function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
