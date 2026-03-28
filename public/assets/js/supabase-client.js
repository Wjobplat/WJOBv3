// supabase-client.js — W-JOB
// Initialise Supabase + configure automatiquement le webhook vers l'agent IA

const SUPABASE_URL  = 'https://bqobpkwkwypiuhtprjva.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxb2Jwa3drd3lwaXVodHByanZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjQ3NDMsImV4cCI6MjA4NDQ0MDc0M30.51PFJRHCKHYbLhHB3hw8FdeECmk5HORQ_wJBtJK1yUM';

// URL de l'agent IA (Edge Function Supabase)
const AI_AGENT_URL  = 'https://bqobpkwkwypiuhtprjva.supabase.co/functions/v1/ai-agent';

// Initialise le client Supabase
window.wjob = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
// Expose le CLIENT (pas la lib CDN) via window.supabase pour que api.js l'utilise
window.supabase = window.wjob;

// ── Auto-configure le webhook ──────────────────────────────────────────────
// Dès que l'utilisateur est connecté, on s'assure que le webhook pointe
// vers l'Edge Function ai-agent avec enabled = true
async function _autoConfigWebhook(userId) {
    try {
        const { data: existing } = await window.wjob
            .from('webhook_config')
            .select('id, outgoing_url, enabled')
            .eq('user_id', userId)
            .maybeSingle();

        // Rien à faire si déjà configuré correctement
        if (existing && existing.outgoing_url === AI_AGENT_URL && existing.enabled) return;

        await window.wjob.from('webhook_config').upsert({
            user_id:      userId,
            outgoing_url: AI_AGENT_URL,
            enabled:      true,
            events: {
                'cv.uploaded':               true,
                'email.generate':            true,
                'email.send':                true,
                'job.created':               true,
                'recruiter.found':           true,
                'application.generated':     true,
                'application.status_changed':true
            },
            secret: 'wjob_agent_' + userId.slice(0, 8)
        }, { onConflict: 'user_id' });

        console.log('[W-JOB] Webhook agent IA configuré ✅');
    } catch (e) {
        console.warn('[W-JOB] Auto-config webhook échoué:', e.message);
    }
}

// ── Auth listener ──────────────────────────────────────────────────────────
// Configure le webhook dès la connexion et restaure le thème
window.wjob.auth.onAuthStateChange((event, session) => {
    if (session?.user?.id) {
        _autoConfigWebhook(session.user.id);
    }
    if (event === 'SIGNED_OUT') {
        localStorage.removeItem('wjob_token');
    }
});

// ── Auth helpers globaux ───────────────────────────────────────────────────
async function requireAuth() {
    var KEY = 'sb-bqobpkwkwypiuhtprjva-auth-token';
    var raw = localStorage.getItem(KEY);
    if (!raw) { window.location.replace('/login'); return null; }
    try {
        var s = JSON.parse(raw);
        if (!s || !s.access_token) { window.location.replace('/login'); return null; }
        return s.user || null;
    } catch (e) {
        window.location.replace('/login');
        return null;
    }
}

async function logout() {
    try { await window.wjob.auth.signOut(); } catch (e) {}
    window.location.replace('/login');
}

// ── Thème persisté ────────────────────────────────────────────────────────
(function () {
    const saved = localStorage.getItem('wjob-theme');
    if (saved) document.documentElement.dataset.theme = saved;
})();

console.log('[W-JOB] Supabase client initialisé ✅ | Agent IA:', AI_AGENT_URL);
