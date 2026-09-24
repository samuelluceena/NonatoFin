'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Botao } from '@/components/ui/botao';
import { Campo, Entrada, ariaCampo } from '@/components/ui/campo';
import { Dialogo } from '@/components/ui/dialogo';
import { LIMITES } from '@/lib/config';
import { excluirFornecedor, renomearFornecedor } from '../acoes';

/** Renomear e excluir fornecedor (exclusão só sem boletos vinculados). */
export function AcoesFornecedor({ id, nome, quantidadeLancamentos }: { id: string; nome: string; quantidadeLancamentos: number }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [novoNome, setNovoNome] = useState(nome);
  const [erro, setErro] = useState<string>();
  const [pendente, iniciar] = useTransition();

  function renomear() {
    if (pendente) return;
    iniciar(async () => {
      const r = await renomearFornecedor(id, novoNome);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      toast.success(r.mensagem);
      setEditando(false);
      router.refresh();
    });
  }

  function excluir() {
    if (pendente) return;
    iniciar(async () => {
      const r = await excluirFornecedor(id);
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      toast.success(r.mensagem);
      setExcluindo(false);
      router.push('/fornecedores');
    });
  }

  return (
    <>
      <Botao variante="secundario" onClick={() => { setNovoNome(nome); setErro(undefined); setEditando(true); }} icone={<Pencil className="size-4.5" aria-hidden="true" />}>
        Renomear
      </Botao>
      <Botao variante="secundario" onClick={() => setExcluindo(true)} icone={<Trash2 className="size-4.5 text-danger" aria-hidden="true" />}>
        Excluir
      </Botao>

      <Dialogo
        aberto={editando}
        onFechar={() => setEditando(false)}
        titulo="Renomear fornecedor"
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setEditando(false)} disabled={pendente}>Cancelar</Botao>
            <Botao onClick={renomear} carregando={pendente} textoCarregando="Salvando...">Salvar</Botao>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); renomear(); }}>
          <Campo id="renomear-fornecedor" rotulo="Nome" erro={erro}>
            <Entrada {...ariaCampo('renomear-fornecedor', erro)} value={novoNome} onChange={(e) => setNovoNome(e.target.value)} maxLength={LIMITES.fornecedorNomeMax} autoComplete="off" />
          </Campo>
        </form>
      </Dialogo>

      <Dialogo
        aberto={excluindo}
        onFechar={() => setExcluindo(false)}
        titulo="Excluir fornecedor?"
        descricao={
          quantidadeLancamentos > 0
            ? `“${nome}” possui ${quantidadeLancamentos} boleto(s). Exclua os boletos antes de excluir o fornecedor.`
            : `“${nome}” será excluído permanentemente.`
        }
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setExcluindo(false)} disabled={pendente}>Cancelar</Botao>
            <Botao variante="perigo" onClick={excluir} carregando={pendente} textoCarregando="Excluindo..." disabled={quantidadeLancamentos > 0}>
              Excluir
            </Botao>
          </>
        }
      />
    </>
  );
}
