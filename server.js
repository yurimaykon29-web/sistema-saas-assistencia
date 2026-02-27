const express = require('express');
const path = require('path');
const loki = require('lokijs');
const bcrypt = require('bcrypt'); // para senhas
const app = express();

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// DB
const db = new loki('yuri_celulares.db', { autosave: true, autosaveInterval: 1000, autoload: true, autoloadCallback: initDB });
let ordens, tecnicos;

function initDB() {
    ordens = db.getCollection('ordens') || db.addCollection('ordens');
    tecnicos = db.getCollection('tecnicos') || db.addCollection('tecnicos');

    // --- USUÁRIO ADMIN INICIAL ---
    if (!tecnicos.findOne({ email: "admin@yuri.com" })) {
        bcrypt.hash("SenhaADM123", 10).then(hash => {
            tecnicos.insert({ 
                id: Date.now(), 
                nome: "ADMIN", 
                email: "admin@yuri.com", 
                senha: hash 
            });
            db.saveDatabase();
            console.log("Usuário ADM criado: admin@yuri.com / SenhaADM123");
        });
    }
}

// ---- ROTAS DE PÁGINAS ----
app.use(express.static(path.join(__dirname, 'public')));

// ---- LOGIN / CADASTRO TECNICO ----
app.post('/cadastrar-tecnico', async (req, res) => {
    const { nome, email, senha } = req.body;
    if(tecnicos.findOne({ email })) return res.status(400).json({ erro: "Email já cadastrado" });
    const hash = await bcrypt.hash(senha, 10);
    const novo = { id: Date.now(), nome, email, senha: hash };
    tecnicos.insert(novo);
    db.saveDatabase();
    res.json({ mensagem: "OK", tecnicoId: novo.id });
});

app.post('/login-tecnico', async (req, res) => {
    const { email, senha } = req.body;
    const t = tecnicos.findOne({ email });
    if(!t) return res.status(401).json({ erro: "Usuário não encontrado" });
    const ok = await bcrypt.compare(senha, t.senha);
    if(ok) res.json({ tecnicoId: t.id, nome: t.nome });
    else res.status(401).json({ erro: "Senha incorreta" });
});

// ---- SALVAR ORDEM (CLIENTE) ----
app.post('/salvar', (req, res) => {
    const cpfLimpo = req.body.cpf.replace(/\D/g, "");
    const novaEntrada = { 
        ...req.body, 
        cpf: cpfLimpo, 
        excluido: false, 
        data_ms: Date.now(), 
        data_registro: new Date().toLocaleString('pt-BR'), 
        status: 'A caminho da loja',
        fotos: [],
        valor_peca: 0,
        gasto_gasolina: 0,
        fornecedor: "",
        valor_total: 0,
        obs_interna: "",
        tecnicoId: req.body.tecnicoId || null
    };
    ordens.insert(novaEntrada);
    db.saveDatabase();
    res.json({ mensagem: "OK", cpf: cpfLimpo });
});

// ---- BUSCAR ORDENS ----
app.get('/todas-os/:tecnicoId', (req, res) => {
    const tecnicoId = parseInt(req.params.tecnicoId);
    res.json(ordens.find({ excluido: false, tecnicoId }));
});
app.get('/lixeira-os/:tecnicoId', (req, res) => {
    const tecnicoId = parseInt(req.params.tecnicoId);
    res.json(ordens.find({ excluido: true, tecnicoId }));
});
app.get('/historico/:cpf', (req, res) => {
    const cpf = req.params.cpf.replace(/\D/g, "");
    const tecnicoId = req.query.tecnicoId ? parseInt(req.query.tecnicoId) : null;
    let filtro = { cpf };
    if(tecnicoId) filtro.tecnicoId = tecnicoId;
    res.json(ordens.find(filtro));
});

// ---- RELATÓRIO MENSAL ----
app.get('/relatorio-mensal/:tecnicoId', (req, res) => {
    const tecnicoId = parseInt(req.params.tecnicoId);
    const agora = new Date();
    const mesAtual = agora.getMonth();
    const anoAtual = agora.getFullYear();

    const todas = ordens.find({ excluido: false, tecnicoId });
    
    let totalBruto = 0, totalPecas = 0, totalGasolina = 0, servicosRealizados = 0;

    todas.forEach(os => {
        const dataOS = new Date(os.data_ms);
        if(dataOS.getMonth() === mesAtual && dataOS.getFullYear() === anoAtual){
            totalBruto += parseFloat(os.valor_total || 0);
            totalPecas += parseFloat(os.valor_peca || 0);
            totalGasolina += parseFloat(os.gasto_gasolina || 0);
            servicosRealizados++;
        }
    });

    const lucroLiquido = totalBruto - (totalPecas + totalGasolina);
    res.json({ mes: agora.toLocaleString('pt-BR', { month: 'long' }), totalBruto, totalPecas, totalGasolina, lucroLiquido, servicosRealizados });
});

// ---- ATUALIZAR ORDEM ----
app.post('/atualizar-os', (req, res) => {
    const os = ordens.findOne({ cpf: req.body.cpf, data_ms: req.body.data_ms });
    if(os){
        if(req.body.deletarReal === true){
            ordens.remove(os);
        } else {
            if(req.body.novaFoto){
                if(!os.fotos) os.fotos = [];
                if(os.fotos.length < 10) os.fotos.push(req.body.novaFoto);
                delete req.body.novaFoto;
            }
            Object.assign(os, req.body);
            ordens.update(os);
        }
        db.saveDatabase();
        res.json({ mensagem: "OK" });
    } else res.status(404).send();
});

app.listen(3000, () => console.log("🚀 SISTEMA YURI CELULARES V2.0 - LOGIN E LINK ATIVO"));
