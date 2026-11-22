const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3001;

function perguntarIA(pergunta, callback) {
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
                if (json.choices && json.choices[0] && json.choices[0].message) {
                    callback(null, json.choices[0].message.content);
                } else if (json.error && json.error.code === 'FREE_LIMIT') {
                    callback(null, "Aguarde alguns segundos antes de mandar outra pergunta (limite gratuito atingido).");
                } else {
                    callback(null, "A IA está ocupada agora, tente enviar novamente em instantes.");
                }
            } catch {
                callback(null, dados);
            }
        });
    });

    apiReq.on('error', (erro) => callback(erro));
    apiReq.write(payload);
    apiReq.end();
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
        res.end('Servidor da IA online!');
        return;
    }

    if (req.method === 'POST' && req.url === '/perguntar') {
        let body = '';
        req.on('data', chunk => { body += chunk; });

        req.on('end', () => {
            try {
                const { pergunta } = JSON.parse(body);
                perguntarIA(pergunta, (erro, respostaIA) => {
                    if (erro) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ erro: 'Falha na IA: ' + erro.message }));
                    } else {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ resposta: respostaIA }));
                    }
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
