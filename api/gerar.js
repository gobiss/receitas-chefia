export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ erro: 'Método não permitido' });

    const { ingredientes, nivel, idioma } = req.body;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const UNSPLASH_KEY = process.env.UNSPLASH_API_KEY;

    try {
        const prompt = `Crie uma receita em ${idioma} com: ${ingredientes}. Nível: ${nivel}. 
        Retorne APENAS um objeto JSON puro com as chaves: "titulo" e "receita".`;

        // MUDANÇA CRÍTICA: Trocando v1beta por v1 (Versão Estável de 2026)
        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const geminiData = await geminiResponse.json();

        // Se a API responder com erro, o alerta no site vai nos mostrar o motivo real agora
        if (geminiData.error) {
            return res.status(500).json({ erro: `Erro direto da API: ${geminiData.error.message}` });
        }

        let textoResposta = geminiData.candidates[0].content.parts[0].text;
        
        // Limpeza de segurança para extrair apenas o JSON
        const inicioJson = textoResposta.indexOf('{');
        const fimJson = textoResposta.lastIndexOf('}') + 1;
        const jsonPuro = textoResposta.substring(inicioJson, fimJson);
        
        const dadosReceita = JSON.parse(jsonPuro);

        // Busca de imagem no Unsplash
        const unsplashRes = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(dadosReceita.titulo)}&client_id=${UNSPLASH_KEY}&per_page=1`);
        const unsplashData = await unsplashRes.json();
        const imagemUrl = unsplashData.results?.[0]?.urls?.regular || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?q=80&w=800';

        res.status(200).json({
            titulo: dadosReceita.titulo,
            receita: dadosReceita.receita,
            imagem: imagemUrl
        });

    } catch (error) {
        res.status(500).json({ erro: "Erro interno na cozinha: " + error.message });
    }
}