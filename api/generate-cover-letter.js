import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { job, profile } = req.body;
  if (!job || !profile) return res.status(400).json({ error: 'job et profile requis' });

  const prompt = `Tu es un expert en rédaction de lettres de motivation. Rédige une lettre de motivation professionnelle, authentique et percutante.

Poste visé : ${job.title} chez ${job.company}
Description : ${job.description || 'Non fournie'}
Compétences requises : ${Array.isArray(job.skills) ? job.skills.join(', ') : job.skills || 'Non spécifiées'}
Localisation : ${job.location || ''}
Contrat : ${job.contract_type || ''}

Profil du candidat :
- Nom : ${profile.name || 'Le candidat'}
- Titre actuel : ${profile.title || profile.job_titles?.[0] || ''}
- Compétences : ${Array.isArray(profile.skills) ? profile.skills.slice(0, 10).join(', ') : ''}
- Années d'expérience : ${profile.experience_years || 0}
- Formation : ${profile.education || ''}
- Résumé : ${profile.summary || ''}
- Langues : ${Array.isArray(profile.languages) ? profile.languages.join(', ') : ''}

Règles de rédaction :
- Structure : accroche forte → valeur ajoutée concrète → motivation pour l'entreprise → closing
- Ton humain, direct, sans clichés ("passionné", "dynamique", "rigoureux")
- 4 paragraphes maximum, environ 250-300 mots
- Pas de formules génériques, chaque phrase doit être spécifique au poste
- Commence par une accroche originale, pas "C'est avec un grand intérêt..."
- En-tête : "Lettre de motivation — ${job.title} chez ${job.company}"

Rédige uniquement la lettre en français.`;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 900,
      messages: [{ role: 'user', content: prompt }]
    });

    const coverLetter = message.content[0].text.trim();
    res.status(200).json({ success: true, coverLetter });
  } catch (err) {
    console.error('Claude generate-cover-letter error:', err);
    res.status(500).json({ error: 'Erreur lors de la génération par Claude' });
  }
}
