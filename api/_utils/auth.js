// Helpers d'authentification partagés par les fonctions /api (dossier _lib : non exposé en route)
import { timingSafeEqual } from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bqobpkwkwypiuhtprjva.supabase.co';
// Clé anon publique (déjà exposée côté client dans supabase-client.js)
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJxb2Jwa3drd3lwaXVodHByanZhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NjQ3NDMsImV4cCI6MjA4NDQ0MDc0M30.51PFJRHCKHYbLhHB3hw8FdeECmk5HORQ_wJBtJK1yUM';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Vérifie le JWT Supabase envoyé dans "Authorization: Bearer <token>"
export async function getUserFromRequest(req) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    if (!token) return null;
    try {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
        });
        if (!r.ok) return null;
        const user = await r.json();
        return user && user.id ? user : null;
    } catch (e) {
        console.error('[auth] Token check failed:', e.message);
        return null;
    }
}

export async function requireUser(req, res) {
    const user = await getUserFromRequest(req);
    if (!user) {
        res.status(401).json({ error: 'Non authentifié' });
        return null;
    }
    return user;
}

// Secret webhook de l'utilisateur (table webhook_config), lu avec la service role
export async function getWebhookSecret(userId) {
    if (!SERVICE_KEY || !userId) return null;
    try {
        const r = await fetch(`${SUPABASE_URL}/rest/v1/webhook_config?select=secret&user_id=eq.${encodeURIComponent(userId)}`, {
            headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` }
        });
        if (!r.ok) return null;
        const rows = await r.json();
        return rows[0]?.secret || null;
    } catch (e) {
        console.error('[auth] Secret lookup failed:', e.message);
        return null;
    }
}

export function safeEqual(a, b) {
    const x = Buffer.from(String(a || ''));
    const y = Buffer.from(String(b || ''));
    return x.length > 0 && x.length === y.length && timingSafeEqual(x, y);
}

// Requête valide si : JWT de l'utilisateur concerné, ou X-Webhook-Secret = son secret
export async function isAuthorizedFor(req, userId) {
    const user = await getUserFromRequest(req);
    if (user) return !userId || user.id === userId;
    const provided = req.headers['x-webhook-secret'];
    if (!provided || !userId) return false;
    return safeEqual(provided, await getWebhookSecret(userId));
}
