/* supabase-client.js */
(function () {
    if (window.supabase_initialized) return;

    const SUPABASE_URL = 'https://bqobpkwkwypiuhtprjva.supabase.co';
    const SUPABASE_KEY = 'sb_publishable_WDcUefwxHjmASodW8WwhoA_g5U0x4MS';

    if (typeof supabase !== 'undefined' && supabase.createClient) {
        window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        window.supabase_initialized = true;
        console.log('Supabase Client Initialized');
    } else {
        console.error('Supabase SDK missing.');
    }
})();

/* Auth guard — appeler sur les pages protégées */
async function requireAuth() {
    try {
        const { data: { session } } = await window.supabase.auth.getSession();
        if (!session) {
            window.location.replace('login.html');
            return null;
        }
        return session.user;
    } catch (e) {
        window.location.replace('login.html');
        return null;
    }
}

/* Déconnexion */
async function logout() {
    await window.supabase.auth.signOut();
    window.location.replace('login.html');
}
