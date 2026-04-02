import Anthropic from '@anthropic-ai/sdk';

function buildPrompt(action, job, profile, currentLetter) {
  const jobCtx = `Poste : ${job.title} chez ${job.company}
Localisation : ${job.location || 'Non spécifiée'}
Contrat : ${job.contractType || ''}
Description : ${(job.description || '').substring(0, 800)}
Compétences requises : ${Array.isArray(job.skills) ? job.skills.join(', ') : ''}`;

  if (action === 'generate') {
    const profCtx = profile ? `
Profil du candidat :
- Titre : ${profile.title || ''}
- Compétences : ${Array.isArray(profile.skills) ? profile.skills.slice(0, 8).join(', ') : ''}
- Expérience : ${profile.experience_years || 0} ans
- Formation : ${profile.education || ''}
- Résumé : ${profile.summary || ''}` : '';

    return `Tu es expert en recrutement. Rédige une lettre de motivation professionnelle et personnalisée.

${jobCtx}
${profCtx}

Instructions :
- Ton professionnel, humain, direct — pas de jargon creux
- Structure : accroche percutante → valeur ajoutée (2-3 points concrets) → motivation pour cette entreprise → closing
- 3-4 paragraphes, environ 250-300 mots
- Ne commence PAS par "Je me permets de" ou "Madame, Monsieur"
- Pas de formules bateau ("très motivé", "entreprise de renom", "rejoindre vos équipes")
- En français

Rédige uniquement le corps de la lettre (sans "Objet :", sans signature).`;
  }

  if (action === 'improve') {
    return `Améliore cette lettre de motivation pour le poste de ${job.title} chez ${job.company}.

Lettre actuelle :
${currentLetter}

Objectifs :
- Rendre l'accroche plus forte
- Préciser les arguments avec des exemples concrets
- Supprimer les formules creuses
- Garder la même longueur approximative
- En français

Retourne uniquement la lettre améliorée.`;
  }

  if (action === 'shorten') {
    return `Raccourcis cette lettre de motivation en 150-180 mots maximum, en gardant l'essentiel.

Lettre actuelle :
${currentLetter}

Garde : l'accroche, le point fort le plus pertinent pour ${job.title}, le closing.
Supprime : les redondances, les détails secondaires.

Retourne uniquement la lettre raccourcie.`;
  }

  if (action === 'punch') {
    return `Rends cette lettre de motivation plus percutante et mémorable pour ${job.title} chez ${job.company}.

Lettre actuelle :
${currentLetter}

Objectifs :
- Accroche inoubliable (données chiffrées, fait marquant, question rhétorique)
- Verbes d'action forts, phrases courtes et rythmées
- Supprimer tout ce qui est mou ou attendu
- Même longueur

Retourne uniquement la lettre transformée.`;
  }

  throw new Error('action invalide');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { job, profile, currentLetter, action = 'generate', apiKey } = req.body;
  if (!job) return res.status(400).json({ error: 'job requis' });
  if (action !== 'generate' && !currentLetter) {
    return res.status(400).json({ error: 'currentLetter requis pour cette action' });
  }

  const resolvedKey = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!resolvedKey) return res.status(400).json({ error: 'Clé API Anthropic manquante. Configurez-la dans Paramètres.' });

  const client = new Anthropic({ apiKey: resolvedKey });

  try {
    const prompt = buildPrompt(action, job, profile, currentLetter);
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }]
    });
    res.status(200).json({ success: true, letter: message.content[0].text.trim() });
  } catch (err) {
    console.error('[generate-letter] error:', err.message || err);
    res.status(500).json({ error: err.message || 'Erreur lors de la génération IA' });
  }
}
