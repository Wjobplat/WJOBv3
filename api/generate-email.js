import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { job, profile } = req.body;
  if (!job || !profile) return res.status(400).json({ error: 'job et profile requis' });

  const prompt = `Tu es un expert en recherche d'emploi. Rédige un email de candidature professionnel, humain et personnalisé.

Poste visé : ${job.title} chez ${job.company}
Description du poste : ${job.description || 'Non fournie'}
Compétences requises : ${Array.isArray(job.skills) ? job.skills.join(', ') : job.skills || 'Non spécifiées'}
Localisation : ${job.location || 'Non spécifiée'}
Type de contrat : ${job.contract_type || 'Non spécifié'}

Profil du candidat :
- Nom : ${profile.name || 'Le candidat'}
- Titre : ${profile.title || profile.job_titles?.[0] || 'Professionnel'}
- Compétences : ${Array.isArray(profile.skills) ? profile.skills.slice(0, 8).join(', ') : profile.skills || ''}
- Expérience : ${profile.experience_years || 0} ans
- Formation : ${profile.education || ''}
- Résumé : ${profile.summary || ''}

Règles :
- Ton professionnel mais chaleureux, pas robotique
- Mets en avant 2-3 compétences qui correspondent directement au poste
- 3 paragraphes max (accroche, valeur ajoutée, closing)
- Objet en première ligne : "Objet : ..."
- Pas de formules creuses ("je suis très motivé", "entreprise de renom")
- Termine par une formule de politesse simple

Rédige uniquement l'email (objet + corps), en français.`;

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }]
    });

    const email = message.content[0].text.trim();
    res.status(200).json({ success: true, email });
  } catch (err) {
    console.error('Claude generate-email error:', err);
    res.status(500).json({ error: 'Erreur lors de la génération par Claude' });
  }
}
