import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { cvBase64 } = req.body;
  if (!cvBase64) return res.status(400).json({ error: 'CV manquant' });

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: cvBase64 }
          },
          {
            type: 'text',
            text: `Analyse ce CV et retourne UNIQUEMENT ce JSON (sans markdown, sans explication) :
{
  "name": "Prénom Nom",
  "title": "Titre professionnel principal",
  "summary": "Résumé professionnel en 2 phrases max",
  "skills": ["skill1", "skill2"],
  "experience_years": 0,
  "education": "Diplôme le plus élevé",
  "languages": ["Français"],
  "job_titles": ["titre recherché 1", "titre recherché 2"],
  "search_keywords": ["mot-clé1", "mot-clé2"]
}`
          }
        ]
      }]
    });

    const raw = message.content[0].text.trim();
    let analysis;
    try { analysis = JSON.parse(raw); }
    catch { const m = raw.match(/\{[\s\S]*\}/); analysis = m ? JSON.parse(m[0]) : null; }

    if (!analysis) return res.status(500).json({ error: 'Erreur de parsing Claude' });
    res.status(200).json({ success: true, analysis });
  } catch (err) {
    console.error('analyze-cv error:', err);
    res.status(500).json({ error: err.message });
  }
}
