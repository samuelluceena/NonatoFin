'use client';

import { Archive, ShieldCheck, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Botao } from '@/components/ui/botao';
import { Campo, Entrada, ariaCampo } from '@/components/ui/campo';
import { Dialogo } from '@/components/ui/dialogo';
import type { ResultadoAcao } from '@/lib/acoes/resultado';
import type { ResultadoOperacao } from '../acoes';
import { BotaoBaixarBackup } from './botao-baixar-backup';

export interface ItemConfirmacao {
  rotulo: string;
  detalhe?: string;
  quantidade?: number;
}

interface Props {
  aberto: boolean;
  onFechar: () => void;
  titulo: string;
  descricao: ReactNode;
  tituloApagado: string;
  apagado: ItemConfirmacao[];
  tituloMantido: string;
  mantido: ItemConfirmacao[];
  /** Texto sobre o backup automático (o botão de download vem junto). */
  aviso: ReactNode;
  frase: string;
  rotuloConfirmar: string;
  textoProcessando: string;
  executar: (dados: { senha: string; frase: string }) => Promise<ResultadoAcao<ResultadoOperacao>>;
  testId: string;
}

const numero = new Intl.NumberFormat('pt-BR');

function Lista({ titulo, itens, tom }: { titulo: string; itens: ItemConfirmacao[]; tom: 'perigo' | 'neutro' }) {
  return (
    <div>
      <h3 className={tom === 'perigo' ? 'mb-2 flex items-center gap-1.5 text-sm font-medium text-danger' : 'mb-2 flex items-center gap-1.5 text-sm font-medium text-fg-2'}>
        {tom === 'perigo' ? <Trash2 className="size-4" aria-hidden="true" /> : <ShieldCheck className="size-4" aria-hidden="true" />}
        {titulo}
      </h3>
      <ul className="flex flex-col gap-1.5 text-sm">
        {/* Tabelas sem registros não aparecem (itens sem quantidade, como "Login e senha", sempre aparecem). */}
        {itens.filter((item) => item.quantidade !== 0).map((item) => (
          <li key={item.rotulo} className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 text-fg">
              {item.rotulo}
              {item.detalhe && <span className="block text-meta text-fg-3">{item.detalhe}</span>}
            </span>
            {item.quantidade !== undefined && <span className="shrink-0 text-fg-2 tabular-nums">{numero.format(item.quantidade)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Confirmação de operação irreversível: mostra o que será apagado e mantido,
 * oferece o backup, exige a senha e uma frase digitada exatamente.
 */
export function DialogoConfirmacaoForte({
  aberto,
  onFechar,
  titulo,
  descricao,
  tituloApagado,
  apagado,
  tituloMantido,
  mantido,
  aviso,
  frase,
  rotuloConfirmar,
  textoProcessando,
  executar,
  testId,
}: Props) {
  const router = useRouter();
  const id = useId();
  const [senha, setSenha] = useState('');
  const [fraseDigitada, setFraseDigitada] = useState('');
  const [erroSenha, setErroSenha] = useState<string>();
  const [erroGeral, setErroGeral] = useState<string>();
  const [executando, setExecutando] = useState(false);
  const emAndamento = useRef(false);

  const pronto = fraseDigitada === frase && senha.length > 0;

  function fechar() {
    if (emAndamento.current) return;
    setSenha('');
    setFraseDigitada('');
    setErroSenha(undefined);
    setErroGeral(undefined);
    onFechar();
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (!pronto || emAndamento.current) return;
    emAndamento.current = true;
    setExecutando(true);
    setErroSenha(undefined);
    setErroGeral(undefined);
    try {
      const r = await executar({ senha, frase: fraseDigitada });
      if (!r.ok) {
        if (r.campos?.senha) setErroSenha(r.campos.senha);
        else setErroGeral(r.erro);
        toast.error(r.erro);
        return;
      }
      toast.success(r.mensagem ?? 'Concluído.');
      emAndamento.current = false;
      setExecutando(false);
      fechar();
      router.replace(r.dados.destino);
      router.refresh();
    } catch {
      setErroGeral('Não foi possível confirmar o resultado (erro de conexão). Recarregue a página para ver o estado atual antes de tentar de novo.');
      toast.error('Erro de conexão.');
    } finally {
      emAndamento.current = false;
      setExecutando(false);
    }
  }

  const idSenha = `${id}-senha`;
  const idFrase = `${id}-frase`;

  return (
    <Dialogo
      aberto={aberto}
      onFechar={fechar}
      titulo={titulo}
      descricao={descricao}
      alerta="perigo"
      tamanho="lg"
      bloqueado={executando}
      rodape={
        <>
          <Botao variante="secundario" onClick={fechar} disabled={executando}>
            Cancelar
          </Botao>
          <Botao
            type="submit"
            form={`${id}-form`}
            variante="perigo"
            disabled={!pronto}
            carregando={executando}
            textoCarregando={textoProcessando}
            data-testid={`${testId}-confirmar`}
          >
            {rotuloConfirmar}
          </Botao>
        </>
      }
    >
      <form id={`${id}-form`} onSubmit={confirmar} className="flex flex-col gap-5" data-testid={testId}>
        <div className="grid gap-5 sm:grid-cols-2">
          <Lista titulo={tituloApagado} itens={apagado} tom="perigo" />
          <Lista titulo={tituloMantido} itens={mantido} tom="neutro" />
        </div>

        <div className="flex gap-3 rounded-md border border-border bg-surface-2 p-3">
          <Archive className="mt-0.5 size-4.5 shrink-0 text-fg-2" aria-hidden="true" />
          <div className="min-w-0 text-sm text-fg-2">
            <p>{aviso}</p>
            <BotaoBaixarBackup tamanho="sm" variante="fantasma" className="mt-1.5 -ml-2" rotulo="Baixar backup completo agora (.json)" />
          </div>
        </div>

        <fieldset disabled={executando} className="flex flex-col gap-4">
          <Campo id={idSenha} rotulo="Sua senha" erro={erroSenha} dica="Confirme que é você.">
            <Entrada
              {...ariaCampo(idSenha, erroSenha, true)}
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              data-testid={`${testId}-senha`}
            />
          </Campo>
          <Campo id={idFrase} rotulo="Frase de confirmação" dica={<>Digite <span className="font-mono font-semibold text-fg select-all">{frase}</span> exatamente como está.</>}>
            <Entrada
              {...ariaCampo(idFrase, undefined, true)}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              value={fraseDigitada}
              onChange={(e) => setFraseDigitada(e.target.value)}
              className="font-mono"
              data-testid={`${testId}-frase`}
            />
          </Campo>
        </fieldset>

        {erroGeral && (
          <p role="alert" className="rounded-md border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger">
            {erroGeral}
          </p>
        )}
        {executando && (
          <p role="status" className="text-sm text-fg-2">
            {textoProcessando} Não feche esta janela.
          </p>
        )}
      </form>
    </Dialogo>
  );
}
