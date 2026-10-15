'use client';

import { Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useId, useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Botao } from '@/components/ui/botao';
import { Campo, Entrada, ariaCampo } from '@/components/ui/campo';
import { Dialogo } from '@/components/ui/dialogo';
import { BotaoBaixarBackup } from '@/features/dados/componentes/botao-baixar-backup';
import { desfazerImportacao } from '../acoes';
import { FRASE_DESFAZER } from '../esquemas';

interface Props {
  importacaoId: string;
  pendentes: number;
  pagos: number;
}

/**
 * Desfaz um lote: remove os lançamentos dele que ainda estão pendentes (os já
 * pagos ficam). Pede a senha e a frase; as linhas removidas podem ser
 * importadas de novo depois.
 */
export function BotaoDesfazerImportacao({ importacaoId, pendentes, pagos }: Props) {
  const router = useRouter();
  const id = useId();
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState('');
  const [frase, setFrase] = useState('');
  const [erroSenha, setErroSenha] = useState<string>();
  const [executando, setExecutando] = useState(false);
  const emAndamento = useRef(false);
  const pronto = senha.length > 0 && frase === FRASE_DESFAZER;

  function fechar() {
    if (emAndamento.current) return;
    setAberto(false);
    setSenha('');
    setFrase('');
    setErroSenha(undefined);
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault();
    if (!pronto || emAndamento.current) return;
    emAndamento.current = true;
    setExecutando(true);
    setErroSenha(undefined);
    try {
      const r = await desfazerImportacao({ importacaoId, senha, frase });
      if (!r.ok) {
        if (r.campos?.senha) setErroSenha(r.campos.senha);
        toast.error(r.erro);
        return;
      }
      toast.success(r.mensagem ?? 'Importação desfeita.');
      emAndamento.current = false;
      fechar();
      router.refresh();
    } catch {
      toast.error('Erro de conexão. Recarregue a página para ver o estado atual.');
    } finally {
      emAndamento.current = false;
      setExecutando(false);
    }
  }

  return (
    <>
      <Botao variante="secundario" onClick={() => setAberto(true)} icone={<Undo2 aria-hidden="true" />} data-testid="desfazer-importacao">
        Desfazer importação
      </Botao>
      <Dialogo
        aberto={aberto}
        onFechar={fechar}
        titulo="Desfazer importação"
        alerta="perigo"
        bloqueado={executando}
        descricao={
          <>
            Serão excluídos <strong className="font-semibold text-fg">{pendentes}</strong> {pendentes === 1 ? 'lançamento pendente' : 'lançamentos pendentes'} deste lote,
            inclusive os que já receberam empresa.
            {pagos > 0 && ` ${pagos} já ${pagos === 1 ? 'pago fica' : 'pagos ficam'} (o pagamento já mexeu no saldo).`} Depois, as mesmas linhas podem ser importadas de novo.
          </>
        }
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
              textoCarregando="Desfazendo..."
              data-testid="desfazer-importacao-confirmar"
            >
              Desfazer
            </Botao>
          </>
        }
      >
        <form id={`${id}-form`} onSubmit={confirmar} className="flex flex-col gap-4">
          <BotaoBaixarBackup tamanho="sm" variante="fantasma" className="-ml-2 self-start" rotulo="Baixar backup completo antes (.json)" />
          <fieldset disabled={executando} className="flex flex-col gap-4">
            <Campo id={`${id}-senha`} rotulo="Sua senha" erro={erroSenha}>
              <Entrada
                {...ariaCampo(`${id}-senha`, erroSenha)}
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                data-testid="desfazer-importacao-senha"
              />
            </Campo>
            <Campo
              id={`${id}-frase`}
              rotulo="Frase de confirmação"
              dica={
                <>
                  Digite <span className="font-mono font-semibold text-fg select-all">{FRASE_DESFAZER}</span> exatamente como está.
                </>
              }
            >
              <Entrada
                {...ariaCampo(`${id}-frase`, undefined, true)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={frase}
                onChange={(e) => setFrase(e.target.value)}
                className="font-mono"
                data-testid="desfazer-importacao-frase"
              />
            </Campo>
          </fieldset>
        </form>
      </Dialogo>
    </>
  );
}
