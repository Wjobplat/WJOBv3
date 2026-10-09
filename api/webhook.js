
// Vercel Serverless Function — Incoming Webhook Handler
// Processes events and logs them in Supabase
import { createClient } from '@supabase/supabase-js';
import { isAuthorizedFor } from './_utils/auth.js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://bqobpkwkwypiuhtprjva.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Client créé seulement si la clé service est configurée (sinon le module plante au chargement)
const supabase = supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Webhook-Secret, X-Webhook-Signature, X-Webhook-Event');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!supabase) {
        return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY non configurée sur Vercel' });
    }

    try {
        const event = req.body.event || req.query.event;
        const data = req.body.data || req.body;
        const user_id = req.query.user_id || req.body.user_id;

        if (!event || !user_id) {
            return res.status(400).json({ error: 'Missing event or user_id' });
        }

        if (!(await isAuthorizedFor(req, user_id))) {
            return res.status(401).json({ error: 'Non autorisé' });
        }

        console.log(`[Webhook] Received: ${event} for user ${user_id}`);

        // 1. Log the action in Supabase
        const { error: logError } = await supabase
            .from('agent_actions')
            .insert({
                user_id,
                event,
                status: 'success',
                result: data || {}
            });

        if (logError) {
            console.error('[Webhook] Log error:', logError);
            // Don't throw — continue processing even if logging fails
        }

        // 2. Perform business logic based on event
        if (event === 'job.created') {
            const { error } = await supabase.from('jobs').insert({ ...data, user_id });
            if (error) console.error('[Webhook] Job insert error:', error);
        }
        else if (event === 'recruiter.found') {
            const { error } = await supabase.from('recruiters').insert({ ...data, user_id });
            if (error) console.error('[Webhook] Recruiter insert error:', error);
        }
        else if (event === 'application.generated') {
            const { jobId, status, coverLetter, customEmail, notes } = data;
            const { error } = await supabase.from('applications').insert({
                job_id: jobId,
                user_id: user_id,
                status: status || 'draft',
                cover_letter: coverLetter,
                custom_email: customEmail,
                notes: notes,
                created_date: new Date().toISOString().split('T')[0]
            });
            if (error) console.error('[Webhook] Application insert error:', error);
        }
        else if (event === 'application.status_changed') {
            const { applicationId, status } = data;
            const updates = { status };
            if (status === 'sent') updates.sent_date = new Date().toISOString().split('T')[0];
            if (status === 'responded') updates.response_date = new Date().toISOString().split('T')[0];

            const { error } = await supabase.from('applications').update(updates).eq('id', applicationId).eq('user_id', user_id);
            if (error) console.error('[Webhook] Application update error:', error);
        }
        else if (event === 'cv.uploaded') {
            // CV upload event — logged above, no additional action needed
            console.log(`[Webhook] CV uploaded: ${data.file_name || 'unknown'}`);
        }
        // All other events are just logged (handled by step 1 above)

        return res.status(200).json({ success: true, event });
    } catch (error) {
        console.error('[Webhook] Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
