'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Info } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { BarraAcoesFormulario } from '@/components/ui/barra-acoes-formulario';
import { Campo, Entrada, Seletor, ariaCampo } from '@/components/ui/campo';
import { LIMITES } from '@/lib/config';
import { fechamentoDaFatura, vencimentoDaFatura } from '@/lib/domain/cartoes';
import { adicionarMesesNaChave, chaveDoMes, formatarData, formatarMes } from '@/lib/domain/datas';
import { contaPadraoDaEmpresa } from '@/lib/domain/saldos';
import type { Categoria, ContaBancaria, Empresa, Fornecedor } from '@/lib/domain/tipos';
import { CampoConta } from '@/features/contas/componentes/campo-conta';
import { atualizarCartao, criarCartao } from '../acoes';
import { esquemaCartao, type ValoresCartao } from '../esquemas';

interface Props {
  empresas: Pick<Empresa, 'id' | 'apelido'>[];
  categorias: Pick<Categoria, 'id' | 'nome'>[];
  fornecedores: Fornecedor[];
  contas: ContaBancaria[];
  hoje: string;
  edicaoId?: string;
  valoresIniciais: ValoresCartao;
}

function CampoDia({
  id,
  rotulo,
  erro,
  valor,
  onChange,
  onBlur,
}: {
  id: string;
  rotulo: string;
  erro?: string;
  valor: number;
  onChange: (v: number) => void;
  onBlur: () => void;
}) {
  return (
    <Campo id={id} rotulo={rotulo} erro={erro}>
      <Entrada
        {...ariaCampo(id, erro)}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="1 a 31"
        value={valor > 0 ? String(valor) : ''}
        onBlur={onBlur}
        onChange={(e) => {
          const d = e.target.value.replace(/\D/g, '').slice(0, 2);
          onChange(d === '' ? 0 : Number(d));
        }}
      />
    </Campo>
  );
}

export function FormularioCartao({ empresas, categorias, fornecedores, contas, hoje, edicaoId, valoresIniciais }: Props) {
  const router = useRouter();
  const enviando = useRef(false);
  const [salvando, setSalvando] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors },
  } = useForm<ValoresCartao>({
    resolver: zodResolver(esquemaCartao),
    defaultValues: valoresIniciais,
    mode: 'onTouched',
  });

  const [diaFechamento, diaVencimento, empresaId] = useWatch({ control, name: ['diaFechamento', 'diaVencimento', 'empresaId'] });
  const diasOk =
    diaFechamento >= 1 && diaFechamento <= 31 && diaVencimento >= 1 && diaVencimento <= 31 && diaFechamento !== diaVencimento;
  const exemploMes = adicionarMesesNaChave(chaveDoMes(hoje), 1);

  async function aoValidar(valores: ValoresCartao) {
    if (enviando.current) return;
    enviando.current = true;
    setSalvando(true);
    try {
      const r = edicaoId ? await atualizarCartao(edicaoId, valores) : await criarCartao(valores);
      if (!r.ok) {
        toast.error(r.erro);
        for (const [campo, msg] of Object.entries(r.campos ?? {})) setError(campo as keyof ValoresCartao, { message: msg });
        return;
      }
      toast.success(r.mensagem ?? 'Salvo!');
      const id = edicaoId ?? (r.dados as { id: string } | undefined)?.id;
      router.push(id ? `/cartoes/${id}` : '/cartoes');
    } catch {
      toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      enviando.current = false;
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(aoValidar)(e)} noValidate className="flex flex-col gap-5">
      <Campo id="empresaId" rotulo="Empresa" erro={errors.empresaId?.message}>
        <Seletor
          {...ariaCampo('empresaId', errors.empresaId?.message)}
          {...register('empresaId', { onChange: (e) => setValue('contaId', contaPadraoDaEmpresa(contas, e.target.value)) })}
        >
          <option value="">Selecione a empresa</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.apelido}
            </option>
          ))}
        </Seletor>
      </Campo>

      <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
        <Campo id="nome" rotulo="Nome do cartão" erro={errors.nome?.message} dica="Ex.: Nubank PJ, Itaú Visa Loja.">
          <Entrada {...ariaCampo('nome', errors.nome?.message, true)} {...register('nome')} autoComplete="off" maxLength={LIMITES.nomeCartaoMax} />
        </Campo>
        <Campo id="final" rotulo="Final" opcional erro={errors.final?.message}>
          <Entrada
            {...ariaCampo('final', errors.final?.message)}
            {...register('final')}
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="1234"
            className="font-mono"
          />
        </Campo>
      </div>

      <Campo id="emissorNome" rotulo="Banco / emissor" erro={errors.emissorNome?.message} dica="Quem recebe o pagamento da fatura.">
        <Entrada
          {...ariaCampo('emissorNome', errors.emissorNome?.message, true)}
          {...register('emissorNome')}
          list="lista-emissores"
          autoComplete="off"
          autoCapitalize="words"
          maxLength={LIMITES.fornecedorNomeMax}
        />
        <datalist id="lista-emissores">
          {fornecedores.map((f) => (
            <option key={f.id} value={f.nome} />
          ))}
        </datalist>
      </Campo>

      <div className="grid grid-cols-2 gap-4">
        <Controller
          control={control}
          name="diaFechamento"
          render={({ field }) => (
            <CampoDia id="diaFechamento" rotulo="Dia do fechamento" erro={errors.diaFechamento?.message} valor={field.value} onChange={field.onChange} onBlur={field.onBlur} />
          )}
        />
        <Controller
          control={control}
          name="diaVencimento"
          render={({ field }) => (
            <CampoDia id="diaVencimento" rotulo="Dia do vencimento" erro={errors.diaVencimento?.message} valor={field.value} onChange={field.onChange} onBlur={field.onBlur} />
          )}
        />
      </div>

      {diasOk && (
        <p className="flex gap-2 rounded-md border border-primary/30 bg-primary-soft p-3 text-[13px] text-primary-soft-fg" data-testid="exemplo-fatura">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Exemplo: a fatura de {formatarMes(exemploMes)} fecha em{' '}
            <strong className="numeros">{formatarData(fechamentoDaFatura(exemploMes, { diaFechamento, diaVencimento }))}</strong> e vence em{' '}
            <strong className="numeros">{formatarData(vencimentoDaFatura(exemploMes, diaVencimento))}</strong>. Compras a partir do dia do fechamento vão
            para a fatura seguinte.
          </span>
        </p>
      )}

      <Campo
        id="categoriaFaturaId"
        rotulo="Categoria das faturas"
        erro={errors.categoriaFaturaId?.message}
        dica="Usada no lançamento a pagar de cada fatura. Cada compra tem a sua própria categoria."
      >
        <Seletor {...ariaCampo('categoriaFaturaId', errors.categoriaFaturaId?.message, true)} {...register('categoriaFaturaId')}>
          <option value="">Selecione a categoria</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Seletor>
      </Campo>

      <Controller
        control={control}
        name="contaId"
        render={({ field }) => (
          <CampoConta
            rotulo="Fatura debitada da conta"
            contas={contas}
            empresaId={empresaId}
            contaAtualId={valoresIniciais.contaId}
            erro={errors.contaId?.message}
            dica="As faturas deste cartão saem desta conta."
            {...field}
          />
        )}
      />

      <label className="flex min-h-11 cursor-pointer items-start gap-3 text-[15px]">
        <input type="checkbox" {...register('ativo')} className="mt-0.5 size-5 accent-[var(--primary)]" />
        <span>
          Cartão ativo
          <span className="block text-[13px] text-fg-3">Cartões inativos não aparecem ao lançar novas compras.</span>
        </span>
      </label>

      <BarraAcoesFormulario rotuloSalvar={edicaoId ? 'Salvar alterações' : 'Salvar cartão'} salvando={salvando} />
    </form>
  );
}
