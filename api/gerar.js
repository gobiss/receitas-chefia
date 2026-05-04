// Aumenta o tempo limite do Vercel de 10s para 60s
export const maxDuration = 60;

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

    const { ingredientes, nivel, idioma } = req.body;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const UNSPLASH_KEY = process.env.UNSPLASH_API_KEY;

    try {
        // PROMPT BLINDADO: Obriga a IA a mandar a receita como TEXTO e não como JSON aninhado
        const prompt = `Crie uma receita em ${idioma} com: ${ingredientes}. Nível: ${nivel}. 
        Seja prático e direto.
        Retorne APENAS um objeto JSON puro. O JSON DEVE ter exatamente este formato:
        {
          "titulo": "Nome do Prato",
          "receita": "Texto completo da receita com ingredientes e instruções, usando quebras de linha (\\n)."
        }
        ATENÇÃO: NUNCA coloque arrays, listas ou outros objetos dentro da chave "receita". Ela DEVE ser uma string de texto único.`;

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const geminiData = await geminiResponse.json();

        if (geminiData.error) {
            return res.status(500).json({ erro: `Erro interno da API: ${geminiData.error.message}` });
        }

        let textoResposta = geminiData.candidates[0].content.parts[0].text;
        
        const inicioJson = textoResposta.indexOf('{');
        const fimJson = textoResposta.lastIndexOf('}') + 1;
        const jsonPuro = textoResposta.substring(inicioJson, fimJson);
        
        const dadosReceita = JSON.parse(jsonPuro);

        // Se a IA desobedecer e mandar um objeto, a gente transforma em string forçadamente
        let receitaFinal = dadosReceita.receita;
        if (typeof receitaFinal === 'object') {
            receitaFinal = JSON.stringify(receitaFinal);
        }

        const unsplashRes = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(dadosReceita.titulo)}&client_id=${UNSPLASH_KEY}&per_page=1`);
        const unsplashData = await unsplashRes.json();
        const imagemUrl = unsplashData.results?.[0]?.urls?.regular || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?q=80&w=800';

        res.status(200).json({
            titulo: dadosReceita.titulo,
            receita: receitaFinal,
            imagem: imagemUrl
        });

    } catch (error) {
        res.status(500).json({ erro: "Erro ao processar receita: " + error.message });
    }
}