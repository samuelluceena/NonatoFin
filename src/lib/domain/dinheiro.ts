/**
 * Dinheiro em CENTAVOS inteiros (number seguro até 2^53).
 * R$ 2.995,00 === 299500. Nunca some valores em reais com ponto flutuante.
 */
import { APP, LIMITES } from '@/lib/config';

export type Centavos = number;

const formatadorMoeda = new Intl.NumberFormat(APP.locale, {
  style: 'currency',
  currency: APP.moeda,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatadorNumero = new Intl.NumberFormat(APP.locale, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function ehCentavosValido(valor: unknown): valor is Centavos {
  return typeof valor === 'number' && Number.isSafeInteger(valor);
}

function garantirCentavos(valor: number): void {
  if (!Number.isSafeInteger(valor)) throw new Error(`Valor em centavos inválido: ${valor}`);
}

/** 123456 -> "R$ 1.234,56" (com espaço inquebrável após R$) */
export function formatarMoeda(centavos: Centavos): string {
  garantirCentavos(centavos);
  // Divisão por 100 de inteiro seguro é exata o suficiente para exibir 2 casas.
  return formatadorMoeda.format(centavos / 100);
}

/**
 * Valor com sinal explícito, para movimentos e ajustes:
 * 1000 -> "+ R$ 10,00", -1000 -> "− R$ 10,00" (sinal de menos tipográfico), 0 -> "R$ 0,00".
 */
export function formatarMoedaComSinal(centavos: Centavos): string {
  if (centavos > 0) return `+ ${formatarMoeda(centavos)}`;
  if (centavos < 0) return `− ${formatarMoeda(-centavos)}`;
  return formatarMoeda(0);
}

/** Negativos com o sinal de menos tipográfico ("− R$ 10,00"); positivos sem sinal. */
export function formatarMoedaSaldo(centavos: Centavos): string {
  return centavos < 0 ? `− ${formatarMoeda(-centavos)}` : formatarMoeda(centavos);
}

/** 123456 -> "1.234,56" */
export function formatarNumeroMoeda(centavos: Centavos): string {
  garantirCentavos(centavos);
  return formatadorNumero.format(centavos / 100);
}

/**
 * Converte texto digitado em centavos. Aceita formatos brasileiros:
 * "2.995,00", "2995,5", "2995", "R$ 1.234,56", "100.50" (ponto decimal com 1–2 casas).
 * Retorna null se o texto não for um valor válido.
 */
export function converterTextoParaCentavos(texto: string): Centavos | null {
  let limpo = texto.replace(/R\$/gi, '').replace(/[\s ]/g, '');
  if (limpo === '' || limpo.startsWith('-')) return null;

  let inteiro: string;
  let fracao = '';

  if (limpo.includes(',')) {
    // Vírgula é o separador decimal; pontos são milhares.
    if ((limpo.match(/,/g) ?? []).length > 1) return null;
    [inteiro, fracao] = limpo.split(',');
    if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(inteiro)) return null;
    inteiro = inteiro.replace(/\./g, '');
  } else {
    const partes = limpo.split('.');
    if (partes.length === 2 && partes[1].length > 0 && partes[1].length <= 2) {
      [inteiro, fracao] = partes; // "100.50"
    } else {
      if (!/^\d{1,3}(\.\d{3})*$|^\d+$/.test(limpo)) return null;
      limpo = limpo.replace(/\./g, '');
      inteiro = limpo;
    }
  }

  if (!/^\d+$/.test(inteiro) || !/^\d{0,2}$/.test(fracao)) return null;
  const centavos = Number(inteiro) * 100 + Number(fracao.padEnd(2, '0'));
  return Number.isSafeInteger(centavos) ? centavos : null;
}

/**
 * Máscara de digitação estilo app de banco: os dígitos preenchem da direita.
 * "2" -> 2 (R$ 0,02) | "299500" -> 299500 (R$ 2.995,00)
 */
export function centavosDosDigitos(texto: string): Centavos {
  const digitos = texto.replace(/\D/g, '').replace(/^0+/, '');
  if (digitos === '') return 0;
  // Limita para não passar do máximo permitido (evita números gigantes).
  // 11 dígitos = até R$ 999.999.999,99 (sempre abaixo do máximo permitido).
  const maxDigitos = String(LIMITES.valorMaxCentavos).length - 1;
  return Number(digitos.slice(0, maxDigitos));
}

export function somarCentavos(valores: readonly Centavos[]): Centavos {
  let total = 0;
  for (const v of valores) {
    garantirCentavos(v);
    total += v;
  }
  garantirCentavos(total);
  return total;
}

export function multiplicarCentavos(valor: Centavos, quantidade: number): Centavos {
  garantirCentavos(valor);
  if (!Number.isInteger(quantidade)) throw new Error('Quantidade deve ser inteira.');
  const total = valor * quantidade;
  garantirCentavos(total);
  return total;
}
