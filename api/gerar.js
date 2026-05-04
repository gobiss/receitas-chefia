export default async function handler(req, res) {
    // 1. Só aceita requisições do tipo POST
    if (req.method !== 'POST') {
        return res.status(405).json({ erro: 'Método não permitido' });
    }

    const { ingredientes, nivel } = req.body;

    // Puxa as chaves que vamos configurar lá no painel do Vercel depois
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const UNSPLASH_KEY = process.env.UNSPLASH_API_KEY;

    try {
        // --- PARTE 1: CHAMANDO O GEMINI ---
        const prompt = `Atue como um chef de cozinha. Crie uma receita usando os seguintes ingredientes (pode adicionar itens básicos como sal, óleo, etc): ${ingredientes}. 
        O nível da receita deve ser: ${nivel}. 
        Se for nível "profissional", utilize técnicas clássicas, termos de praça e empratamento focado. Se for "simples", faça algo prático para o dia a dia.
        Retorne o resultado estritamente no formato JSON, com duas chaves: "titulo" (o nome do prato criado) e "receita" (o passo a passo completo). Não adicione crases (\`\`\`) de formatação, devolva apenas o objeto JSON puro.`;

        const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const geminiData = await geminiResponse.json();
        const textoResposta = geminiData.candidates[0].content.parts[0].text;
        const dadosReceita = JSON.parse(textoResposta); // Transforma o texto em um objeto Javascript

        // --- PARTE 2: CHAMANDO O UNSPLASH ---
        // Usa o título que o Gemini gerou para buscar a foto
        const unsplashResponse = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(dadosReceita.titulo)}&client_id=${UNSPLASH_KEY}&per_page=1&orientation=landscape`);
        const unsplashData = await unsplashResponse.json();
        
        let imagemUrl = '';
        if (unsplashData.results && unsplashData.results.length > 0) {
            imagemUrl = unsplashData.results[0].urls.regular;
        }

        // --- PARTE 3: DEVOLVENDO TUDO PARA O SEU SITE ---
        res.status(200).json({
            titulo: dadosReceita.titulo,
            receita: dadosReceita.receita,
            imagem: imagemUrl
        });

    } catch (error) {
        console.error("Erro na API:", error);
        res.status(500).json({ erro: 'Falha ao gerar receita.' });
    }
}