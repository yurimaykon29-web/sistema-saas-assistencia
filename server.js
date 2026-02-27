const express = require('express');
const path = require('path');
const loki = require('lokijs');

const app = express();

// LIMITE PARA SUPORTAR FOTOS E DADOS DO FINANCEIRO
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: true }));

// Banco de dados
const db = new loki('yuri_celulares.db', {
    autosave: true,
    autosaveInterval: 1000,
    autoload: true,
    autoloadCallback: () => {
        // coleções
        ordens = db.getCollection('ordens') || db.addCollection('ordens');
        tecnicos = db.getCollection('tecnicos') || db.addCollection('tecnicos');
    }
});
let ordens, tecnicos;

// ROTAS DE PÁGINAS
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/painel', (req, res) => res.sendFile(path.join(__dirname, 'consulta.html')));
app.get('/cliente', (req, res) => res.sendFile(path.join(__dirname, 'cliente.html')));

// --- CADASTRO DE TÉCNICO ---
app.post('/cadastrar-tecnico', (req, res) => {
    const { nome, email, senha } = req.body;
    const existe = tecnicos.findOne({ email });
    if (existe) return res.status(400).json({ mensagem: "E-mail já cadastrado" });

    const novo = {
        id: Date.now().toString(), // ID único
        nome,
        email,
        senha,
        plano: "gratuito",
        ativo: true
    };
    tecnicos.insert(novo);
    res.json({ mensagem: "Técnico cadastrado", tecnicoId: novo.id });
});

// --- LOGIN TÉCNICO ---
app.post('/login-tecnico', (req, res) => {
    const { email, senha } = req.body;
    const tecnico = tecnicos.findOne({ email, senha, ativo: true });
    if (!tecnico) return res.status(401).json({ mensagem: "Credenciais inválidas" });
    res.json({ mensagem: "OK", tecnicoId: tecnico.id, nome: tecnico.nome });
});

// SALVAR NOVA ORDEM (CLIENTE)
app.post('/salvar', (req, res) => {
    const cpfLimpo = req.body.cpf.replace(/\D/g, "");
    const { tecnicoId } = req.body; // ID do técnico que vai receber a OS
    if (!tecnicoId) return res.status(400).json({ mensagem: "Técnico não definido" });

    const novaEntrada = {
        ...req.body,
        cpf: cpfLimpo,
        excluido: false,
        data_ms: Date.now(),
        data_registro: new Date().toLocaleString('pt-BR'),
        status: 'A caminho da loja',
        fotos: [],
        tecnicoId,
        valor_peca: 0,
        gasto_gasolina: 0,
        fornecedor: "",
        valor_total: 0,
        obs_interna: ""
    };
    ordens.insert(novaEntrada);
    res.json({ mensagem: "OK", cpf: cpfLimpo });
});

// BUSCAR ORDENS DO TÉCNICO LOGADO
app.get('/ordens/:tecnicoId', (req, res) => {
    const tecnicoId = req.params.tecnicoId;
    res.json(ordens.find({ excluido: false, tecnicoId }));
});

// BUSCAR HISTÓRICO DE UM CLIENTE
app.get('/historico/:cpf', (req, res) => {
    const cpf = req.params.cpf.replace(/\D/g, "");
    res.json(ordens.find({ cpf }));
});

// ATUALIZAR ORDEM (ADM / TÉCNICO)
app.post('/atualizar-os', (req, res) => {
    const os = ordens.findOne({ cpf: req.body.cpf, data_ms: req.body.data_ms });
    if (os) {
        if (req.body.deletarReal === true) {
            ordens.remove(os);
        } else {
            if (req.body.novaFoto) {
                if (!os.fotos) os.fotos = [];
                if (os.fotos.length < 10) os.fotos.push(req.body.novaFoto);
                delete req.body.novaFoto;
            }
            Object.assign(os, req.body);
            ordens.update(os);
        }
        db.saveDatabase();
        res.json({ mensagem: "OK" });
    } else { res.status(404).send(); }
});

app.listen(3000, () => console.log("🚀 Sistema multi-técnico ativo!"));
