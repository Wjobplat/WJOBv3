import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { profile = {}, apiKey } = req.body || {};
  const resolvedKey = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!resolvedKey) return res.status(400).json({ error: 'Clé API Anthropic manquante' });

  const client = new Anthropic({ apiKey: resolvedKey });

  const jobTitles = (profile.job_titles || []).slice(0, 3).join(', ') || 'développeur';
  const skills    = (profile.skills || []).slice(0, 6).join(', ');
  const keywords  = (profile.search_keywords || []).slice(0, 3).join(', ');
  const expYears  = profile.experience_years;

  const userMessage = `Tu es un chasseur de tête expert. Recherche 6 à 8 offres d'emploi réelles et récentes en France pour ce profil :

Postes visés : ${jobTitles}
Compétences : ${skills}${keywords ? `\nMots-clés : ${keywords}` : ''}${expYears != null ? `\nExpérience : ${expYears} ans` : ''}

Cherche sur LinkedIn Jobs, Welcome to the Jungle, Indeed France, Glassdoor ou JobTeaser.
Retourne UNIQUEMENT ce JSON valide (sans markdown, sans bloc de code) :
{
  "jobs": [
    {
      "id": "job-1",
      "title": "Titre exact du poste",
      "company": "Nom de l'entreprise",
      "location": "Paris, France",
      "contract_type": "CDI",
      "salary": "45-55k€",
      "description": "Description du poste en 2-3 phrases.",
      "skills": ["Skill1", "Skill2", "Skill3"],
      "recruiter_name": "Prénom Nom ou HR Team",
      "recruiter_email": "recrutement@entreprise.com",
      "source": "https://url-de-loffre",
      "posted_date": "2025-01-15"
    }
  ]
}`;

  try {
    const messages = [{ role: 'user', content: userMessage }];
    let response;
    let iterations = 0;

    while (iterations < 8) {
      iterations++;
      response = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
        messages
      });

      if (response.stop_reason === 'end_turn') break;
      if (response.stop_reason !== 'tool_use') break;

      messages.push({ role: 'assistant', content: response.content });

      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      if (!toolUseBlocks.length) break;

      messages.push({
        role: 'user',
        content: toolUseBlocks.map(b => ({
          type: 'tool_result',
          tool_use_id: b.id,
          content: 'Résultats récupérés.'
        }))
      });
    }

    const finalText = (response?.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    let result;
    try { result = JSON.parse(finalText); }
    catch {
      const m = finalText.match(/\{[\s\S]*\}/);
      try { result = m ? JSON.parse(m[0]) : { jobs: [] }; }
      catch { result = { jobs: [] }; }
    }

    const jobs = (result.jobs || []).map((job, i) => {
      const slug = (job.company || 'entreprise').toLowerCase().replace(/[^a-z0-9]/g, '');
      return {
        id:              job.id || `ai-job-${i}`,
        title:           job.title           || '',
        company:         job.company         || '',
        location:        job.location        || 'France',
        contract_type:   job.contract_type   || 'CDI',
        salary:          job.salary          || null,
        description:     job.description     || '',
        skills:          Array.isArray(job.skills) ? job.skills : [],
        recruiter_name:  job.recruiter_name  || 'Service RH',
        recruiter_email: job.recruiter_email || `recrutement@${slug}.com`,
        source:          job.source          || null,
        posted_date:     job.posted_date     || new Date().toISOString().slice(0, 10)
      };
    });

    res.status(200).json({ success: true, jobs });
  } catch (err) {
    console.error('search-jobs error:', err);
    res.status(500).json({ error: err.message });
  }
}
