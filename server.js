const express = require('express');
const path = require('path');
const loki = require('lokijs');

const app = express();

// LIMITE PARA SUPORTAR FOTOS E DADOS DO FINANCEIRO
app.use(express.json({ limit: '20mb' })); 
app.use(express.urlencoded({ limit: '20mb', extended: true }));

const db = new loki('yuri_celulares.db', { 
    autosave: true, 
    autosaveInterval: 1000, 
    autoload: true, 
    autoloadCallback: () => {
        ordens = db.getCollection('ordens') || db.addCollection('ordens');
    }
});
let ordens;

// ROTAS DE PÁGINAS
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/painel', (req, res) => res.sendFile(path.join(__dirname, 'consulta.html')));
app.get('/cliente', (req, res) => res.sendFile(path.join(__dirname, 'cliente.html')));

// SALVAR NOVA ORDEM (CLIENTE)
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
        // NOVOS CAMPOS FINANCEIROS INICIALIZADOS
        valor_peca: 0,
        gasto_gasolina: 0,
        fornecedor: "",
        valor_total: 0,
        obs_interna: ""
    };
    ordens.insert(novaEntrada);
    res.json({ mensagem: "OK", cpf: cpfLimpo });
});

// BUSCAR ORDENS
app.get('/todas-os', (req, res) => res.json(ordens.find({ excluido: false })));
app.get('/lixeira-os', (req, res) => res.json(ordens.find({ excluido: true })));
app.get('/historico/:cpf', (req, res) => res.json(ordens.find({ cpf: req.params.cpf.replace(/\D/g, "") })));

// ROTA DO RELATÓRIO MENSAL (O PAINEL DO RICO)
app.get('/relatorio-mensal', (req, res) => {
    const agora = new Date();
    const mesAtual = agora.getMonth();
    const anoAtual = agora.getFullYear();

    const todas = ordens.find({ excluido: false });
    
    let totalBruto = 0;
    let totalPecas = 0;
    let totalGasolina = 0;
    let servicosRealizados = 0;

    todas.forEach(os => {
        const dataOS = new Date(os.data_ms);
        if (dataOS.getMonth() === mesAtual && dataOS.getFullYear() === anoAtual) {
            totalBruto += parseFloat(os.valor_total || 0);
            totalPecas += parseFloat(os.valor_peca || 0);
            totalGasolina += parseFloat(os.gasto_gasolina || 0);
            servicosRealizados++;
        }
    });

    const lucroLiquido = totalBruto - (totalPecas + totalGasolina);

    res.json({
        mes: agora.toLocaleString('pt-BR', { month: 'long' }),
        totalBruto,
        totalPecas,
        totalGasolina,
        lucroLiquido,
        servicosRealizados
    });
});

// ATUALIZAR ORDEM (ADM)
app.post('/atualizar-os', (req, res) => {
    const os = ordens.findOne({ cpf: req.body.cpf, data_ms: req.body.data_ms });
    if (os) {
        if (req.body.deletarReal === true) {
            ordens.remove(os);
        } else {
            // LÓGICA DE FOTOS
            if (req.body.novaFoto) {
                if (!os.fotos) os.fotos = [];
                if (os.fotos.length < 10) {
                    os.fotos.push(req.body.novaFoto);
                }
                delete req.body.novaFoto; 
            }
            
            // PRESERVAÇÃO E ATUALIZAÇÃO DOS DADOS (INCLUINDO OS NOVOS CAMPOS)
            Object.assign(os, req.body);
            ordens.update(os);
        }
        db.saveDatabase();
        res.json({ mensagem: "OK" });
    } else { res.status(404).send(); }
});

app.listen(3000, () => console.log("🚀 SISTEMA YURI CELULARE V2.0 - FINANCEIRO ATIVADO"));
