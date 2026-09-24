// Gera os ícones do PWA a partir do SVG do logotipo.
// Uso: node scripts/gerar-icones.mjs   (usa o "sharp", já instalado com o Next.js)
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const FUNDO = '#0B0F14';
const AZUL = '#2563EB';
const CLARO = '#E8ECF2';

// Símbolo em área 512x512. `raio` = cantos; `escala` encolhe o "N" (zona segura do maskable).
function svg({ raio = 120, escala = 1 } = {}) {
  const t = (512 - 512 * escala) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${raio}" fill="${FUNDO}"/>
  <g transform="translate(${t} ${t}) scale(${escala})">
    <rect x="136" y="128" width="68" height="256" rx="22" fill="${AZUL}"/>
    <rect x="308" y="128" width="68" height="256" rx="22" fill="${AZUL}"/>
    <path d="M176 164 L336 348" stroke="${CLARO}" stroke-width="60" stroke-linecap="round"/>
  </g>
</svg>`;
}

await mkdir('public/icons', { recursive: true });
await writeFile('public/icons/icon.svg', svg());

const png = (conteudo, tamanho, arquivo) =>
  sharp(Buffer.from(conteudo)).resize(tamanho, tamanho).png().toFile(arquivo);

await png(svg(), 192, 'public/icons/icon-192.png');
await png(svg(), 512, 'public/icons/icon-512.png');
// Maskable: fundo ocupando tudo (sem cantos) e símbolo dentro da zona segura (80%).
await png(svg({ raio: 0, escala: 0.8 }), 512, 'public/icons/icon-maskable-512.png');
// iOS aplica os cantos arredondados sozinho.
await png(svg({ raio: 0, escala: 0.9 }), 180, 'public/icons/apple-touch-icon.png');
// Favicon (PNG dentro de .ico é aceito por todos os navegadores modernos).
const fav = await sharp(Buffer.from(svg({ raio: 96 }))).resize(32, 32).png().toBuffer();
const cabecalho = Buffer.alloc(22);
cabecalho.writeUInt16LE(0, 0);
cabecalho.writeUInt16LE(1, 2);
cabecalho.writeUInt16LE(1, 4);
cabecalho.writeUInt8(32, 6);
cabecalho.writeUInt8(32, 7);
cabecalho.writeUInt8(0, 8);
cabecalho.writeUInt8(0, 9);
cabecalho.writeUInt16LE(1, 10);
cabecalho.writeUInt16LE(32, 12);
cabecalho.writeUInt32LE(fav.length, 14);
cabecalho.writeUInt32LE(22, 18);
await writeFile('public/favicon.ico', Buffer.concat([cabecalho, fav]));

console.log('Ícones gerados em public/icons e public/favicon.ico');
