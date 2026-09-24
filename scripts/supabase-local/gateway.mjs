// Gateway HTTP mínimo que imita o roteamento do Supabase (Kong) em testes locais
// sem Docker:  /auth/v1/* -> GoTrue   |   /rest/v1/* -> PostgREST
// Uso: node scripts/supabase-local/gateway.mjs
import http from 'node:http';

const PORTA = Number(process.env.GATEWAY_PORT ?? 54321);
const ROTAS = [
  { prefixo: '/auth/v1', destino: { host: '127.0.0.1', port: Number(process.env.GOTRUE_PORT ?? 9999) } },
  { prefixo: '/rest/v1', destino: { host: '127.0.0.1', port: Number(process.env.POSTGREST_PORT ?? 3001) } },
];

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

http
  .createServer((req, res) => {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, CORS);
      res.end();
      return;
    }
    const rota = ROTAS.find((r) => req.url?.startsWith(r.prefixo));
    if (!rota) {
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: 'rota não encontrada' }));
      return;
    }
    const caminho = req.url.slice(rota.prefixo.length) || '/';
    const headers = { ...req.headers, host: `${rota.destino.host}:${rota.destino.port}` };
    const proxy = http.request(
      { ...rota.destino, path: caminho, method: req.method, headers },
      (resp) => {
        res.writeHead(resp.statusCode ?? 502, { ...resp.headers, ...CORS });
        resp.pipe(res);
      },
    );
    proxy.on('error', (erro) => {
      res.writeHead(502, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ message: `gateway: ${erro.message}` }));
    });
    req.pipe(proxy);
  })
  .listen(PORTA, '127.0.0.1', () => {
    console.log(`[gateway] http://127.0.0.1:${PORTA}`);
  });
