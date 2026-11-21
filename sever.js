const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3001;

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
        res.end('Servidor da IA online!');
        return;
    }

    if (req.method === 'POST' && req.url === '/perguntar') {
        let body = '';
        req.on('data', chunk => { body += chunk; });

        req.on('end', () => {
            try {
                const { pergunta } = JSON.parse(body);
                const payload = JSON.stringify({
                    model: 'openai',
                    messages: [{ role: 'user', content: pergunta }]
                });

                const opcoes = {
                    hostname: 'text.pollinations.ai',
                    path: '/openai',
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Content-Length': Buffer.byteLength(payload),
                        'User-Agent': 'Mozilla/5.0'
                    }
                };

                const apiReq = https.request(opcoes, (apiRes) => {
                    let dados = '';
                    apiRes.on('data', chunk => { dados += chunk; });
                    apiRes.on('end', () => {
                        try {
                            const json = JSON.parse(dados);
                            const respostaIA = (json.choices && json.choices && json.choices.message && json.choices.message.content) || dados;
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ resposta: respostaIA }));
                        } catch {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ resposta: dados }));
                        }
                    });
                });

                apiReq.on('error', (erro) => {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ erro: 'Falha na IA: ' + erro.message }));
                });

                apiReq.write(payload);
                apiReq.end();
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
