'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { BarraAcoesFormulario } from '@/components/ui/barra-acoes-formulario';
import { Campo, Entrada, Seletor, ariaCampo } from '@/components/ui/campo';
import { CampoSaldo } from '@/components/ui/campo-saldo';
import { Aviso, CampoMarcacao, PainelFormulario, SecaoFormulario } from '@/components/ui/formulario';
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
    <form onSubmit={(e) => void handleSubmit(aoValidar)(e)} noValidate className="flex flex-col gap-5">
      <PainelFormulario>
        <SecaoFormulario titulo="Identificação">
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

          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Campo id="apelido" rotulo="Apelido da conta" erro={errors.apelido?.message} dica="Como aparece nas telas. Ex.: Itaú PJ, Nubank Loja.">
              <Entrada {...ariaCampo('apelido', errors.apelido?.message, true)} {...register('apelido')} autoComplete="off" maxLength={LIMITES.apelidoContaMax} />
            </Campo>
            <Campo id="final" rotulo="Final" opcional erro={errors.final?.message}>
              <Entrada {...ariaCampo('final', errors.final?.message)} {...register('final')} inputMode="numeric" maxLength={4} placeholder="1234" className="font-mono" autoComplete="off" />
            </Campo>
          </div>

          <Campo id="banco" rotulo="Banco" erro={errors.banco?.message}>
            <Entrada {...ariaCampo('banco', errors.banco?.message)} {...register('banco')} autoComplete="off" maxLength={LIMITES.bancoContaMax} placeholder="Itaú, Bradesco, Nubank..." />
          </Campo>

        </SecaoFormulario>

          {!edicaoId && (
          <SecaoFormulario titulo="Saldo">
            <Campo
              id="saldoInicialCentavos"
              rotulo="Saldo de hoje"
              erro={errors.saldoInicialCentavos?.message}
              dica="O saldo que o app do banco mostra agora. Depois ele é atualizado pelos pagamentos, entradas e conferências."
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
          </SecaoFormulario>
          )}

        <SecaoFormulario titulo="Uso">
          <CampoMarcacao {...register('padrao')} rotulo="Conta padrão da empresa" descricao="Vem marcada nos novos lançamentos e cartões desta empresa." />

          {edicaoId && (
            <CampoMarcacao {...register('ativa')} rotulo="Conta ativa" descricao="Contas inativas saem das listas e do total (o histórico fica guardado)." />
          )}

          <Aviso>Por segurança, o sistema guarda só o apelido, o banco e os 4 últimos dígitos. Nunca informe senha, agência ou número completo.</Aviso>
        </SecaoFormulario>
      </PainelFormulario>

      <BarraAcoesFormulario rotuloSalvar={edicaoId ? 'Salvar alterações' : 'Salvar conta'} salvando={salvando} />
    </form>
  );
}
