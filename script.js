// --- 1. CONFIGURAÇÃO DO SUPABASE ---
const supabaseUrl = 'https://nsatdewodscygmftaric.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zYXRkZXdvZHNjeWdtZnRhcmljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5MDI1MDMsImV4cCI6MjA5MzQ3ODUwM30.6fiBar5NNZQe1Pa3j6DGakfBbjRBrbDoqtVEyyI9WRE';

// Alterado para 'supabaseClient' para evitar conflito com a biblioteca global
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);

const contadorElement = document.getElementById('numero-receitas');
const listaSalvos = document.getElementById('lista-salvos');

// Inicialização
async function init() {
    carregarContador();
    carregarSalvos();
}

async function carregarContador() {
    const { data } = await supabaseClient.from('global_stats').select('total_recipes_generated').eq('id', 1).single();
    if (data) contadorElement.innerText = data.total_recipes_generated;
}

// Escuta mudanças no contador em tempo real usando o novo nome da variável
supabaseClient.channel('public:global_stats').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'global_stats' }, payload => {
    contadorElement.innerText = payload.new.total_recipes_generated;
}).subscribe();

async function carregarSalvos() {
    const { data } = await supabaseClient.from('saved_recipes').select('*').order('created_at', { ascending: false });
    if (data) {
        listaSalvos.innerHTML = data.map(r => `
            <div class="recipe-card">
                <img src="${r.image_url || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?q=80&w=500'}" alt="${r.title}">
                <div class="recipe-info">
                    <h4>${r.title}</h4>
                    <p style="font-size: 0.8rem; color: #777;">Gerada em: ${new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <div class="recipe-actions">
                    <button onclick="compartilharWhatsApp('${encodeURIComponent(r.title)}', '${encodeURIComponent(r.instructions)}')" class="btn-wpp">WhatsApp</button>
                    <button onclick="gerarPDFManual('${encodeURIComponent(r.title)}', '${encodeURIComponent(r.instructions)}')" class="btn-pdf">PDF</button>
                </div>
            </div>
        `).join('');
    }
}

function compartilharWhatsApp(titulo, texto) {
    const msg = encodeURIComponent(`🍴 *${decodeURIComponent(titulo)}*\n\n${decodeURIComponent(texto)}`);
    window.open(`https://wa.me/?text=${msg}`, '_blank');
}

function gerarPDFManual(titulo, texto) {
    const tempDiv = document.createElement('div');
    tempDiv.style.padding = '40px';
    tempDiv.style.color = '#333';
    tempDiv.innerHTML = `<h1>${decodeURIComponent(titulo)}</h1><hr><p style="white-space: pre-wrap;">${decodeURIComponent(texto)}</p>`;
    html2pdf().from(tempDiv).save(`${decodeURIComponent(titulo)}.pdf`);
}

// Lógica de Geração
document.getElementById('btn-gerar').addEventListener('click', async () => {
    const btn = document.getElementById('btn-gerar');
    const ingredientes = document.getElementById('ingredientes').value;
    if(!ingredientes) return alert("Ingredientes necessários!");

    btn.innerText = "Cozinhando...";
    btn.disabled = true;

    try {
        const response = await fetch('/api/gerar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                ingredientes, 
                nivel: document.getElementById('nivel').value,
                idioma: document.getElementById('idioma').value 
            })
        });

        const dados = await response.json();
        
        document.getElementById('titulo-receita').innerText = dados.titulo;
        document.getElementById('conteudo-receita').innerText = dados.receita;
        document.getElementById('imagem-container').innerHTML = dados.imagem ? `<img src="${dados.imagem}" style="width:100%; border-radius:15px; margin:20px 0;">` : '';
        document.getElementById('resultado-receita').classList.remove('hidden');

        document.getElementById('btn-whatsapp').onclick = () => compartilharWhatsApp(encodeURIComponent(dados.titulo), encodeURIComponent(dados.receita));
        
        document.getElementById('btn-salvar').onclick = async () => {
            await supabaseClient.from('saved_recipes').insert([{
                title: dados.titulo,
                instructions: dados.receita,
                image_url: dados.imagem
            }]);
            alert("Receita salva!");
            carregarSalvos();
        };

        await supabaseClient.rpc('increment_recipe_counter');
    } catch (e) {
        alert("Erro ao conectar com a cozinha.");
    } finally {
        btn.innerText = "Criar Minha Receita";
        btn.disabled = false;
    }
});

document.getElementById('btn-pdf').addEventListener('click', () => {
    const element = document.getElementById('pdf-content');
    html2pdf().from(element).save();
});

init();