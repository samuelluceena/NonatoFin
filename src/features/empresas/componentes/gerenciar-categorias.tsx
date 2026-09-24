'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Botao } from '@/components/ui/botao';
import { Campo, Entrada, ariaCampo } from '@/components/ui/campo';
import { Dialogo } from '@/components/ui/dialogo';
import { LIMITES } from '@/lib/config';
import type { Categoria } from '@/lib/domain/tipos';
import { criarCategoria, excluirCategoria, renomearCategoria } from '../acoes';

/** Lista editável de categorias (criar, renomear, excluir se não estiver em uso). */
export function GerenciarCategorias({ categorias }: { categorias: Categoria[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<Categoria | 'nova' | null>(null);
  const [excluindo, setExcluindo] = useState<Categoria | null>(null);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string>();
  const [pendente, iniciar] = useTransition();

  function salvar() {
    if (pendente || !editando) return;
    iniciar(async () => {
      const r = editando === 'nova' ? await criarCategoria(nome) : await renomearCategoria(editando.id, nome);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      toast.success(r.mensagem);
      setEditando(null);
      router.refresh();
    });
  }

  function excluir() {
    if (pendente || !excluindo) return;
    iniciar(async () => {
      const r = await excluirCategoria(excluindo.id);
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      toast.success(r.mensagem);
      setExcluindo(null);
      router.refresh();
    });
  }

  return (
    <>
      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface" data-testid="lista-categorias">
        {categorias.map((c) => (
          <li key={c.id} className="flex items-center gap-2 py-1.5 pr-2 pl-4">
            <span className="min-w-0 flex-1 truncate text-[15px] text-fg">{c.nome}</span>
            <button
              type="button"
              onClick={() => {
                setEditando(c);
                setNome(c.nome);
                setErro(undefined);
              }}
              className="grid size-11 place-items-center rounded-md text-fg-2 hover:bg-surface-2"
              aria-label={`Renomear ${c.nome}`}
            >
              <Pencil className="size-4.5" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setExcluindo(c)} className="grid size-11 place-items-center rounded-md text-danger hover:bg-danger-soft" aria-label={`Excluir ${c.nome}`}>
              <Trash2 className="size-4.5" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <Botao
        variante="secundario"
        className="mt-3 w-full sm:w-auto"
        onClick={() => {
          setEditando('nova');
          setNome('');
          setErro(undefined);
        }}
        icone={<Plus className="size-5" aria-hidden="true" />}
      >
        Nova categoria
      </Botao>

      <Dialogo
        aberto={editando !== null}
        onFechar={() => setEditando(null)}
        titulo={editando === 'nova' ? 'Nova categoria' : 'Renomear categoria'}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setEditando(null)} disabled={pendente}>
              Cancelar
            </Botao>
            <Botao onClick={salvar} carregando={pendente} textoCarregando="Salvando...">
              Salvar
            </Botao>
          </>
        }
      >
        <form
          className="pb-1"
          onSubmit={(ev) => {
            ev.preventDefault();
            salvar();
          }}
        >
          <Campo id="categoria-nome" rotulo="Nome" erro={erro}>
            <Entrada {...ariaCampo('categoria-nome', erro)} value={nome} onChange={(ev) => setNome(ev.target.value)} maxLength={LIMITES.nomeCategoriaMax} autoComplete="off" />
          </Campo>
        </form>
      </Dialogo>

      <Dialogo
        aberto={excluindo !== null}
        onFechar={() => setExcluindo(null)}
        titulo="Excluir categoria?"
        descricao={excluindo ? `“${excluindo.nome}” será excluída. Categorias em uso não podem ser excluídas — renomeie se preferir.` : undefined}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setExcluindo(null)} disabled={pendente}>
              Cancelar
            </Botao>
            <Botao variante="perigo" onClick={excluir} carregando={pendente} textoCarregando="Excluindo...">
              Excluir
            </Botao>
          </>
        }
      />
    </>
  );
}
