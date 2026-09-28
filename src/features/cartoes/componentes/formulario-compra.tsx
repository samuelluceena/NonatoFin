'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { BarraAcoesFormulario } from '@/components/ui/barra-acoes-formulario';
import { AreaTexto, Campo, Entrada, Seletor, ariaCampo } from '@/components/ui/campo';
import { CampoMoeda } from '@/components/ui/campo-moeda';
import { Aviso } from '@/components/ui/formulario';
import { LIMITES } from '@/lib/config';
import { faturaDaCompra, planejarParcelas, proximasCompetencias, resumoParcelas, vencimentoDaFatura } from '@/lib/domain/cartoes';
import { adicionarMesesNaChave, ehChaveMesValida, ehDataISOValida, formatarData, formatarMes } from '@/lib/domain/datas';
import { formatarMoeda } from '@/lib/domain/dinheiro';
import type { Cartao, Categoria } from '@/lib/domain/tipos';
import { atualizarCompra, registrarCompra } from '../acoes';
import { esquemaCompra, type ValoresCompra } from '../esquemas';

interface Props {
  cartoes: Cartao[];
  categorias: Pick<Categoria, 'id' | 'nome'>[];
  edicaoId?: string;
  valoresIniciais: ValoresCompra;
  /** Para onde voltar depois de salvar. */
  destino?: string;
}

export function rotuloCartao(c: Pick<Cartao, 'nome' | 'final' | 'empresa'>): string {
  return `${c.nome}${c.final ? ` •••• ${c.final}` : ''} — ${c.empresa.apelido}`;
}

function Previa({ cartao, total, parcelas, primeira }: { cartao: Cartao; total: number; parcelas: number; primeira: string }) {
  const valido =
    total > 0 && Number.isInteger(parcelas) && parcelas >= 1 && parcelas <= LIMITES.parcelasCartaoMax && total >= parcelas && ehChaveMesValida(primeira);
  if (!valido) return null;
  const plano = planejarParcelas(total, parcelas, primeira);
  const visiveis = plano.length <= 6 ? plano : [...plano.slice(0, 4), ...plano.slice(-1)];
  return (
    <div className="rounded-md border border-border-subtle bg-bg-subtle px-4 py-3.5" data-testid="previa-parcelas">
      <p className="numeros text-sm font-medium text-fg" role="status">
        {resumoParcelas(total, parcelas)}
      </p>
      <ol className="numeros mt-3 flex flex-col divide-y divide-border-subtle border-t border-border-subtle text-meta">
        {visiveis.map((p, i) => (
          <li key={p.numero} className="flex items-baseline justify-between gap-3 py-2 last:pb-0">
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
              {i === 4 && plano.length > 6 && <span className="text-fg-3">…</span>}
              <span className="font-medium text-fg">
                {p.numero}/{p.total}
              </span>
              <span className="text-fg-2">{formatarMes(p.faturaMes)}</span>
              <span className="text-fg-3">vence {formatarData(vencimentoDaFatura(p.faturaMes, cartao.diaVencimento))}</span>
            </span>
            <span className="shrink-0 font-medium text-fg">{formatarMoeda(p.valorCentavos)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function FormularioCompra({ cartoes, categorias, edicaoId, valoresIniciais, destino }: Props) {
  const router = useRouter();
  const enviando = useRef(false);
  const [salvando, setSalvando] = useState(false);
  // Em edição a fatura gravada é mantida até o usuário pedir o cálculo automático.
  const [faturaManual, setFaturaManual] = useState(Boolean(edicaoId));

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors },
  } = useForm<ValoresCompra>({
    resolver: zodResolver(esquemaCompra),
    defaultValues: valoresIniciais,
    mode: 'onTouched',
  });

  const [cartaoId, dataCompra, total, parcelas, primeira] = useWatch({
    control,
    name: ['cartaoId', 'dataCompra', 'valorTotalCentavos', 'parcelas', 'primeiraFaturaMes'],
  });
  const cartao = cartoes.find((c) => c.id === cartaoId);
  const automatica = useMemo(
    () => (cartao && ehDataISOValida(dataCompra) ? faturaDaCompra(dataCompra, cartao) : null),
    [cartao, dataCompra],
  );

  // Mantém a 1ª fatura calculada enquanto o usuário não escolher outra.
  useEffect(() => {
    if (!faturaManual && automatica && automatica !== primeira) {
      setValue('primeiraFaturaMes', automatica, { shouldValidate: true });
    }
  }, [automatica, faturaManual, primeira, setValue]);

  const opcoesFatura = useMemo(() => {
    const base = automatica ?? primeira;
    if (!ehChaveMesValida(base)) return [];
    const lista = proximasCompetencias(adicionarMesesNaChave(base, -2), 8);
    if (ehChaveMesValida(primeira) && !lista.includes(primeira)) lista.push(primeira);
    return lista.sort();
  }, [automatica, primeira]);

  async function aoValidar(valores: ValoresCompra) {
    if (enviando.current) return;
    enviando.current = true;
    setSalvando(true);
    try {
      const r = edicaoId ? await atualizarCompra(edicaoId, valores) : await registrarCompra(valores);
      if (!r.ok) {
        toast.error(r.erro);
        for (const [campo, msg] of Object.entries(r.campos ?? {})) setError(campo as keyof ValoresCompra, { message: msg });
        return;
      }
      toast.success(r.mensagem ?? 'Alterações salvas.');
      router.push(destino ?? `/cartoes/${valores.cartaoId}`);
    } catch {
      toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      enviando.current = false;
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(aoValidar)(e)} noValidate className="flex flex-col gap-10">
      {/* 1. O valor é o que se confere primeiro: em destaque, com as parcelas ao lado e a divisão logo abaixo. */}
      <Secao titulo="Valor e parcelas" descricao="O total é dividido em centavos; a sobra vai para a 1ª parcela.">
        <div className="grid items-end gap-4 sm:grid-cols-3">
          <Campo id="valorTotalCentavos" rotulo="Valor total" erro={errors.valorTotalCentavos?.message} className="sm:col-span-2">
            <Controller
              control={control}
              name="valorTotalCentavos"
              render={({ field }) => (
                <CampoMoeda
                  {...ariaCampo('valorTotalCentavos', errors.valorTotalCentavos?.message)}
                  tamanho="destaque"
                  name={field.name}
                  valor={field.value}
                  onValorChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                />
              )}
            />
          </Campo>
          <Campo id="parcelas" rotulo="Parcelas" erro={errors.parcelas?.message}>
            <Controller
              control={control}
              name="parcelas"
              render={({ field }) => (
                <Seletor
                  {...ariaCampo('parcelas', errors.parcelas?.message)}
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  value={String(field.value)}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                  opcoes={Array.from({ length: LIMITES.parcelasCartaoMax }, (_, i) => i + 1).map((n) => ({
                    valor: String(n),
                    rotulo: n === 1 ? 'À vista' : `${n}x`,
                  }))}
                />
              )}
            />
          </Campo>
        </div>

        {cartao && <Previa cartao={cartao} total={total} parcelas={parcelas} primeira={primeira} />}
      </Secao>

      {/* 2. Cartão e data definem a fatura: vêm antes dela. */}
      <Secao titulo="Cartão e fatura">
        <Campo
          id="cartaoId"
          rotulo="Cartão"
          erro={errors.cartaoId?.message}
          dica={cartao ? `Fecha dia ${cartao.diaFechamento} · vence dia ${cartao.diaVencimento}` : undefined}
        >
          <Seletor
            {...ariaCampo('cartaoId', errors.cartaoId?.message, Boolean(cartao))}
            {...register('cartaoId')}
            placeholder="Selecione o cartão"
            opcoes={cartoes.map((c) => ({ valor: c.id, rotulo: rotuloCartao(c) }))}
          />
        </Campo>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <Campo id="dataCompra" rotulo="Data da compra" erro={errors.dataCompra?.message}>
            <Entrada {...ariaCampo('dataCompra', errors.dataCompra?.message)} {...register('dataCompra')} type="date" min="2000-01-01" max="2100-12-31" />
          </Campo>

          <div className="flex min-w-0 flex-col gap-2">
            <Campo
              id="primeiraFaturaMes"
              rotulo={parcelas > 1 ? 'Fatura da 1ª parcela' : 'Fatura'}
              erro={errors.primeiraFaturaMes?.message}
              dica={
                automatica && primeira === automatica
                  ? 'Calculada pela data da compra e pelo fechamento do cartão.'
                  : automatica
                    ? `Pela data da compra seria ${formatarMes(automatica)}.`
                    : 'Escolha o cartão e a data para calcular.'
              }
            >
              <Seletor
                {...ariaCampo('primeiraFaturaMes', errors.primeiraFaturaMes?.message, true)}
                {...register('primeiraFaturaMes', { onChange: () => setFaturaManual(true) })}
                disabled={opcoesFatura.length === 0}
                placeholder={opcoesFatura.length === 0 ? '—' : undefined}
                opcoes={opcoesFatura.map((m) => ({
                  valor: m,
                  rotulo:
                    formatarMes(m) +
                    (cartao ? ` — vence ${formatarData(vencimentoDaFatura(m, cartao.diaVencimento))}` : '') +
                    (m === automatica ? ' (automática)' : ''),
                }))}
              />
            </Campo>
            {faturaManual && automatica && primeira !== automatica && (
              <button
                type="button"
                className="self-start text-sm font-medium text-primary-text hover:underline"
                onClick={() => {
                  setFaturaManual(false);
                  setValue('primeiraFaturaMes', automatica, { shouldValidate: true });
                }}
              >
                Usar a fatura automática
              </button>
            )}
          </div>
        </div>
      </Secao>

      {/* 3. O que foi comprado */}
      <Secao titulo="Compra">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo id="descricao" rotulo="O que foi comprado" erro={errors.descricao?.message} dica="Ex.: Tecidos Loja Centro, Passagem SP.">
            <Entrada {...ariaCampo('descricao', errors.descricao?.message, true)} {...register('descricao')} autoComplete="off" maxLength={LIMITES.descricaoMax} />
          </Campo>
          <Campo id="categoriaId" rotulo="Categoria" erro={errors.categoriaId?.message}>
            <Seletor
              {...ariaCampo('categoriaId', errors.categoriaId?.message)}
              {...register('categoriaId')}
              placeholder="Selecione a categoria"
              opcoes={categorias.map((c) => ({ valor: c.id, rotulo: c.nome }))}
            />
          </Campo>
        </div>
      </Secao>

      {/* 4. Complementos: visualmente secundários (na edição, com o aviso de recálculo). */}
      <Secao titulo="Mais detalhes" opcional={!edicaoId} secundaria>
        <Campo id="observacao" rotulo="Observação" opcional erro={errors.observacao?.message}>
          <AreaTexto {...ariaCampo('observacao', errors.observacao?.message)} {...register('observacao')} rows={2} maxLength={LIMITES.observacaoMax} />
        </Campo>

        {edicaoId && (
          <Aviso>
            Ao salvar, as parcelas são recalculadas. Não é possível alterar uma compra que tenha parcela em fatura já paga — desfaça o pagamento da fatura
            antes.
          </Aviso>
        )}
      </Secao>

      {/* No celular a barra fica presa acima da navegação (`contents` mantém o sticky); a partir de sm, à direita. */}
      <div className="contents sm:flex sm:justify-end sm:border-t sm:border-border sm:pt-6">
        <BarraAcoesFormulario rotuloSalvar={edicaoId ? 'Salvar alterações' : 'Lançar compra'} salvando={salvando} />
      </div>
    </form>
  );
}

/** Seção do formulário: título e campos, sem caixa. `secundaria` = complementos (menos peso). */
function Secao({ titulo, descricao, opcional, secundaria, children }: { titulo: string; descricao?: string; opcional?: boolean; secundaria?: boolean; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <header>
        <h2 className={secundaria ? 'text-sm font-medium text-fg-2' : 'text-body font-semibold text-fg'}>
          {titulo}
          {opcional && <span className="font-normal text-fg-3"> (opcional)</span>}
        </h2>
        {descricao && <p className="mt-0.5 text-meta text-fg-3">{descricao}</p>}
      </header>
      {children}
    </section>
  );
}
