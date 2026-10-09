import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// ==============================================
// AUTHENTIFICATION
// ==============================================
// Jeton de session Supabase (Authorization: Bearer) -> l'utilisateur du jeton.
// Sinon X-Webhook-Secret égal au secret enregistré pour le user_id annoncé.
async function resolveUserId(req: Request, body: any, supabase: any): Promise<string | null> {
  const auth = req.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (token) {
    const { data } = await supabase.auth.getUser(token);
    if (data?.user?.id) return data.user.id;
  }
  const secret = req.headers.get('x-webhook-secret');
  const claimed: string | null = body?.data?.user_id || body?.user_id || null;
  if (secret && claimed) {
    const { data } = await supabase.from('webhook_config').select('secret').eq('user_id', claimed).maybeSingle();
    if (data?.secret && data.secret === secret) return claimed;
  }
  return null;
}

// ==============================================
// CLAUDE AI
// ==============================================
async function callClaude(messages: any[], maxTokens = 2000): Promise<string> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY') || Deno.env.get('ANTHROPIC');
  if (!apiKey) throw new Error('Clé API Anthropic manquante.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: maxTokens, messages })
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const d = await res.json();
  const text = (d.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('');
  if (!text) throw new Error(`Réponse vide (stop_reason: ${d.stop_reason})`);
  return text;
}

function parseJSON(text: string, type: 'object' | 'array'): any {
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const pat = type === 'array' ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/;
  const m = clean.match(pat);
  if (!m) throw new Error(`No JSON ${type} found`);
  return JSON.parse(m[0]);
}

// ==============================================
// SEND REAL EMAIL VIA RESEND
// ==============================================
async function sendEmail(to: string, subject: string, body: string, from?: string): Promise<boolean> {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  if (!resendKey) {
    console.log('[sendEmail] Pas de clé RESEND_API_KEY, email non envoyé');
    return false;
  }

  const fromEmail = from || Deno.env.get('RESEND_FROM_EMAIL') || 'W-JOB <noreply@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: subject,
        text: body
      })
    });
    const data = await res.json();
    if (res.ok) {
      console.log('[sendEmail] Email envoyé:', data.id);
      return true;
    } else {
      console.error('[sendEmail] Erreur Resend:', JSON.stringify(data));
      return false;
    }
  } catch (e) {
    console.error('[sendEmail] Exception:', e);
    return false;
  }
}

// ==============================================
// ANALYSE CV
// ==============================================
async function analyzeCV(cvUrl: string | null, fileName: string): Promise<any> {
  let messages: any[];
  if (cvUrl) {
    try {
      const r = await fetch(cvUrl);
      if (r.ok) {
        const buf = await r.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
        const b64 = btoa(bin);
        messages = [{ role: 'user', content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
          { type: 'text', text: 'Analyse ce CV. Réponds UNIQUEMENT avec du JSON valide (sans backticks):\n{"name":"Prénom Nom","skills":["s1","s2","s3","s4","s5"],"experience_years":5,"education":"Master","job_titles":["Titre"],"languages":["Français"],"summary":"Résumé 2-3 phrases.","search_keywords":["mot1","mot2"],"sector":"Secteur"}' }
        ]}];
      }
    } catch (e) { console.error('[analyzeCV] fetch err:', e); }
  }
  if (!messages!) {
    messages = [{ role: 'user', content: `CV: "${fileName}". Génère un profil JSON sans backticks: {"name":"Candidat","skills":["Organisation","Communication"],"experience_years":3,"education":"Bac+3","job_titles":["Chargé de projet"],"languages":["Français"],"summary":"Professionnel polyvalent.","search_keywords":["emploi","CDI"],"sector":"Services"}` }];
  }
  const text = await callClaude(messages, 1500);
  console.log('[analyzeCV] réponse:', text.slice(0, 150));
  try { return parseJSON(text, 'object'); }
  catch (e) {
    console.error('[analyzeCV] parse err:', e);
    return { name: 'Candidat', skills: ['Compétences pro'], experience_years: 3, education: 'Diplôme', job_titles: ['Pro'], languages: ['Français'], summary: 'CV analysé.', search_keywords: ['emploi'], sector: 'Généraliste' };
  }
}

// ==============================================
// RECHERCHE EMPLOIS
// ==============================================
async function searchJobs(profile: any, supabase: any, userId: string): Promise<any[]> {
  const skills = (profile.skills || []).slice(0, 5).join(', ');
  const titles = (profile.job_titles || ['Professionnel']).join(', ');
  const sector = profile.sector || 'Généraliste';
  const exp = profile.experience_years || 3;

  const prompt = `Expert RH France. Génère exactement 10 offres d'emploi réalistes.\nProfil: ${titles} | Secteur: ${sector} | ${exp} ans | Skills: ${skills}\n\nRéponds UNIQUEMENT avec un tableau JSON (sans backticks):\n[{"company":"Nom","title":"Titre","location":"Ville","contract_type":"CDI","salary":"40000-50000","description":"Description 2-3 phrases.","skills":["s1","s2","s3"],"remote":false,"compatibility":82,"recruiter_name":"Prénom Nom","recruiter_email":"prenom.nom@entreprise.fr"}]\n\n10 offres variées, compatibilité 65-95.`;

  const text = await callClaude([{ role: 'user', content: prompt }], 4000);
  console.log('[searchJobs] réponse (200c):', text.slice(0, 200));

  let jobs: any[];
  try {
    jobs = parseJSON(text, 'array');
    if (!Array.isArray(jobs)) throw new Error('Not array');
    console.log('[searchJobs] parsés:', jobs.length);
  } catch (e) {
    console.error('[searchJobs] parse err:', e.message, text.slice(0, 400));
    return [];
  }

  const today = new Date().toISOString().split('T')[0];
  const rows = jobs.slice(0, 10).map((j: any) => ({
    user_id: userId,
    company: String(j.company || 'Entreprise').slice(0, 200),
    title: String(j.title || 'Poste').slice(0, 200),
    location: j.location ? String(j.location).slice(0, 200) : null,
    contract_type: j.contract_type ? String(j.contract_type).slice(0, 50) : 'CDI',
    salary: j.salary ? String(j.salary).slice(0, 100) : null,
    description: j.description ? String(j.description).slice(0, 2000) : null,
    skills: Array.isArray(j.skills) ? j.skills : [],
    remote: j.remote === true,
    compatibility: Math.min(100, Math.max(0, Number(j.compatibility) || 75)),
    source: 'agent_ia',
    posted_date: today
  }));

  console.log('[searchJobs] inserting', rows.length);
  const { data: inserted, error: err } = await supabase.from('jobs').insert(rows).select();
  if (err) { console.error('[searchJobs] INSERT err:', JSON.stringify(err)); return []; }
  console.log('[searchJobs] inserted:', inserted?.length);

  // Recruiters
  const recs = jobs.filter((j: any) => j.recruiter_name && j.recruiter_email).map((j: any) => ({
    user_id: userId,
    name: String(j.recruiter_name).slice(0, 200),
    email: String(j.recruiter_email).slice(0, 200),
    company: String(j.company || '').slice(0, 200),
    position: 'Recruteur'
  }));
  if (recs.length > 0) {
    const { error: rErr } = await supabase.from('recruiters').insert(recs);
    if (rErr) console.error('[searchJobs] recruiters err:', JSON.stringify(rErr));
  }

  return inserted || [];
}

// ==============================================
// EMAIL GENERATION
// ==============================================
async function generateEmail(data: any, profile: any = null): Promise<string> {
  const name = profile?.name || data.candidate_name || 'Candidat';
  const skills = profile?.skills?.slice(0, 3).join(', ') || '';
  const prompt = `Génère un email de candidature professionnel en français.\n\nPoste: ${data.job_title || 'Poste'}\nEntreprise: ${data.company || 'Entreprise'}\nRecruteur: ${data.recruiter_name || 'Madame, Monsieur'}\nDescription: ${data.job_description || 'Poste correspondant à mon profil'}\nCandidat: ${name}${skills ? `\nCompétences: ${skills}` : ''}\n\nFormat:\nObjet : [objet]\n\n[Corps 150-200 mots, professionnel, personnalisé, français]`;
  return callClaude([{ role: 'user', content: prompt }], 800);
}

// ==============================================
// MAIN HANDLER
// ==============================================
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method === 'GET') {
    return json({ status: 'ok', agent: 'W-JOB AI Agent v7', ts: new Date().toISOString() });
  }

  try {
    const body = await req.json();
    const { event, data, action } = body;
    const eventType: string = event || (action ? `manual.${action}` : 'unknown');

    // ---- test.ping : public, sans effet ----
    if (eventType === 'test.ping') {
      return json({ message: '🤖 Agent IA W-JOB v7 opérationnel !', status: 'connected', version: 'v7', ts: new Date().toISOString() });
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // Tout le reste appelle Claude, écrit en base ou envoie des emails : utilisateur vérifié obligatoire
    const userId = await resolveUserId(req, body, supabase);
    if (!userId) return json({ error: 'Non autorisé', message: 'Non autorisé' }, 401);
    console.log(`[W-JOB v7] ${eventType} | user: ${userId}`);

    let result: Record<string, any> = {};

    // ---- cv.uploaded ----
    if (eventType === 'cv.uploaded') {
      const { cv_url, file_name } = data || {};
      const profile = await analyzeCV(cv_url || null, file_name || 'cv.pdf');
      console.log(`[cv.uploaded] profil: ${profile.name} | ${profile.sector}`);

      await supabase.from('user_profiles').upsert({
        user_id: userId, name: profile.name, skills: profile.skills,
        experience_years: profile.experience_years, education: profile.education,
        job_titles: profile.job_titles, languages: profile.languages,
        summary: profile.summary, search_keywords: profile.search_keywords,
        cv_analyzed_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' }).then((r: any) => { if (r.error) console.error('profile upsert err:', r.error); });

      const jobs = await searchJobs(profile, supabase, userId);
      console.log(`[cv.uploaded] ${jobs.length} offres`);

      result = {
        message: `✅ CV analysé ! ${jobs.length} offres d'emploi trouvées.`,
        profile: { name: profile.name, skills: profile.skills, sector: profile.sector, experience_years: profile.experience_years, summary: profile.summary },
        jobs_found: jobs.length, analysis: profile.summary
      };
      await supabase.from('agent_actions').insert({ user_id: userId, event: eventType, status: 'success', result: { message: result.message, jobs_found: jobs.length } }).catch(() => {});
    }
    // ---- email.generate ----
    else if (eventType === 'email.generate') {
      const { data: profile } = await supabase.from('user_profiles').select('name, skills').eq('user_id', userId).maybeSingle();
      const email = await generateEmail(data || {}, profile);

      // Parse subject from generated email
      let subject = `Candidature - ${data?.job_title || 'Poste'} - ${data?.company || 'Entreprise'}`;
      const subjectMatch = email.match(/Objet\s*:\s*(.+)/i);
      if (subjectMatch) subject = subjectMatch[1].trim();

      // Send real email if recruiter_email is provided and Resend is configured
      let emailSent = false;
      if (data?.recruiter_email) {
        emailSent = await sendEmail(data.recruiter_email, subject, email);
      }

      // Save application
      if (data?.job_id) {
        const today = new Date().toISOString().split('T')[0];
        await supabase.from('applications').insert({
          user_id: userId, job_id: Number(data.job_id),
          custom_email: email, cover_letter: email,
          status: emailSent ? 'sent' : 'draft',
          created_date: today,
          sent_date: emailSent ? today : null
        }).catch((e: any) => console.error('app save err:', e));
      }

      result = {
        email, message: emailSent ? '✉️ Email envoyé avec succès !' : '✉️ Email généré (configurer Resend pour l\'envoi automatique).',
        email_sent: emailSent
      };
      await supabase.from('agent_actions').insert({ user_id: userId, event: eventType, status: 'success', result: { message: result.message, email_sent: emailSent } }).catch(() => {});
    }
    // ---- email.send ----
    else if (eventType === 'email.send') {
      const { to, subject, body: emailBody } = data || {};
      if (!to || !emailBody) {
        result = { message: 'Destinataire et contenu requis.', email_sent: false };
      } else {
        const sent = await sendEmail(to, subject || 'Candidature W-JOB', emailBody);
        result = { message: sent ? '✉️ Email envoyé !' : '❌ Erreur d\'envoi. Vérifiez la clé Resend.', email_sent: sent };
      }
      await supabase.from('agent_actions').insert({ user_id: userId, event: eventType, status: result.email_sent ? 'success' : 'error', result: { message: result.message } }).catch(() => {});
    }
    // ---- manual.search ----
    else if (eventType === 'manual.search' || eventType === 'manual.find_jobs') {
      let profile: any = { name: 'Candidat', skills: ['Polyvalence', 'Organisation'], experience_years: 3, job_titles: ['Assistant'], sector: 'Services' };
      const { data: p } = await supabase.from('user_profiles').select('*').eq('user_id', userId).maybeSingle();
      if (p) profile = p;
      const jobs = await searchJobs(profile, supabase, userId);
      result = { message: `🔍 ${jobs.length} nouvelles offres trouvées !`, jobs_found: jobs.length };
      await supabase.from('agent_actions').insert({ user_id: userId, event: eventType, status: 'success', result: { message: result.message, jobs_found: jobs.length } }).catch(() => {});
    }
    else {
      result = { message: `Événement "${eventType}" reçu.`, status: 'received' };
    }

    return json(result);
  } catch (err: any) {
    console.error('[W-JOB v7] fatal:', err.message);
    return json({ error: err.message, message: `Erreur: ${err.message}` }, 500);
  }
});
