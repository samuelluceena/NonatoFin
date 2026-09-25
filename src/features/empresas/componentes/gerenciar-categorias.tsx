'use client';

import { Info, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Botao } from '@/components/ui/botao';
import { Campo, Entrada, ariaCampo } from '@/components/ui/campo';
import { Dialogo } from '@/components/ui/dialogo';
import { Selo } from '@/components/ui/selo';
import { LIMITES } from '@/lib/config';
import { USO_VAZIO, categoriaEmUso, descreverUso } from '@/lib/domain/categorias';
import type { Categoria, UsoCategoria } from '@/lib/domain/tipos';
import { criarCategoria, excluirCategoria, renomearCategoria } from '../acoes';

interface Props {
  categorias: Categoria[];
  /** Uso de cada categoria (id → contagens). */
  uso: Record<string, UsoCategoria>;
}

/**
 * Lista editável de categorias: criar, editar (renomear) e excluir. Categoria
 * em uso não pode ser excluída — a tela explica antes, e o banco bloqueia de
 * qualquer forma (FK restrict).
 */
export function GerenciarCategorias({ categorias, uso }: Props) {
  const router = useRouter();
  const [editando, setEditando] = useState<Categoria | 'nova' | null>(null);
  const [excluindo, setExcluindo] = useState<Categoria | null>(null);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string>();
  const [pendente, iniciar] = useTransition();
  const usoDe = (c: Categoria) => uso[c.id] ?? USO_VAZIO;
  const excluindoEmUso = excluindo ? categoriaEmUso(usoDe(excluindo)) : false;

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
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm text-fg-2">
          {categorias.length} {categorias.length === 1 ? 'categoria' : 'categorias'}
        </p>
        <Botao
          onClick={() => {
            setEditando('nova');
            setNome('');
            setErro(undefined);
          }}
          icone={<Plus className="size-5" aria-hidden="true" />}
        >
          Nova categoria
        </Botao>
      </div>

      <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface" data-testid="lista-categorias">
        {categorias.map((c) => {
          const u = usoDe(c);
          const emUso = categoriaEmUso(u);
          return (
            <li key={c.id} className="flex min-h-16 items-center gap-2 py-2 pr-2 pl-4" data-testid="item-categoria">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-body font-medium text-fg">{c.nome}</span>
                  {emUso && (
                    <Selo className="shrink-0" data-testid="selo-em-uso">
                      Em uso
                    </Selo>
                  )}
                </span>
                <span className="block truncate text-meta text-fg-3" data-testid="uso-categoria">
                  {descreverUso(u)}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditando(c);
                  setNome(c.nome);
                  setErro(undefined);
                }}
                className="grid size-11 shrink-0 place-items-center rounded-md text-fg-2 hover:bg-surface-2 hover:text-fg"
                aria-label={`Editar ${c.nome}`}
                title="Editar categoria"
              >
                <Pencil className="size-4.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setExcluindo(c)}
                className="grid size-11 shrink-0 place-items-center rounded-md text-danger hover:bg-danger-soft"
                aria-label={`Excluir ${c.nome}`}
                title="Excluir categoria"
              >
                <Trash2 className="size-4.5" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>

      <Dialogo
        aberto={editando !== null}
        onFechar={() => setEditando(null)}
        titulo={editando === 'nova' ? 'Nova categoria' : 'Editar categoria'}
        descricao={editando && editando !== 'nova' && categoriaEmUso(usoDe(editando)) ? 'O novo nome vale também para os registros que já usam esta categoria.' : undefined}
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
        titulo={excluindoEmUso ? 'Não é possível excluir' : 'Excluir categoria?'}
        alerta={excluindoEmUso ? 'aviso' : 'perigo'}
        descricao={
          excluindo &&
          (excluindoEmUso ? (
            <span className="flex gap-2" data-testid="aviso-categoria-em-uso">
              <Info className="mt-0.5 size-4 shrink-0 text-primary-text" aria-hidden="true" />
              <span>
                Esta categoria está sendo utilizada em transações e não pode ser excluída.
                <span className="mt-1 block text-fg-3">
                  “{excluindo.nome}”: {descreverUso(usoDe(excluindo))}. Você pode editar o nome.
                </span>
              </span>
            </span>
          ) : (
            `“${excluindo.nome}” será excluída. Esta ação não pode ser desfeita.`
          ))
        }
        rodape={
          excluindoEmUso ? (
            <Botao onClick={() => setExcluindo(null)}>Entendi</Botao>
          ) : (
            <>
              <Botao variante="secundario" onClick={() => setExcluindo(null)} disabled={pendente}>
                Cancelar
              </Botao>
              <Botao variante="perigo" onClick={excluir} carregando={pendente} textoCarregando="Excluindo...">
                Excluir categoria
              </Botao>
            </>
          )
        }
      />
    </>
  );
}
