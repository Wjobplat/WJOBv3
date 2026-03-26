// supabase-client.js — W-JOB
// Initialise Supabase + configure automatiquement le webhook vers l'agent IA

const SUPABASE_URL  = 'https://bqobpkwkwypiuhtprjva.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxb2Jwa3drd3lwaXVodHByanZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjQ3NDMsImV4cCI6MjA4NDQ0MDc0M30.51PFJRHCKHYbLhHB3hw8FdeECmk5HORQ_wJBtJK1yUM';

// URL de l'agent IA (Edge Function Supabase)
const AI_AGENT_URL  = 'https://bqobpkwkwypiuhtprjva.supabase.co/functions/v1/ai-agent';

// Initialise le client Supabase global (accessible via window.supabase)
const _lib = window.supabase;
window.supabase = _lib.createClient(SUPABASE_URL, SUPABASE_ANON);
const supabase = window.supabase;

// ── Auto-configure le webhook ──────────────────────────────────────────────
// Dès que l'utilisateur est connecté, on s'assure que le webhook pointe
// vers l'Edge Function ai-agent avec enabled = true
async function _autoConfigWebhook(userId) {
    try {
        const { data: existing } = await supabase
            .from('webhook_config')
            .select('id, outgoing_url, enabled')
            .eq('user_id', userId)
            .maybeSingle();

        // Rien à faire si déjà configuré correctement
        if (existing && existing.outgoing_url === AI_AGENT_URL && existing.enabled) return;

        await supabase.from('webhook_config').upsert({
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
supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user?.id) {
        _autoConfigWebhook(session.user.id);
    }
    if (event === 'SIGNED_OUT') {
        localStorage.removeItem('wjob_token');
    }
});

// ── Thème persisté ────────────────────────────────────────────────────────
(function () {
    const saved = localStorage.getItem('wjob-theme');
    if (saved) document.documentElement.dataset.theme = saved;
})();

console.log('[W-JOB] Supabase client initialisé ✅ | Agent IA:', AI_AGENT_URL);
