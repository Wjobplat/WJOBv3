
// Vercel Serverless Function — Agent IA Trigger
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
    // Allow CORS for browser requests
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Webhook-Secret');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = req.body || {};
    const event = body.event || body.action;
    const user_id = body.user_id || body.data?.user_id;

    console.log(`[Trigger] Received: event=${event}, user_id=${user_id}`);

    // =============================================
    // 1. TEST PING — respond immediately
    // =============================================
    if (event === 'test.ping') {
        return res.status(200).json({
            success: true,
            message: 'Pong ! Agent IA connect\u00e9 et fonctionnel.',
            timestamp: new Date().toISOString()
        });
    }

    // =============================================
    // 2. CV UPLOADED — acknowledge receipt
    // =============================================
    if (event === 'cv.uploaded') {
        const cvUrl = body.data?.cv_url;
        const fileName = body.data?.file_name || 'cv.pdf';
        console.log(`[Trigger] CV received: ${fileName}`);

        let profile = {};
        if (cvUrl && process.env.ANTHROPIC_API_KEY) {
            try {
                const message = await anthropic.messages.create({
                    model: 'claude-opus-4-6',
                    max_tokens: 1024,
                    messages: [{
                        role: 'user',
                        content: `Analyse ce CV (fichier: ${fileName}, URL: ${cvUrl}) et extrais les informations en JSON strict.
Retourne UNIQUEMENT ce JSON:
{"name":"","title":"","summary":"","skills":[],"experience_years":0,"education":"","languages":[],"job_titles":[],"search_keywords":[]}`
                    }]
                });
                const raw = message.content[0].text.trim();
                const match = raw.match(/\{[\s\S]*\}/);
                if (match) profile = JSON.parse(match[0]);
            } catch (e) {
                console.warn('[Trigger] CV analysis error:', e.message);
            }
        }

        await forwardToWebhook(req, {
            user_id, event: 'cv.uploaded',
            data: { file_name: fileName, cv_url: cvUrl, status: 'analyzed', profile }
        });

        return res.status(200).json({
            success: true,
            message: `CV analysé par l'agent IA`,
            profile,
            analysis: profile.summary || "CV reçu par l'agent IA."
        });
    }

    // =============================================
    // 3. EMAIL GENERATE — generate a real email
    // =============================================
    if (event === 'email.generate') {
        const d = body.data || {};
        let email = '';

        if (process.env.ANTHROPIC_API_KEY) {
            try {
                const message = await anthropic.messages.create({
                    model: 'claude-opus-4-6',
                    max_tokens: 600,
                    messages: [{
                        role: 'user',
                        content: `Rédige un email de candidature professionnel et personnalisé.
Poste: ${d.job_title || 'Non spécifié'} chez ${d.company || 'Non spécifié'}
Recruteur: ${d.recruiter_name || 'Madame, Monsieur'}
Description: ${(d.job_description || '').substring(0, 200)}
Objet en 1ère ligne. 3 paragraphes max. Ton humain. Sans clichés. En français.`
                    }]
                });
                email = message.content[0].text.trim();
            } catch (e) {
                console.warn('[Trigger] Email generation error:', e.message);
            }
        }

        if (!email) {
            email = `Objet : Candidature — ${d.job_title || 'Poste'} chez ${d.company || 'Entreprise'}\n\nBonjour ${d.recruiter_name || 'Madame, Monsieur'},\n\nJe souhaite vous soumettre ma candidature pour le poste de ${d.job_title || 'ce poste'}.\n\nMon parcours correspond aux attentes décrites. Je serais ravi(e) d'en discuter lors d'un entretien.\n\nCordialement`;
        }

        return res.status(200).json({ success: true, email });
    }

    // =============================================
    // 4. AGENT ACTIONS — search_jobs, find_recruiters, generate_applications
    // =============================================
    const SIMULATED_ACTIONS = {
        'search_jobs': {
            event: 'job.created',
            generate: () => ({
                company: "TechFound IA",
                title: "D\u00e9veloppeur Full Stack (Agent IA)",
                location: "Remote Full",
                contract_type: "CDI",
                salary: "50k - 65k \u20ac",
                source: "Agent IA W-JOB",
                compatibility: 94,
                description: "Offre d\u00e9couverte par l'agent IA suite \u00e0 l'analyse de votre profil.",
                skills: ["React", "Node.js", "Supabase"],
                remote: true,
                posted_date: new Date().toISOString().split('T')[0]
            })
        },
        'find_recruiters': {
            event: 'recruiter.found',
            generate: () => ({
                name: "Alex Recruteur",
                email: "alex@techfound-ia.com",
                linkedin: "https://linkedin.com/in/alex-recruteur",
                company: "TechFound IA",
                position: "Talent Acquisition"
            })
        },
        'generate_applications': {
            event: 'application.generated',
            generate: () => ({
                jobId: 1,
                coverLetter: "Madame, Monsieur,\n\nSuite \u00e0 l'analyse de votre offre par notre agent IA, je souhaite vous pr\u00e9senter ma candidature...",
                customEmail: "Bonjour, veuillez trouver ci-joint ma candidature g\u00e9n\u00e9r\u00e9e par l'agent IA.",
                notes: "G\u00e9n\u00e9r\u00e9 par Agent IA W-JOB"
            })
        },
        'follow_up': {
            event: 'application.status_changed',
            generate: () => ({
                message: "Relance automatique envoy\u00e9e par l'agent IA",
                action: "follow_up"
            })
        }
    };

    // Check if it's a known simulated action
    const actionKey = body.action || event;
    const config = SIMULATED_ACTIONS[actionKey];

    if (config) {
        const payload = {
            user_id: user_id,
            event: config.event,
            data: config.generate()
        };

        const result = await forwardToWebhook(req, payload);

        return res.status(200).json({
            success: true,
            message: `Action '${actionKey}' ex\u00e9cut\u00e9e avec succ\u00e8s`,
            result
        });
    }

    // =============================================
    // 5. UNKNOWN EVENT — log and acknowledge
    // =============================================
    console.log(`[Trigger] Unknown event: ${event}`);

    if (user_id && event) {
        await forwardToWebhook(req, {
            user_id,
            event,
            data: body.data || { message: `\u00c9v\u00e9nement ${event} re\u00e7u` }
        });
    }

    return res.status(200).json({
        success: true,
        message: `\u00c9v\u00e9nement '${event || 'unknown'}' re\u00e7u`
    });
}

// Helper: forward event to /api/webhook for Supabase logging
async function forwardToWebhook(req, payload) {
    try {
        const host = req.headers.host;
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const webhookUrl = `${protocol}://${host}/api/webhook`;

        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        return { forwarded: true, status: response.status };
    } catch (e) {
        console.error('[Trigger] Forward to webhook failed:', e.message);
        return { forwarded: false, error: e.message };
    }
}
