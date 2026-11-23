const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3001;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const HOST_GROQ = String.fromCharCode(97,112,105,46,103,114,111,113,46,99,111,109);

function obterModeloChat(callback) {
    const opcoes = {
        hostname: HOST_GROQ,
        path: '/openai/v1/models',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` }
    };

    https.get(opcoes, (res) => {
        let dados = '';
        res.on('data', chunk => { dados += chunk; });
        res.on('end', () => {
            try {
                const json = JSON.parse(dados);
                if (!json.data) {
                    return callback(new Error("Chave API inválida: " + dados));
                }
                const modelosTexto = json.data.filter(m => 
                    !m.id.includes('whisper') &&
                    !m.id.includes('guard') &&
                    !m.id.includes('tts') &&
                    !m.id.includes('playai') &&
                    !m.id.includes('orpheus')
                );
                const preferido = modelosTexto.find(m => m.id.includes('llama') || m.id.includes('gemma'))
                    || modelosTexto.find(m => m.id.includes('qwen'))
                    || modelosTexto.at(0);

                callback(null, preferido ? preferido.id : 'llama-3.1-8b-instant');
            } catch (e) {
                callback(e);
            }
        });
    }).on('error', (e) => callback(e));
}

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Servidor da IA online com Groq e Memoria!');
        return;
    }

    if (req.method === 'POST' && req.url === '/perguntar') {
        let body = '';
        req.on('data', chunk => { body += chunk; });

        req.on('end', () => {
            try {
                const dadosRecebidos = JSON.parse(body);
                const historico = dadosRecebidos.historico || [{ role: 'user', content: dadosRecebidos.pergunta }];

                obterModeloChat((err, modeloEscolhido) => {
                    if (err) {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ resposta: err.message }));
                        return;
                    }

                    const mensagensCompletas = [
                        { role: 'system', content: 'Você é a IA R, uma assistente inteligente, simpática e com boa memória que sempre responde de forma natural e objetiva em português do Brasil.' },
                        ...historico
                    ];

                    const payload = JSON.stringify({
                        model: modeloEscolhido,
                        max_tokens: 800,
                        messages: mensagensCompletas
                    });

                    const opcoes = {
                        hostname: HOST_GROQ,
                        path: '/openai/v1/chat/completions',
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${GROQ_API_KEY}`,
                            'Content-Length': Buffer.byteLength(payload)
                        }
                    };

                    const apiReq = https.request(opcoes, (apiRes) => {
                        let dados = '';
                        apiRes.on('data', chunk => { dados += chunk; });
                        apiRes.on('end', () => {
                            try {
                                const json = JSON.parse(dados);
                                const respostaIA = json.choices.at(0).message.content;
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ resposta: respostaIA }));
                            } catch {
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ resposta: "Erro da API (" + modeloEscolhido + "): " + dados }));
                            }
                        });
                    });

                    apiReq.on('error', (erro) => {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ erro: 'Falha no Groq: ' + erro.message }));
                    });

                    apiReq.write(payload);
                    apiReq.end();
                });
            } catch (erro) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ erro: 'Erro interno: ' + erro.message }));
            }
        });
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('Servidor rodando na porta ' + PORT);
});
