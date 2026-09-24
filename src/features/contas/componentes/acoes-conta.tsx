'use client';

/**
 * Botões + diálogos dos movimentos de conta: Entrada, Transferir e Conferir
 * com o extrato. Cada um valida no servidor (Server Action) e mostra os erros
 * no próprio campo.
 */
import { ArrowDownToLine, ArrowLeftRight, ScanSearch } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Botao, type VarianteBotao } from '@/components/ui/botao';
import { Campo, Entrada, Seletor, ariaCampo } from '@/components/ui/campo';
import { CampoMoeda } from '@/components/ui/campo-moeda';
import { CampoSaldo } from '@/components/ui/campo-saldo';
import { Dialogo } from '@/components/ui/dialogo';
import type { ResultadoAcao } from '@/lib/acoes/resultado';
import { formatarData, type DataISO } from '@/lib/domain/datas';
import { formatarMoeda, type Centavos } from '@/lib/domain/dinheiro';
import { ajusteDaConferencia, entradaNasceConfirmada, rotuloConta } from '@/lib/domain/saldos';
import type { ContaBancaria } from '@/lib/domain/tipos';
import { conferirSaldo, registrarEntrada, transferir } from '../acoes';

/** Estado comum: aberto, salvando, erros por campo e envio. */
function useDialogoAcao() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});

  async function enviar<T>(acao: () => Promise<ResultadoAcao<T>>): Promise<boolean> {
    setSalvando(true);
    try {
      const r = await acao();
      if (!r.ok) {
        setErros(r.campos ?? {});
        toast.error(r.erro);
        return false;
      }
      toast.success(r.mensagem ?? 'Salvo!');
      setAberto(false);
      router.refresh();
      return true;
    } catch {
      toast.error('Erro de conexão. Tente novamente.');
      return false;
    } finally {
      setSalvando(false);
    }
  }

  function abrir() {
    setErros({});
    setAberto(true);
  }

  return { aberto, abrir, fechar: () => setAberto(false), salvando, erros, enviar };
}

function Rodape({ onCancelar, salvando, rotulo, testId }: { onCancelar: () => void; salvando: boolean; rotulo: string; testId: string }) {
  return (
    <>
      <Botao variante="secundario" onClick={onCancelar} disabled={salvando}>
        Cancelar
      </Botao>
      <Botao type="submit" form={`form-${testId}`} carregando={salvando} textoCarregando="Salvando..." data-testid={testId}>
        {rotulo}
      </Botao>
    </>
  );
}

interface PropsBotao {
  variante?: VarianteBotao;
  className?: string;
  children?: ReactNode;
}

// ------------------------------------------------------------------ entrada --

export function BotaoEntrada({ contaId, hoje, variante = 'secundario', className }: PropsBotao & { contaId: string; hoje: DataISO }) {
  const d = useDialogoAcao();
  const [data, setData] = useState(hoje);
  const [valor, setValor] = useState(0);
  const [descricao, setDescricao] = useState('');
  const prevista = data !== '' && !entradaNasceConfirmada(data, hoje);

  return (
    <>
      <Botao
        variante={variante}
        className={className}
        onClick={() => {
          setData(hoje);
          setValor(0);
          setDescricao('');
          d.abrir();
        }}
        icone={<ArrowDownToLine className="size-4.5" aria-hidden="true" />}
        data-testid="nova-entrada"
      >
        Entrada
      </Botao>
      <Dialogo
        aberto={d.aberto}
        onFechar={d.fechar}
        titulo="Registrar entrada"
        descricao="Dinheiro que entrou (ou vai entrar) nesta conta: vendas, depósito, PIX recebido."
        rodape={<Rodape onCancelar={d.fechar} salvando={d.salvando} rotulo="Salvar entrada" testId="salvar-entrada" />}
      >
        <form
          id="form-salvar-entrada"
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void d.enviar(() => registrarEntrada({ contaId, data, valorCentavos: valor, descricao }));
          }}
        >
          <Campo id="entrada-descricao" rotulo="Descrição" erro={d.erros.descricao}>
            <Entrada
              {...ariaCampo('entrada-descricao', d.erros.descricao)}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Vendas do dia"
              autoComplete="off"
            />
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo id="entrada-valor" rotulo="Valor" erro={d.erros.valorCentavos}>
              <CampoMoeda {...ariaCampo('entrada-valor', d.erros.valorCentavos)} valor={valor} onValorChange={setValor} />
            </Campo>
            <Campo
              id="entrada-data"
              rotulo="Data"
              erro={d.erros.data}
              dica={prevista ? 'Data futura: fica como prevista.' : undefined}
            >
              <Entrada {...ariaCampo('entrada-data', d.erros.data, prevista)} type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </Campo>
          </div>
        </form>
      </Dialogo>
    </>
  );
}

// ------------------------------------------------------------- transferência --

export function BotaoTransferir({
  contas,
  origemId = '',
  hoje,
  variante = 'secundario',
  className,
}: PropsBotao & { contas: ContaBancaria[]; origemId?: string; hoje: DataISO }) {
  const d = useDialogoAcao();
  const [origem, setOrigem] = useState(origemId);
  const [destino, setDestino] = useState('');
  const [data, setData] = useState(hoje);
  const [valor, setValor] = useState(0);
  const [descricao, setDescricao] = useState('');
  const ativas = contas.filter((c) => c.ativa);
  const rotulo = (c: ContaBancaria) => `${rotuloConta(c)} — ${c.empresa.apelido}`;

  return (
    <>
      <Botao
        variante={variante}
        className={className}
        disabled={ativas.length < 2}
        onClick={() => {
          setOrigem(origemId);
          setDestino('');
          setData(hoje);
          setValor(0);
          setDescricao('');
          d.abrir();
        }}
        icone={<ArrowLeftRight className="size-4.5" aria-hidden="true" />}
        data-testid="nova-transferencia"
      >
        Transferir
      </Botao>
      <Dialogo
        aberto={d.aberto}
        onFechar={d.fechar}
        titulo="Transferir entre contas"
        descricao="Tira o valor de uma conta e coloca na outra (o total não muda)."
        rodape={<Rodape onCancelar={d.fechar} salvando={d.salvando} rotulo="Transferir" testId="salvar-transferencia" />}
      >
        <form
          id="form-salvar-transferencia"
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void d.enviar(() => transferir({ origemId: origem, destinoId: destino, data, valorCentavos: valor, descricao }));
          }}
        >
          <Campo id="transf-origem" rotulo="De" erro={d.erros.origemId}>
            <Seletor {...ariaCampo('transf-origem', d.erros.origemId)} value={origem} onChange={(e) => setOrigem(e.target.value)}>
              <option value="">Selecione a conta</option>
              {ativas.map((c) => (
                <option key={c.id} value={c.id}>
                  {rotulo(c)}
                </option>
              ))}
            </Seletor>
          </Campo>
          <Campo id="transf-destino" rotulo="Para" erro={d.erros.destinoId}>
            <Seletor {...ariaCampo('transf-destino', d.erros.destinoId)} value={destino} onChange={(e) => setDestino(e.target.value)}>
              <option value="">Selecione a conta</option>
              {ativas
                .filter((c) => c.id !== origem)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {rotulo(c)}
                  </option>
                ))}
            </Seletor>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo id="transf-valor" rotulo="Valor" erro={d.erros.valorCentavos}>
              <CampoMoeda {...ariaCampo('transf-valor', d.erros.valorCentavos)} valor={valor} onValorChange={setValor} />
            </Campo>
            <Campo id="transf-data" rotulo="Data" erro={d.erros.data}>
              <Entrada {...ariaCampo('transf-data', d.erros.data)} type="date" max={hoje} value={data} onChange={(e) => setData(e.target.value)} />
            </Campo>
          </div>
          <Campo id="transf-descricao" rotulo="Descrição" opcional erro={d.erros.descricao}>
            <Entrada {...ariaCampo('transf-descricao', d.erros.descricao)} value={descricao} onChange={(e) => setDescricao(e.target.value)} autoComplete="off" />
          </Campo>
        </form>
      </Dialogo>
    </>
  );
}

// -------------------------------------------------------------- conferência --

export function BotaoConferir({
  conta,
  saldoCentavos,
  hoje,
  variante = 'secundario',
  className,
}: PropsBotao & { conta: ContaBancaria; saldoCentavos: Centavos; hoje: DataISO }) {
  const d = useDialogoAcao();
  const [informado, setInformado] = useState(saldoCentavos);
  const ajuste = ajusteDaConferencia(saldoCentavos, informado);

  return (
    <>
      <Botao
        variante={variante}
        className={className}
        onClick={() => {
          setInformado(saldoCentavos);
          d.abrir();
        }}
        icone={<ScanSearch className="size-4.5" aria-hidden="true" />}
        data-testid="conferir-saldo"
      >
        Conferir com extrato
      </Botao>
      <Dialogo
        aberto={d.aberto}
        onFechar={d.fechar}
        titulo={`Conferir ${conta.apelido}`}
        descricao={`Digite o saldo que o app do banco mostra agora (${formatarData(hoje)}).`}
        rodape={<Rodape onCancelar={d.fechar} salvando={d.salvando} rotulo="Confirmar saldo" testId="salvar-conferencia" />}
      >
        <form
          id="form-salvar-conferencia"
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void d.enviar(() => conferirSaldo({ contaId: conta.id, saldoCentavos: informado }));
          }}
        >
          <Campo id="conferencia-saldo" rotulo="Saldo no banco" erro={d.erros.saldoCentavos}>
            <CampoSaldo id="conferencia-saldo" valor={informado} onChange={setInformado} />
          </Campo>
          <dl className="numeros grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-md bg-surface-2 p-3 text-sm" data-testid="resumo-conferencia">
            <dt className="text-fg-2">Saldo no sistema</dt>
            <dd className="text-right">{formatarMoeda(saldoCentavos)}</dd>
            <dt className="font-medium text-fg">Ajuste</dt>
            <dd className={ajuste === 0 ? 'text-right font-semibold text-success' : 'text-right font-semibold'}>
              {ajuste === 0 ? 'Nenhum — está certo' : ajuste > 0 ? `+ ${formatarMoeda(ajuste)}` : `− ${formatarMoeda(-ajuste)}`}
            </dd>
          </dl>
        </form>
      </Dialogo>
    </>
  );
}
