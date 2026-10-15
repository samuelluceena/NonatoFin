/**
 * Importação de lançamentos a partir de planilhas (CSV).
 * Regras: docs/REGRAS-DE-NEGOCIO.md (seção Importação de planilha).
 *
 * Tudo aqui é puro: lê o texto do arquivo, interpreta cada linha e decide o
 * que entra, o que fica de fora (e por quê) e o que precisa ser conferido
 * antes. O servidor junta o que só o banco sabe (linhas já importadas e
 * lançamentos que coincidem) com `aplicarDadosDoBanco` — a mesma função roda
 * na prévia e na confirmação, então as duas dão sempre o mesmo resultado.
 */
import { ehCodigoValido } from './codigo-barras';
import { converterDataBR, ehDataISOValida, formatarData, type DataISO } from './datas';
import { somarCentavos, type Centavos } from './dinheiro';
import { limparNome, normalizarNome } from './fornecedores';

// ------------------------------------------------------------------ limites --

export const LIMITES_IMPORTACAO = {
  /** Tamanho máximo do arquivo (bytes). */
  bytesArquivo: 900 * 1024,
  /** Linhas de dados no arquivo. */
  linhasArquivo: 5000,
  /** Lançamentos gravados de uma vez (igual ao limite da função do banco). */
  lancamentosPorLote: 3000,
  descricao: 200,
  fornecedor: 120,
  categoria: 40,
  contaOrigem: 120,
} as const;

/** Categoria usada quando a linha não tem categoria. */
export const CATEGORIA_SEM_NOME = 'Importados sem categoria';

// ------------------------------------------------------------------- tipos --

/** Linha fora da importação (nunca entra por este fluxo). */
export type MotivoExclusao = 'sem-dados' | 'invalida' | 'paga' | 'entrada' | 'valor-zero' | 'vencida' | 'fora-do-periodo' | 'ja-importada';

/** Linha que precisa ser conferida antes de entrar. */
export type MotivoConferencia = 'duplicada-no-arquivo' | 'provavel-duplicada' | 'possivel-fatura-cartao' | 'coincide-com-existente';

export type SituacaoLinha = 'importar' | 'conferir' | 'excluida';

export interface LinhaImportacao {
  /** Número da linha no arquivo (o cabeçalho é a linha 1). */
  numero: number;
  /** Identidade da linha: data | valor | descrição | conta | ocorrência (ver `chaveDaLinha`). */
  chave: string;
  vencimento: DataISO | null;
  /** Descrição como está no arquivo (só os espaços extras são removidos). */
  descricao: string;
  /** Valor da saída, positivo, em centavos (0 quando inválido). */
  valorCentavos: Centavos;
  contaOrigem: string;
  categoriaOrigem: string;
  categoria: string;
  fornecedor: string;
  codigoBarras: string | null;
  /** A descrição pede para "Atualizar" o valor (valor estimado). */
  valorEstimado: boolean;
  situacao: SituacaoLinha;
  motivo: MotivoExclusao | MotivoConferencia | null;
  /** Explicação curta para a tela (ex.: "Igual à linha 12"). */
  detalhe: string | null;
  /** Para conferência: decisão sugerida (null = o usuário precisa decidir). */
  sugestao: 'importar' | 'nao-importar' | null;
}

export interface OpcoesAnalise {
  /** Primeiro vencimento aceito (antes disso: vencida). */
  de: DataISO;
  /** Último vencimento aceito. */
  ate: DataISO;
  /** Nomes dos cartões cadastrados (ajudam a reconhecer faturas). */
  nomesCartoes?: readonly string[];
}

export class ErroImportacao extends Error {}

export const ROTULOS_MOTIVO: Record<MotivoExclusao | MotivoConferencia, string> = {
  'sem-dados': 'Linha em branco ou de total',
  invalida: 'Dados inválidos',
  paga: 'Já paga',
  entrada: 'Entrada (valor positivo)',
  'valor-zero': 'Valor zero',
  vencida: 'Vencida antes do período',
  'fora-do-periodo': 'Depois do período',
  'ja-importada': 'Já importada antes',
  'duplicada-no-arquivo': 'Repetida no arquivo',
  'provavel-duplicada': 'Provável duplicata no arquivo',
  'possivel-fatura-cartao': 'Possível fatura de cartão',
  'coincide-com-existente': 'Coincide com lançamento do NonatoFin',
};

// ---------------------------------------------------------------- arquivo --

/**
 * Bytes do arquivo -> texto. Reconhece UTF-16 (com ou sem BOM, como o Excel
 * exporta "Unicode"), UTF-8 (com ou sem BOM) e, por último, Windows-1252.
 */
export function decodificarArquivo(bytes: Uint8Array): string {
  const b0 = bytes[0];
  const b1 = bytes[1];
  if (b0 === 0xff && b1 === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  if (b0 === 0xfe && b1 === 0xff) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
  if (b0 === 0xef && b1 === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(bytes.subarray(3));
  // UTF-16 sem BOM: muitos bytes zero nas posições ímpares (texto latino).
  const amostra = bytes.subarray(0, Math.min(bytes.length, 400));
  let zerosImpares = 0;
  for (let i = 1; i < amostra.length; i += 2) if (amostra[i] === 0) zerosImpares++;
  if (amostra.length >= 4 && zerosImpares > amostra.length / 4) return new TextDecoder('utf-16le').decode(bytes);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('windows-1252').decode(bytes);
  }
}

function separadorProvavel(primeiraLinha: string): string {
  const contar = (s: string) => primeiraLinha.split(s).length - 1;
  const candidatos = [';', ',', '\t'].map((s) => ({ s, n: contar(s) }));
  return candidatos.sort((a, b) => b.n - a.n)[0].n > 0 ? candidatos[0].s : ';';
}

/** Texto CSV -> linhas de campos (aspas, aspas duplicadas e quebras dentro de aspas). */
export function lerTabelaCsv(texto: string): string[][] {
  const limpo = texto.replace(/^﻿/, '');
  const fimDoCabecalho = limpo.search(/\r?\n/);
  const separador = separadorProvavel(fimDoCabecalho >= 0 ? limpo.slice(0, fimDoCabecalho) : limpo);
  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let entreAspas = false;
  for (let i = 0; i < limpo.length; i++) {
    const c = limpo[i];
    if (entreAspas) {
      if (c === '"') {
        if (limpo[i + 1] === '"') {
          campo += '"';
          i++;
        } else entreAspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') entreAspas = true;
    else if (c === separador) {
      linha.push(campo);
      campo = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpo[i + 1] === '\n') i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else campo += c;
  }
  if (campo !== '' || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas;
}

type Coluna = 'data' | 'descricao' | 'valor' | 'conta' | 'status' | 'categoria';

const NOMES_COLUNAS: Record<Coluna, readonly string[]> = {
  data: ['date', 'data', 'vencimento', 'data de vencimento'],
  descricao: ['description', 'descricao', 'historico', 'nome'],
  valor: ['value', 'valor', 'amount', 'valor (r$)'],
  conta: ['account', 'conta'],
  status: ['status', 'situacao'],
  categoria: ['category', 'categoria'],
};
const OBRIGATORIAS: readonly Coluna[] = ['data', 'descricao', 'valor', 'status'];

function mapearColunas(cabecalho: readonly string[]): Record<Coluna, number> {
  const nomes = cabecalho.map((c) => normalizarNome(c));
  const mapa = {} as Record<Coluna, number>;
  for (const coluna of Object.keys(NOMES_COLUNAS) as Coluna[]) {
    mapa[coluna] = nomes.findIndex((n) => NOMES_COLUNAS[coluna].includes(n));
  }
  const faltando = OBRIGATORIAS.filter((c) => mapa[c] < 0);
  if (faltando.length > 0) {
    throw new ErroImportacao(
      'O arquivo não tem as colunas esperadas (data, descrição, valor e status). Exporte a planilha novamente como CSV com o cabeçalho.',
    );
  }
  return mapa;
}

// --------------------------------------------------------- valores da linha --

/** "-1049.16", "-1.049,16", "R$ 1.049,16", "1049" -> centavos com sinal (ou null). */
export function valorDoTexto(texto: string): Centavos | null {
  const t = texto.replace(/R\$/i, '').replace(/\s/g, '');
  const m =
    /^([-+]?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(t) ?? // 1.049,16 · 1049,16 · 1049
    /^([-+]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/.exec(t); // 1,049.16 · 1049.16
  if (!m) return null;
  const inteiros = Number(m[2].replace(/[.,]/g, ''));
  const centavos = Number((m[3] ?? '').padEnd(2, '0'));
  const total = inteiros * 100 + centavos;
  if (!Number.isSafeInteger(total)) return null;
  return m[1] === '-' ? -total : total;
}

/** "30/12/2027" ou "2027-12-30" -> "2027-12-30" (ou null). */
export function dataDoTexto(texto: string): DataISO | null {
  const t = texto.trim();
  if (ehDataISOValida(t)) return t;
  return converterDataBR(t);
}

function statusDoTexto(texto: string): 'pendente' | 'pago' | null {
  const t = normalizarNome(texto);
  if (['pending', 'pendente', 'a pagar', 'em aberto', 'aberto'].includes(t)) return 'pendente';
  if (['paid', 'pago', 'paga', 'quitado', 'liquidado'].includes(t)) return 'pago';
  return null;
}

const REGEX_PARCELA_FINAL = /\(\s*\d{1,3}\s*\/\s*\d{1,3}\s*\)\s*$/;
const REGEX_SEQUENCIA_CODIGO = /\d[\d .-]{38,}\d/g;

/** Código de barras / linha digitável escrito na descrição (só dígitos, se válido). */
export function codigoNaDescricao(descricao: string): string | null {
  for (const trecho of descricao.match(REGEX_SEQUENCIA_CODIGO) ?? []) {
    const digitos = trecho.replace(/\D/g, '');
    if (ehCodigoValido(digitos)) return digitos;
  }
  return null;
}

/**
 * Fornecedor a partir da descrição: remove só a parcela no fim ("(3/6)") e um
 * código de barras escrito no texto. "Via da Moda (3/6)" -> "Via da Moda".
 */
export function fornecedorDaDescricao(descricao: string): string {
  const semCodigo = descricao.replace(REGEX_SEQUENCIA_CODIGO, ' ');
  const nome = limparNome(limparNome(semCodigo).replace(REGEX_PARCELA_FINAL, ''))
    .replace(/^[|\-–—\s]+|[|\-–—\s]+$/g, '')
    .trim();
  const final = nome || limparNome(descricao);
  return final.length <= LIMITES_IMPORTACAO.fornecedor ? final : final.slice(0, LIMITES_IMPORTACAO.fornecedor).trim();
}

/** "Energia | Casa | Atualizar" -> valor estimado. */
export function ehValorEstimado(descricao: string): boolean {
  return /\batualizar\b/.test(normalizarNome(descricao));
}

function categoriaDoTexto(texto: string): string {
  const nome = limparNome(texto);
  if (!nome) return CATEGORIA_SEM_NOME;
  return nome.length <= LIMITES_IMPORTACAO.categoria ? nome : nome.slice(0, LIMITES_IMPORTACAO.categoria).trim();
}

/** Lançamento que pode ser a fatura de um cartão (controlada no módulo Cartões). */
export function pareceFaturaDeCartao(descricao: string, categoria: string, nomesCartoes: readonly string[] = []): boolean {
  const d = normalizarNome(descricao);
  const c = normalizarNome(categoria);
  if (/\breajuste de fatura\b|\bfatura (do |de )?cartao\b|\bcartao\b|\bcartoes\b/.test(d)) return true;
  if (/\breajuste de fatura\b|\bcartao\b|\bcartoes\b/.test(c)) return true;
  return nomesCartoes.some((n) => {
    const nome = normalizarNome(n);
    return nome.length >= 4 && d.includes(nome);
  });
}

/** Base da chave: data | valor | descrição | conta (sem maiúsculas, acentos e espaços extras). */
function baseDaChave(vencimento: string, valorCentavos: number, descricao: string, conta: string): string {
  return [vencimento, String(valorCentavos), normalizarNome(descricao), normalizarNome(conta)].join('|');
}

/** Chave da linha: a base + a ocorrência (1ª, 2ª…) dessa mesma base no arquivo. */
export function chaveDaLinha(base: string, ocorrencia: number): string {
  return `${base}|${ocorrencia}`;
}

// ------------------------------------------------- semelhança de fornecedor --

function distancia(a: string, b: string): number {
  const ant = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = ant[0];
    ant[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = ant[j];
      ant[j] = Math.min(ant[j] + 1, ant[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = guardado;
    }
  }
  return ant[b.length];
}

/** Primeira palavra "de verdade" (4+ letras): "Via do Terno" -> "terno". */
function palavraPrincipal(nome: string): string {
  return normalizarNome(nome).split(/[^a-z0-9]+/).find((p) => p.length >= 4 && /[a-z]/.test(p)) ?? '';
}

/**
 * Dois fornecedores parecem o mesmo (erro de digitação): a palavra principal
 * é igual ou difere em até 2 letras. "Brasspress" ≈ "Braspress";
 * "Via do Terno" ≠ "Via da Moda" (terno × moda).
 */
export function fornecedoresParecidos(a: string, b: string): boolean {
  const pa = palavraPrincipal(a);
  const pb = palavraPrincipal(b);
  if (!pa || !pb) return false;
  if (pa === pb) return true;
  return Math.min(pa.length, pb.length) >= 5 && distancia(pa, pb) <= 2;
}

// ---------------------------------------------------------------- análise --

export interface AnaliseImportacao {
  linhas: LinhaImportacao[];
  /** Linhas de dados no arquivo (sem o cabeçalho). */
  totalLinhasArquivo: number;
}

/**
 * Interpreta o arquivo inteiro. Ordem das regras (a primeira que vale decide):
 * sem dados → inválida → paga → entrada → valor zero → vencida → depois do
 * período; das que sobram: repetida no arquivo → provável duplicata → possível
 * fatura de cartão → importar.
 */
export function analisarArquivo(texto: string, opcoes: OpcoesAnalise): AnaliseImportacao {
  const tabela = lerTabelaCsv(texto);
  if (tabela.length < 2) throw new ErroImportacao('O arquivo está vazio ou não tem lançamentos.');
  if (tabela.length - 1 > LIMITES_IMPORTACAO.linhasArquivo) {
    throw new ErroImportacao(`O arquivo tem mais de ${LIMITES_IMPORTACAO.linhasArquivo} linhas. Divida a planilha em partes menores.`);
  }
  const col = mapearColunas(tabela[0]);
  const campo = (valores: string[], c: Coluna) => (col[c] >= 0 ? (valores[col[c]] ?? '') : '');
  const ocorrencias = new Map<string, number>();

  const linhas: LinhaImportacao[] = tabela.slice(1).map((valores, i) => {
    const numero = i + 2;
    const descricao = limparNome(campo(valores, 'descricao'));
    const textoData = campo(valores, 'data').trim();
    const textoValor = campo(valores, 'valor').trim();
    const contaOrigem = limparNome(campo(valores, 'conta')).slice(0, LIMITES_IMPORTACAO.contaOrigem);
    const categoriaOrigem = limparNome(campo(valores, 'categoria'));
    const vencimento = dataDoTexto(textoData);
    const valor = valorDoTexto(textoValor);
    const status = statusDoTexto(campo(valores, 'status'));
    const valorCentavos = valor === null ? 0 : Math.abs(valor);

    const base = baseDaChave(vencimento ?? textoData, valor ?? 0, descricao, contaOrigem);
    const ocorrencia = (ocorrencias.get(base) ?? 0) + 1;
    ocorrencias.set(base, ocorrencia);

    const linha: LinhaImportacao = {
      numero,
      chave: chaveDaLinha(base, ocorrencia),
      vencimento,
      descricao,
      valorCentavos,
      contaOrigem,
      categoriaOrigem,
      categoria: categoriaDoTexto(categoriaOrigem),
      fornecedor: descricao ? fornecedorDaDescricao(descricao) : '',
      codigoBarras: codigoNaDescricao(descricao),
      valorEstimado: ehValorEstimado(descricao),
      situacao: 'importar',
      motivo: null,
      detalhe: null,
      sugestao: null,
    };
    const excluir = (motivo: MotivoExclusao, detalhe: string | null = null) => ({ ...linha, situacao: 'excluida' as const, motivo, detalhe });

    if (!descricao && !textoValor && (!vencimento || !textoData)) return excluir('sem-dados');
    if (!vencimento && /^total\b/i.test(textoData)) return excluir('sem-dados');
    if (!vencimento) return excluir('invalida', 'Data inválida');
    if (valor === null) return excluir('invalida', 'Valor inválido');
    if (!descricao) return excluir('invalida', 'Sem descrição');
    if (descricao.length > LIMITES_IMPORTACAO.descricao) return excluir('invalida', `Descrição com mais de ${LIMITES_IMPORTACAO.descricao} caracteres`);
    if (!status) return excluir('invalida', 'Status desconhecido');
    if (status === 'pago') return excluir('paga');
    if (valor > 0) return excluir('entrada');
    if (valor === 0) return excluir('valor-zero');
    if (vencimento < opcoes.de) return excluir('vencida');
    if (vencimento > opcoes.ate) return excluir('fora-do-periodo');
    return linha;
  });

  marcarDuplicadasNoArquivo(linhas);
  marcarProvaveisDuplicadas(linhas);
  for (const l of linhas) {
    if (l.situacao === 'importar' && pareceFaturaDeCartao(l.descricao, l.categoriaOrigem, opcoes.nomesCartoes)) {
      conferir(l, 'possivel-fatura-cartao', 'Confira no módulo Cartões antes de importar', 'nao-importar');
    }
  }
  return { linhas, totalLinhasArquivo: tabela.length - 1 };
}

function conferir(l: LinhaImportacao, motivo: MotivoConferencia, detalhe: string, sugestao: LinhaImportacao['sugestao']) {
  l.situacao = 'conferir';
  l.motivo = motivo;
  l.detalhe = detalhe;
  l.sugestao = sugestao;
}

/** Linhas idênticas (data, valor, descrição e conta): a 1ª entra; as demais vão para conferência. */
function marcarDuplicadasNoArquivo(linhas: LinhaImportacao[]) {
  const primeira = new Map<string, LinhaImportacao>();
  for (const l of linhas) {
    if (l.situacao !== 'importar' || !l.vencimento) continue;
    const base = baseDaChave(l.vencimento, l.valorCentavos, l.descricao, l.contaOrigem);
    const anterior = primeira.get(base);
    if (anterior) conferir(l, 'duplicada-no-arquivo', `Igual à linha ${anterior.numero}`, 'nao-importar');
    else primeira.set(base, l);
  }
}

/**
 * Mesma data, valor e conta, descrições diferentes e fornecedor parecido
 * (ex.: "Brasspress | Código na Descrição" × "Braspress 2379…"): fica a linha
 * com código de barras (ou a primeira); as outras vão para conferência.
 */
function marcarProvaveisDuplicadas(linhas: LinhaImportacao[]) {
  const grupos = new Map<string, LinhaImportacao[]>();
  for (const l of linhas) {
    if (l.situacao !== 'importar' || !l.vencimento) continue;
    const k = [l.vencimento, l.valorCentavos, normalizarNome(l.contaOrigem)].join('|');
    grupos.set(k, [...(grupos.get(k) ?? []), l]);
  }
  for (const grupo of grupos.values()) {
    if (grupo.length < 2) continue;
    const marcadas = new Set<LinhaImportacao>();
    for (const a of grupo) {
      if (marcadas.has(a)) continue;
      const parecidas = grupo.filter((b) => b !== a && !marcadas.has(b) && fornecedoresParecidos(a.fornecedor, b.fornecedor));
      if (parecidas.length === 0) continue;
      const conjunto = [a, ...parecidas];
      const fica = conjunto.find((x) => x.codigoBarras) ?? conjunto[0];
      for (const x of conjunto) {
        if (x === fica) continue;
        conferir(x, 'provavel-duplicada', `Parece a mesma cobrança da linha ${fica.numero} (${fica.descricao})`, 'nao-importar');
        marcadas.add(x);
      }
      marcadas.add(fica);
    }
  }
}

// ---------------------------------------------------- dados do NonatoFin --

/** Lançamento já existente no NonatoFin (para achar coincidências). */
export interface LancamentoExistente {
  id: string;
  vencimento: DataISO;
  valorCentavos: Centavos;
  descricao: string;
  fornecedor: string;
  status: 'pendente' | 'pago';
}

/**
 * Junta o que só o banco sabe: linhas já importadas antes (pela chave) saem;
 * linhas que coincidem (mesmo vencimento e valor) com um lançamento existente
 * vão para conferência SEM sugestão — o usuário decide uma a uma.
 */
export function aplicarDadosDoBanco(
  analise: AnaliseImportacao,
  dados: { chavesImportadas: ReadonlySet<string>; existentes: readonly LancamentoExistente[] },
): AnaliseImportacao {
  const porDataValor = new Map<string, LancamentoExistente[]>();
  for (const e of dados.existentes) {
    const k = `${e.vencimento}|${e.valorCentavos}`;
    porDataValor.set(k, [...(porDataValor.get(k) ?? []), e]);
  }
  const linhas = analise.linhas.map((original) => {
    const l = { ...original };
    if (l.situacao === 'excluida') return l;
    if (dados.chavesImportadas.has(l.chave)) {
      return { ...l, situacao: 'excluida' as const, motivo: 'ja-importada' as const, detalhe: null, sugestao: null };
    }
    const iguais = porDataValor.get(`${l.vencimento}|${l.valorCentavos}`) ?? [];
    if (iguais.length > 0) {
      const e = iguais[0];
      const outros = iguais.length > 1 ? ` (e mais ${iguais.length - 1})` : '';
      const texto = `Já existe: ${e.fornecedor} · ${e.descricao} · ${e.status === 'pago' ? 'pago' : 'pendente'}${outros}`;
      if (l.situacao === 'importar') conferir(l, 'coincide-com-existente', texto, null);
      else l.detalhe = `${l.detalhe} · ${texto}`;
    }
    return l;
  });
  return { ...analise, linhas };
}

// --------------------------------------------------------------- decisões --

export interface DecisoesImportacao {
  /** Chaves de linhas em conferência que devem entrar. */
  incluir: readonly string[];
  /** Chaves que NÃO devem entrar (linhas "importar" desmarcadas ou conferências recusadas). */
  excluir: readonly string[];
}

/** A decisão final de uma linha (null = em conferência sem decisão). */
export function decisaoDaLinha(l: LinhaImportacao, d: { incluir: ReadonlySet<string>; excluir: ReadonlySet<string> }): boolean | null {
  if (l.situacao === 'excluida') return false;
  if (d.excluir.has(l.chave)) return false;
  if (d.incluir.has(l.chave)) return true;
  if (l.situacao === 'importar') return true;
  return l.sugestao === null ? null : l.sugestao === 'importar';
}

export interface SelecaoFinal {
  importar: LinhaImportacao[];
  /** Linhas em conferência que ainda precisam de decisão. */
  semDecisao: LinhaImportacao[];
}

export function selecionarLinhas(linhas: readonly LinhaImportacao[], decisoes: DecisoesImportacao): SelecaoFinal {
  const d = { incluir: new Set(decisoes.incluir), excluir: new Set(decisoes.excluir) };
  const importar: LinhaImportacao[] = [];
  const semDecisao: LinhaImportacao[] = [];
  for (const l of linhas) {
    const decisao = decisaoDaLinha(l, d);
    if (decisao === true) importar.push(l);
    else if (decisao === null) semDecisao.push(l);
  }
  return { importar, semDecisao };
}

// ----------------------------------------------------------------- resumo --

export interface GrupoResumo {
  rotulo: string;
  quantidade: number;
  totalCentavos: Centavos;
}

export interface ResumoImportacao {
  totalLinhasArquivo: number;
  importar: GrupoResumo;
  conferir: GrupoResumo;
  /** Por motivo (excluídas e em conferência). */
  porMotivo: (GrupoResumo & { motivo: MotivoExclusao | MotivoConferencia; situacao: SituacaoLinha })[];
  valoresEstimados: number;
  comCodigoDeBarras: number;
  fornecedores: number;
  categorias: string[];
  porConta: GrupoResumo[];
  porMes: (GrupoResumo & { mes: string })[];
}

const grupo = (rotulo: string, linhas: readonly LinhaImportacao[]): GrupoResumo => ({
  rotulo,
  quantidade: linhas.length,
  totalCentavos: somarCentavos(linhas.map((l) => l.valorCentavos)),
});

function agrupar<T extends string>(linhas: readonly LinhaImportacao[], chave: (l: LinhaImportacao) => T): Map<T, LinhaImportacao[]> {
  const mapa = new Map<T, LinhaImportacao[]>();
  for (const l of linhas) mapa.set(chave(l), [...(mapa.get(chave(l)) ?? []), l]);
  return mapa;
}

/** Resumo do que será importado (`importar` = linhas que entrarão com as decisões dadas). */
export function resumirImportacao(analise: AnaliseImportacao, importar: readonly LinhaImportacao[]): ResumoImportacao {
  const porMotivo = [...agrupar(analise.linhas.filter((l) => l.motivo), (l) => l.motivo!)].map(([motivo, ls]) => ({
    ...grupo(ROTULOS_MOTIVO[motivo], ls),
    motivo,
    situacao: ls[0].situacao,
  }));
  const ordemMotivos = Object.keys(ROTULOS_MOTIVO);
  porMotivo.sort((a, b) => ordemMotivos.indexOf(a.motivo) - ordemMotivos.indexOf(b.motivo));
  return {
    totalLinhasArquivo: analise.totalLinhasArquivo,
    importar: grupo('Importar', importar),
    conferir: grupo('Conferir', analise.linhas.filter((l) => l.situacao === 'conferir')),
    porMotivo,
    valoresEstimados: importar.filter((l) => l.valorEstimado).length,
    comCodigoDeBarras: importar.filter((l) => l.codigoBarras).length,
    fornecedores: new Set(importar.map((l) => normalizarNome(l.fornecedor))).size,
    categorias: [...agrupar(importar, (l) => normalizarNome(l.categoria)).values()].map((ls) => ls[0].categoria).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    porConta: [...agrupar(importar, (l) => l.contaOrigem || '(sem conta)')]
      .map(([conta, ls]) => grupo(conta, ls))
      .sort((a, b) => b.totalCentavos - a.totalCentavos),
    porMes: [...agrupar(importar, (l) => (l.vencimento ?? '').slice(0, 7))]
      .map(([mes, ls]) => ({ ...grupo(mes, ls), mes }))
      .sort((a, b) => a.mes.localeCompare(b.mes)),
  };
}

// -------------------------------------------------------- gravação no banco --

/** Observação gravada no lançamento: origem, conta original e aviso de valor estimado. */
export function observacaoDaLinha(l: LinhaImportacao, arquivoNome: string, hoje: DataISO): string {
  const partes = [`Importado de "${arquivoNome}" em ${formatarData(hoje)} (linha ${l.numero}).`];
  partes.push(`Conta original: ${l.contaOrigem || 'não informada'}.`);
  if (l.valorEstimado) partes.push('Valor estimado: revisar antes de pagar.');
  return partes.join(' ').slice(0, 1000);
}
