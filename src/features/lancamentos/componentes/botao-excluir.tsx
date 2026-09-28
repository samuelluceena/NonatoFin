'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Botao } from '@/components/ui/botao';
import { Dialogo } from '@/components/ui/dialogo';
import type { EscopoSerie } from '@/lib/domain/tipos';
import { excluirLancamento } from '../acoes';
import { OpcoesEscopo, type InfoSerie } from './opcoes-escopo';

interface Props {
  lancamentoId: string;
  descricao: string;
  serie: InfoSerie | null;
  /** Para onde ir depois de excluir. */
  destino?: string;
}

/** Excluir com confirmação obrigatória (e escolha de escopo em séries). */
export function BotaoExcluir({ lancamentoId, descricao, serie, destino = '/boletos' }: Props) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [escopo, setEscopo] = useState<EscopoSerie>('este');
  const [excluindo, setExcluindo] = useState(false);
  const emAndamento = useRef(false);

  async function confirmar() {
    if (emAndamento.current) return;
    emAndamento.current = true;
    setExcluindo(true);
    try {
      const r = await excluirLancamento(lancamentoId, serie ? escopo : 'este');
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      toast.success(r.mensagem);
      setAberto(false);
      router.push(destino);
    } catch {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      emAndamento.current = false;
      setExcluindo(false);
    }
  }

  return (
    <>
      <Botao
        variante="secundario"
        onClick={() => {
          setEscopo('este');
          setAberto(true);
        }}
        icone={<Trash2 className="size-4.5 text-danger" aria-hidden="true" />}
        data-testid="excluir-boleto"
      >
        Excluir
      </Botao>
      <Dialogo
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo={serie ? 'Excluir boleto da série' : 'Excluir boleto?'}
        alerta="perigo"
        descricao={
          serie ? (
            <>Esta ação não pode ser desfeita. Escolha o que excluir de “{descricao}”.</>
          ) : (
            <>“{descricao}” será excluído permanentemente. Esta ação não pode ser desfeita.</>
          )
        }
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setAberto(false)} disabled={excluindo}>
              Cancelar
            </Botao>
            <Botao variante="perigo" onClick={confirmar} carregando={excluindo} textoCarregando="Excluindo..." data-testid="confirmar-exclusao">
              Excluir
            </Botao>
          </>
        }
      >
        {serie && <OpcoesEscopo nome="escopo-exclusao" info={serie} verbo="Excluir" valor={escopo} onChange={setEscopo} />}
      </Dialogo>
    </>
  );
}
