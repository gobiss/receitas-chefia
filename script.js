// --- 1. CONFIGURAÇÃO DO SUPABASE ---
const supabaseUrl = 'https://nsatdewodscygmftaric.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zYXRkZXdvZHNjeWdtZnRhcmljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDI1MDMsImV4cCI6MjA5MzQ3ODUwM30.6fiBar5NNZQe1Pa3j6DGakfBbjRBrbDoqtVEyyI9WRE';

const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
const contadorElement = document.getElementById('numero-receitas');
const listaSalvos = document.getElementById('lista-salvos');

// Função de segurança para evitar que o inglês (apóstrofos) quebre os botões HTML
const safeEncode = (str) => encodeURIComponent(str).replace(/'/g, "%27");

async function init() {
    carregarContador();
    carregarSalvos();
}

async function carregarContador() {
    try {
        const { data } = await supabaseClient.from('global_stats').select('total_recipes_generated').eq('id', 1).single();
        if (data) contadorElement.innerText = data.total_recipes_generated;
    } catch (err) {
        console.error("Erro ao carregar contador:", err);
    }
}

supabaseClient.channel('public:global_stats').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'global_stats' }, payload => {
    contadorElement.innerText = payload.new.total_recipes_generated;
}).subscribe();

// --- 2. CARREGAR E EXIBIR RECEITAS ---
async function carregarSalvos() {
    try {
        const { data } = await supabaseClient.from('saved_recipes').select('*').order('created_at', { ascending: false });
        if (data) {
            listaSalvos.innerHTML = data.map(r => `
                <div class="recipe-card" style="border: 1px solid #ddd; border-radius: 10px; overflow: hidden; background: #fff; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                    <img src="${r.image_url}" alt="${r.title}" style="width: 100%; height: 200px; object-fit: cover;">
                    <div class="recipe-info" style="padding: 15px;">
                        <h4 style="margin: 0 0 10px 0; color: #d35400;">${r.title}</h4>
                        <p style="font-size: 0.8rem; color: #777; margin-bottom: 15px;">Gerada em: ${new Date(r.created_at).toLocaleDateString()}</p>
                        
                        <div class="recipe-actions" style="display: flex; gap: 8px; flex-wrap: wrap;">
                            <button onclick="abrirModalReceita('${safeEncode(r.title)}', '${safeEncode(r.instructions)}', '${r.image_url}')" style="background: #e67e22; color: #fff; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; flex: 1;">Ver Receita</button>
                            <button onclick="compartilharWhatsApp('${safeEncode(r.title)}', '${safeEncode(r.instructions)}')" style="background: #25D366; color: #fff; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; flex: 1;">WhatsApp</button>
                            <button onclick="gerarPDFManual('${safeEncode(r.title)}', '${safeEncode(r.instructions)}')" style="background: #e74c3c; color: #fff; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; flex: 1;">PDF</button>
                            <button onclick="deletarReceita('${r.id}')" style="background: #333; color: #fff; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer; flex: 1;">Apagar</button>
                        </div>
                    </div>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error("Erro ao carregar salvos:", err);
    }
}

// --- 3. FUNÇÕES DE CRUD E UI ---
window.deletarReceita = async function(id) {
    if(confirm("Tem certeza que deseja apagar esta receita da sua galeria?")) {
        try {
            await supabaseClient.from('saved_recipes').delete().eq('id', id);
            carregarSalvos(); 
        } catch (err) {
            alert("Erro ao apagar receita.");
        }
    }
}

window.abrirModalReceita = function(tituloCode, textoCode, imgUrl) {
    const titulo = decodeURIComponent(tituloCode);
    const texto = decodeURIComponent(textoCode);

    let modal = document.getElementById('receita-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'receita-modal';
        modal.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; justify-content:center; align-items:center; z-index:9999; padding:20px;";
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div style="background:#fff; max-width:700px; width:100%; max-height:85vh; overflow-y:auto; border-radius:15px; padding:30px; position:relative; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
            <button onclick="document.getElementById('receita-modal').style.display='none'" style="position:absolute; top:15px; right:15px; background:#e74c3c; color:white; border:none; border-radius:50%; width:35px; height:35px; cursor:pointer; font-weight:bold; font-size: 16px;">X</button>
            <img src="${imgUrl}" style="width:100%; height:300px; object-fit:cover; border-radius:10px; margin-bottom:20px;">
            <h2 style="color:#d35400; margin-bottom:20px; font-size: 28px;">${titulo}</h2>
            <p style="white-space: pre-wrap; color:#444; line-height:1.8; font-size: 16px; font-family: sans-serif;">${texto}</p>
        </div>
    `;
    modal.style.display = 'flex';
}

function compartilharWhatsApp(tituloCode, textoCode) {
    const msg = encodeURIComponent(`🍴 *${decodeURIComponent(tituloCode)}*\n\n${decodeURIComponent(textoCode)}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
}

// NOVA SOLUÇÃO DEFINITIVA DO PDF (Usando PDFMake)
window.gerarPDFManual = function(tituloCode, textoCode) {
    const titulo = decodeURIComponent(tituloCode);
    const texto = decodeURIComponent(textoCode);

    // O PDFMake constrói o PDF diretamente via JSON, ignorando o HTML e a tela
    const docDefinition = {
        content: [
            { text: titulo, style: 'header' },
            // Linha divisória
            { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 1, lineColor: '#cccccc' }] },
            { text: '\n\n' }, // Espaço
            { text: texto, style: 'body' }
        ],
        styles: {
            header: {
                fontSize: 22,
                bold: true,
                color: '#d35400',
                alignment: 'center',
                margin: [0, 0, 0, 10]
            },
            body: {
                fontSize: 12,
                lineHeight: 1.5,
                color: '#333333'
            }
        },
        defaultStyle: {
            font: 'Roboto'
        }
    };

    // Gera e baixa o arquivo instantaneamente
    pdfMake.createPdf(docDefinition).download(`${titulo.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
}

// --- 4. GERAÇÃO MÁGICA COM AUTO-SAVE ---
document.getElementById('btn-gerar').addEventListener('click', async () => {
    const btn = document.getElementById('btn-gerar');
    const ingredientes = document.getElementById('ingredientes').value;
    const nivel = document.getElementById('nivel').value;
    const idioma = document.getElementById('idioma').value;

    if(!ingredientes) return alert("Ingredientes necessários!");

    btn.innerText = "Cozinhando...";
    btn.disabled = true;

    try {
        const response = await fetch('/api/gerar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ingredientes, nivel, idioma })
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.erro || "Falha na API");
        }
        
        const dados = await response.json();

        await supabaseClient.from('saved_recipes').insert([{
            title: dados.titulo,
            instructions: dados.receita,
            image_url: dados.imagem
        }]);
        await supabaseClient.rpc('increment_recipe_counter');

        await carregarSalvos();

        const sectionSalvos = document.getElementById('lista-salvos');
        if (sectionSalvos) {
            sectionSalvos.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        
        document.getElementById('ingredientes').value = '';

    } catch (e) {
        console.error(e);
        alert("Erro ao conectar com a cozinha: A receita demorou demais para ficar pronta ou ocorreu uma falha.");
    } finally {
        btn.innerText = "Criar Minha Receita";
        btn.disabled = false;
    }
});

init();