export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    const { ingredientes, nivel, idioma } = req.body;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const UNSPLASH_KEY = process.env.UNSPLASH_API_KEY;

    try {
        const prompt = `Crie uma receita em ${idioma} com: ${ingredientes}. Nível: ${nivel}. 
        Retorne APENAS um objeto JSON puro, sem markdown, com as chaves: "titulo" e "receita".`;

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const geminiData = await geminiResponse.json();

        // --- DEBUG CRÍTICO ---
        // Se a API do Gemini retornar erro, a gente captura aqui antes de quebrar
        if (geminiData.error) {
            console.error("Erro retornado pelo Gemini:", geminiData.error);
            return res.status(500).json({ erro: `Erro na API do Gemini: ${geminiData.error.message}` });
        }

        if (!geminiData.candidates || geminiData.candidates.length === 0) {
            console.error("Gemini não retornou candidatos. Resposta completa:", JSON.stringify(geminiData));
            return res.status(500).json({ erro: "O Gemini não gerou uma resposta. Verifique os logs do Vercel." });
        }

        let textoResposta = geminiData.candidates[0].content.parts[0].text;
        
        // Limpa o texto caso o Gemini ignore o pedido de "apenas JSON"
        const inicioJson = textoResposta.indexOf('{');
        const fimJson = textoResposta.lastIndexOf('}') + 1;
        const jsonPuro = textoResposta.substring(inicioJson, fimJson);
        
        const dadosReceita = JSON.parse(jsonPuro);

        // --- BUSCA NO UNSPLASH ---
        const unsplashRes = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(dadosReceita.titulo)}&client_id=${UNSPLASH_KEY}&per_page=1`);
        const unsplashData = await unsplashRes.json();
        const imagemUrl = unsplashData.results?.[0]?.urls?.regular || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?q=80&w=800';

        res.status(200).json({
            titulo: dadosReceita.titulo,
            receita: dadosReceita.receita,
            imagem: imagemUrl
        });

    } catch (error) {
        console.error("Erro interno no servidor:", error);
        res.status(500).json({ erro: "Erro ao processar a receita: " + error.message });
    }
}