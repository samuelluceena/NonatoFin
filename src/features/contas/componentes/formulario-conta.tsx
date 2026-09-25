'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Info } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { BarraAcoesFormulario } from '@/components/ui/barra-acoes-formulario';
import { Campo, Entrada, Seletor, ariaCampo } from '@/components/ui/campo';
import { CampoSaldo } from '@/components/ui/campo-saldo';
import { Aviso, CampoMarcacao } from '@/components/ui/formulario';
import { LIMITES } from '@/lib/config';
import type { Empresa } from '@/lib/domain/tipos';
import { atualizarConta, criarConta } from '../acoes';
import { esquemaNovaConta, type ValoresNovaConta } from '../esquemas';

interface Props {
  empresas: Pick<Empresa, 'id' | 'apelido'>[];
  /** Empresas que já têm conta: a 1ª conta de uma empresa nasce como padrão. */
  empresasComConta?: string[];
  /** Presente = edição (sem o campo de saldo: o saldo muda por movimentos). */
  edicaoId?: string;
  valoresIniciais: ValoresNovaConta;
}

export function FormularioConta({ empresas, empresasComConta = [], edicaoId, valoresIniciais }: Props) {
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
  } = useForm<ValoresNovaConta>({
    // Mesmo esquema nos dois modos; na edição o saldo fica oculto e o servidor o ignora.
    resolver: zodResolver(esquemaNovaConta),
    defaultValues: valoresIniciais,
    mode: 'onTouched',
  });

  async function aoValidar(valores: ValoresNovaConta) {
    if (enviando.current) return;
    enviando.current = true;
    setSalvando(true);
    try {
      const r = edicaoId ? await atualizarConta(edicaoId, valores) : await criarConta(valores);
      if (!r.ok) {
        toast.error(r.erro);
        for (const [campo, msg] of Object.entries(r.campos ?? {})) setError(campo as keyof ValoresNovaConta, { message: msg });
        return;
      }
      toast.success(r.mensagem ?? 'Alterações salvas.');
      const id = edicaoId ?? (r.dados as { id: string } | undefined)?.id;
      router.push(id ? `/contas/${id}` : '/contas');
    } catch {
      toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      enviando.current = false;
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(aoValidar)(e)} noValidate className="flex flex-col gap-10">
      <Secao titulo="Identificação">
        <Campo id="empresaId" rotulo="Empresa" erro={errors.empresaId?.message}>
          <Seletor
            {...ariaCampo('empresaId', errors.empresaId?.message)}
            {...register('empresaId', {
              onChange: (e) => {
                if (!edicaoId) setValue('padrao', !empresasComConta.includes(e.target.value));
              },
            })}
          >
            <option value="">Selecione a empresa</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.apelido}
              </option>
            ))}
          </Seletor>
        </Campo>

        <Campo id="apelido" rotulo="Apelido da conta" erro={errors.apelido?.message} dica="Como aparece nas telas. Ex.: Itaú PJ, Nubank Loja.">
          <Entrada {...ariaCampo('apelido', errors.apelido?.message, true)} {...register('apelido')} autoComplete="off" maxLength={LIMITES.apelidoContaMax} />
        </Campo>

        {/* Banco e final identificam a mesma conta: lado a lado (o final é curto). */}
        <div className="grid grid-cols-[minmax(0,1fr)_8rem] gap-4">
          <Campo id="banco" rotulo="Banco" erro={errors.banco?.message}>
            <Entrada {...ariaCampo('banco', errors.banco?.message)} {...register('banco')} autoComplete="off" maxLength={LIMITES.bancoContaMax} placeholder="Itaú, Bradesco, Nubank..." />
          </Campo>
          <Campo id="final" rotulo="Final" opcional erro={errors.final?.message}>
            <Entrada {...ariaCampo('final', errors.final?.message)} {...register('final')} inputMode="numeric" maxLength={4} placeholder="1234" className="font-mono" autoComplete="off" />
          </Campo>
        </div>
      </Secao>

      {edicaoId ? (
        <p className="-mt-4 flex items-start gap-2 text-meta text-fg-3">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            O saldo muda pelos pagamentos, entradas e conferências. Para corrigir o saldo, use{' '}
            <Link href={`/contas/${edicaoId}`} className="font-medium text-primary-text hover:underline">
              Conferir no detalhe da conta
            </Link>
            .
          </span>
        </p>
      ) : (
        <Secao titulo="Saldo inicial">
          <Campo
            id="saldoInicialCentavos"
            rotulo="Saldo de hoje"
            erro={errors.saldoInicialCentavos?.message}
            dica="O saldo que o app do banco mostra agora. Depois ele é atualizado pelos pagamentos, entradas e conferências."
            className="sm:max-w-xs"
          >
            <Controller
              control={control}
              name="saldoInicialCentavos"
              render={({ field }) => (
                <CampoSaldo
                  id="saldoInicialCentavos"
                  aria-describedby="saldoInicialCentavos-dica"
                  valor={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </Campo>
        </Secao>
      )}

      <Secao titulo="Uso">
        <CampoMarcacao {...register('padrao')} rotulo="Conta padrão da empresa" descricao="Vem marcada nos novos lançamentos e cartões desta empresa." />

        {edicaoId && (
          <CampoMarcacao {...register('ativa')} rotulo="Conta ativa" descricao="Contas inativas saem das listas e do total (o histórico fica guardado)." />
        )}
      </Secao>

      <Aviso>Por segurança, o sistema guarda só o apelido, o banco e os 4 últimos dígitos. Nunca informe senha, agência ou número completo.</Aviso>

      {/* No celular a barra fica presa acima da navegação (`contents` mantém o sticky); a partir de sm, à direita. */}
      <div className="contents sm:flex sm:justify-end sm:border-t sm:border-border sm:pt-6">
        <BarraAcoesFormulario rotuloSalvar={edicaoId ? 'Salvar alterações' : 'Salvar conta'} salvando={salvando} />
      </div>
    </form>
  );
}

/** Seção do formulário: título discreto e campos, sem caixa em volta. */
function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <h2 className="text-body font-semibold text-fg">{titulo}</h2>
      {children}
    </section>
  );
}
