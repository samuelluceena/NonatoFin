'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { BarraAcoesFormulario } from '@/components/ui/barra-acoes-formulario';
import { Botao } from '@/components/ui/botao';
import { AreaTexto, Campo, Entrada, Seletor, ariaCampo } from '@/components/ui/campo';
import { CampoMoeda } from '@/components/ui/campo-moeda';
import { Dialogo } from '@/components/ui/dialogo';
import { Aviso, CampoMarcacao, PainelFormulario, SecaoFormulario } from '@/components/ui/formulario';
import { Segmentado } from '@/components/ui/segmentado';
import { LIMITES } from '@/lib/config';
import { mesmoFornecedor } from '@/lib/domain/fornecedores';
import { contaPadraoDaEmpresa } from '@/lib/domain/saldos';
import type { Categoria, ContaBancaria, Empresa, EscopoSerie, Fornecedor } from '@/lib/domain/tipos';
import { CampoConta } from '@/features/contas/componentes/campo-conta';
import { atualizarLancamento, criarLancamento } from '../acoes';
import { esquemaFormularioLancamento, type ValoresFormularioLancamento } from '../esquemas';
import { OpcoesEscopo, type InfoSerie } from './opcoes-escopo';
import { PreviaSerie } from './previa-serie';

interface PropsFormulario {
  fornecedores: Fornecedor[];
  empresas: Pick<Empresa, 'id' | 'apelido'>[];
  categorias: Pick<Categoria, 'id' | 'nome'>[];
  /** Contas bancárias (o campo mostra as da empresa escolhida). */
  contas: ContaBancaria[];
  /** Presente = modo edição. */
  edicao?: { id: string; serie: InfoSerie | null };
  valoresIniciais?: Partial<ValoresFormularioLancamento>;
}

const PADRAO: ValoresFormularioLancamento = {
  empresaId: '',
  categoriaId: '',
  contaId: '',
  fornecedorNome: '',
  descricao: '',
  vencimento: '',
  valorCentavos: 0,
  codigoBarras: '',
  observacao: '',
  tipo: 'unico',
  quantidade: 2,
  frequencia: 'mensal',
  mesmoCodigoEmTodos: false,
  status: 'pendente',
};

export function FormularioLancamento({ fornecedores, empresas, categorias, contas, edicao, valoresIniciais }: PropsFormulario) {
  const router = useRouter();
  const enviando = useRef(false);
  const [salvando, setSalvando] = useState(false);
  const [dialogoEscopo, setDialogoEscopo] = useState(false);
  const [escopo, setEscopo] = useState<EscopoSerie>('este');
  const [valoresPendentes, setValoresPendentes] = useState<ValoresFormularioLancamento | null>(null);
  const modoEdicao = Boolean(edicao);

  const {
    register,
    handleSubmit,
    control,
    setError,
    setValue,
    formState: { errors },
  } = useForm<ValoresFormularioLancamento>({
    resolver: zodResolver(esquemaFormularioLancamento),
    defaultValues: { ...PADRAO, ...valoresIniciais },
    mode: 'onTouched',
  });

  const [tipo, vencimento, quantidade, valorCentavos, fornecedorNome, empresaId] = useWatch({
    control,
    name: ['tipo', 'vencimento', 'quantidade', 'valorCentavos', 'fornecedorNome', 'empresaId'],
  });

  const fornecedorExistente = useMemo(
    () => (fornecedorNome?.trim() ? fornecedores.find((f) => mesmoFornecedor(f.nome, fornecedorNome)) : undefined),
    [fornecedores, fornecedorNome],
  );

  async function enviar(valores: ValoresFormularioLancamento, escopoEscolhido: EscopoSerie) {
    if (enviando.current) return; // evita duplo toque
    enviando.current = true;
    setSalvando(true);
    try {
      const resultado = edicao
        ? await atualizarLancamento(edicao.id, { ...valores, escopo: escopoEscolhido })
        : await criarLancamento(valores);

      if (!resultado.ok) {
        toast.error(resultado.erro);
        for (const [campo, mensagem] of Object.entries(resultado.campos ?? {})) {
          setError(campo as keyof ValoresFormularioLancamento, { message: mensagem });
        }
        return;
      }
      toast.success(resultado.mensagem ?? 'Alterações salvas.');
      const destino = edicao ? edicao.id : 'primeiroId' in resultado.dados ? resultado.dados.primeiroId : '';
      router.push(destino ? `/boletos/${destino}` : '/boletos');
    } catch {
      toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      enviando.current = false;
      setSalvando(false);
    }
  }

  function aoValidar(valores: ValoresFormularioLancamento) {
    if (edicao?.serie) {
      setValoresPendentes(valores);
      setEscopo('este');
      setDialogoEscopo(true);
      return;
    }
    void enviar(valores, 'este');
  }

  return (
    <>
      <form onSubmit={(e) => void handleSubmit(aoValidar)(e)} noValidate className="flex flex-col gap-5">
        <PainelFormulario>
          <SecaoFormulario titulo="Empresa e conta">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo id="empresaId" rotulo="Empresa" erro={errors.empresaId?.message}>
                <Seletor
                  {...ariaCampo('empresaId', errors.empresaId?.message)}
                  {...register('empresaId', {
                    // Trocou a empresa: a conta passa a ser a padrão da nova empresa.
                    onChange: (e) => setValue('contaId', contaPadraoDaEmpresa(contas, e.target.value)),
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
              <Campo id="categoriaId" rotulo="Categoria" erro={errors.categoriaId?.message}>
                <Seletor {...ariaCampo('categoriaId', errors.categoriaId?.message)} {...register('categoriaId')}>
                  <option value="">Selecione a categoria</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                </Seletor>
              </Campo>
            </div>

            {/* Controlado: as opções mudam com a empresa, e o valor precisa acompanhar. */}
            <Controller
              control={control}
              name="contaId"
              render={({ field }) => (
                <CampoConta contas={contas} empresaId={empresaId} contaAtualId={valoresIniciais?.contaId} erro={errors.contaId?.message} {...field} />
              )}
            />

          </SecaoFormulario>

          <SecaoFormulario titulo="Quem recebe">
            <Campo
              id="fornecedorNome"
              rotulo="Fornecedor / credor"
              erro={errors.fornecedorNome?.message}
              dica={
                fornecedorNome?.trim()
                  ? fornecedorExistente
                    ? `Fornecedor existente: ${fornecedorExistente.nome}`
                    : 'Novo fornecedor será cadastrado.'
                  : 'Quem recebe o pagamento. Ex.: Via da Moda, Bradesco, Enel.'
              }
            >
              <Entrada
                {...ariaCampo('fornecedorNome', errors.fornecedorNome?.message, true)}
                {...register('fornecedorNome')}
                list="lista-fornecedores"
                autoComplete="off"
                autoCapitalize="words"
                maxLength={LIMITES.fornecedorNomeMax}
              />
              <datalist id="lista-fornecedores">
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.nome} />
                ))}
              </datalist>
            </Campo>

            <Campo id="descricao" rotulo="Nome / descrição" erro={errors.descricao?.message} dica="Ex.: Compra coleção outubro, Energia Loja Iguatu.">
              <Entrada
                {...ariaCampo('descricao', errors.descricao?.message, true)}
                {...register('descricao')}
                autoComplete="off"
                maxLength={LIMITES.descricaoMax}
              />
            </Campo>

          </SecaoFormulario>

          <SecaoFormulario titulo="Vencimento e valor" descricao={modoEdicao ? undefined : 'Único ou vários meses (mesmo valor em cada mês, dia preservado).'}>
            {!modoEdicao && (
              <Controller
                control={control}
                name="tipo"
                render={({ field }) => (
                  <Segmentado
                    nome="tipo"
                    rotulo="Tipo"
                    valor={field.value}
                    onChange={field.onChange}
                    opcoes={[
                      { valor: 'unico', rotulo: 'Único' },
                      { valor: 'serie', rotulo: 'Vários meses' },
                    ]}
                  />
                )}
              />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                id="vencimento"
                rotulo={tipo === 'serie' && !modoEdicao ? 'Primeiro vencimento' : 'Data de vencimento'}
                erro={errors.vencimento?.message}
              >
                <Entrada {...ariaCampo('vencimento', errors.vencimento?.message)} {...register('vencimento')} type="date" min="2000-01-01" max="2100-12-31" />
              </Campo>

              <Campo
                id="valorCentavos"
                rotulo={tipo === 'serie' && !modoEdicao ? 'Valor de cada lançamento' : 'Valor'}
                erro={errors.valorCentavos?.message}
              >
                <Controller
                  control={control}
                  name="valorCentavos"
                  render={({ field }) => (
                    <CampoMoeda
                      {...ariaCampo('valorCentavos', errors.valorCentavos?.message)}
                      name={field.name}
                      valor={field.value}
                      onValorChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  )}
                />
              </Campo>
            </div>

            {tipo === 'serie' && !modoEdicao && (
              <div className="flex flex-col gap-4 rounded-md border border-border-subtle bg-bg-subtle p-4">
                <div className="grid grid-cols-2 gap-4">
                  <Campo id="quantidade" rotulo="Quantidade de lançamentos" erro={errors.quantidade?.message}>
                    <Controller
                      control={control}
                      name="quantidade"
                      render={({ field }) => (
                        <Entrada
                          {...ariaCampo('quantidade', errors.quantidade?.message)}
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          name={field.name}
                          ref={field.ref}
                          onBlur={field.onBlur}
                          value={Number.isFinite(field.value) && field.value > 0 ? String(field.value) : ''}
                          onChange={(e) => {
                            const digitos = e.target.value.replace(/\D/g, '').slice(0, 3);
                            field.onChange(digitos === '' ? 0 : Number(digitos));
                          }}
                        />
                      )}
                    />
                  </Campo>
                  <Campo id="frequencia" rotulo="Frequência">
                    <Seletor id="frequencia" {...register('frequencia')}>
                      <option value="mensal">Mensal</option>
                    </Seletor>
                  </Campo>
                </div>
                <PreviaSerie vencimento={vencimento} quantidade={quantidade} valorCentavos={valorCentavos} />
              </div>
            )}

          </SecaoFormulario>

          <SecaoFormulario titulo="Pagamento">
            <Campo
              id="codigoBarras"
              rotulo="Código de barras / linha digitável"
              opcional
              erro={errors.codigoBarras?.message}
              dica={
                tipo === 'serie' && !modoEdicao
                  ? 'Por padrão, apenas o 1º lançamento recebe este código.'
                  : '44, 47 ou 48 dígitos. Pontos e espaços são ignorados.'
              }
            >
              <Entrada
                {...ariaCampo('codigoBarras', errors.codigoBarras?.message, true)}
                {...register('codigoBarras')}
                inputMode="numeric"
                autoComplete="off"
                className="font-mono"
                placeholder="00190.00009 01234.567890 ..."
              />
            </Campo>

            {tipo === 'serie' && !modoEdicao && (
              <CampoMarcacao {...register('mesmoCodigoEmTodos')} rotulo="Usar o mesmo código em todos os lançamentos" descricao="Deixe desmarcado se o código muda a cada mês." />
            )}

            {modoEdicao && (
              <Campo id="status" rotulo="Status" dica="Atrasado é calculado automaticamente para pendentes vencidos.">
                <Seletor {...ariaCampo('status', undefined, true)} {...register('status')}>
                  <option value="pendente">Pendente</option>
                  <option value="pago">Pago</option>
                </Seletor>
              </Campo>
            )}

          </SecaoFormulario>

          <SecaoFormulario titulo="Detalhes">
            <Campo id="observacao" rotulo="Observação" opcional erro={errors.observacao?.message}>
              <AreaTexto
                {...ariaCampo('observacao', errors.observacao?.message)}
                {...register('observacao')}
                rows={3}
                maxLength={LIMITES.observacaoMax}
              />
            </Campo>

            {edicao?.serie && (
              <Aviso>
                Este boleto faz parte de uma série ({edicao.serie.parcela}/{edicao.serie.totalParcelas}). Ao salvar, você escolhe se aplica a alteração somente
                nele, nele e nos próximos, ou em todos. Código e status são sempre alterados só neste boleto.
              </Aviso>
            )}
          </SecaoFormulario>
        </PainelFormulario>

        <BarraAcoesFormulario rotuloSalvar={modoEdicao ? 'Salvar alterações' : tipo === 'serie' ? 'Criar lançamentos' : 'Salvar boleto'} salvando={salvando} />
      </form>

      {edicao?.serie && (
        <Dialogo
          aberto={dialogoEscopo}
          onFechar={() => setDialogoEscopo(false)}
          titulo="Alterar boleto da série"
          descricao="Empresa, categoria, conta, fornecedor, descrição, valor, vencimento e observação serão aplicados conforme a opção escolhida."
          rodape={
            <>
              <Botao variante="secundario" onClick={() => setDialogoEscopo(false)} disabled={salvando}>
                Cancelar
              </Botao>
              <Botao
                carregando={salvando}
                textoCarregando="Salvando..."
                onClick={async () => {
                  if (!valoresPendentes) return;
                  await enviar(valoresPendentes, escopo);
                  setDialogoEscopo(false);
                }}
              >
                Salvar
              </Botao>
            </>
          }
        >
          <OpcoesEscopo nome="escopo-edicao" info={edicao.serie} verbo="Alterar" valor={escopo} onChange={setEscopo} />
        </Dialogo>
      )}
    </>
  );
}
