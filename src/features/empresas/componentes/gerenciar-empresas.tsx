'use client';

import { Building, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Botao } from '@/components/ui/botao';
import { Campo, Entrada, ariaCampo } from '@/components/ui/campo';
import { Dialogo } from '@/components/ui/dialogo';
import { EstadoVazio } from '@/components/ui/estado-vazio';
import { LIMITES } from '@/lib/config';
import { ehCnpjValido, formatarCnpj } from '@/lib/domain/cnpj';
import type { Empresa } from '@/lib/domain/tipos';
import { atualizarEmpresa, criarEmpresa, excluirEmpresa } from '../acoes';

interface Formulario {
  apelido: string;
  razaoSocial: string;
  cnpj: string;
}

const VAZIO: Formulario = { apelido: '', razaoSocial: '', cnpj: '' };

/** Lista de empresas com cadastro, edição e exclusão. */
export function GerenciarEmpresas({ empresas }: { empresas: Empresa[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<Empresa | 'nova' | null>(null);
  const [excluindo, setExcluindo] = useState<Empresa | null>(null);
  const [form, setForm] = useState<Formulario>(VAZIO);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [pendente, iniciar] = useTransition();

  function abrir(e: Empresa | 'nova') {
    setEditando(e);
    setErros({});
    setForm(e === 'nova' ? VAZIO : { apelido: e.apelido, razaoSocial: e.razaoSocial ?? '', cnpj: e.cnpj ? formatarCnpj(e.cnpj) : '' });
  }

  function salvar() {
    if (pendente || !editando) return;
    iniciar(async () => {
      const r = editando === 'nova' ? await criarEmpresa(form) : await atualizarEmpresa(editando.id, form);
      if (!r.ok) {
        setErros(r.campos ?? {});
        toast.error(r.erro);
        return;
      }
      toast.success(r.mensagem);
      setEditando(null);
      router.refresh();
    });
  }

  function confirmarExclusao() {
    if (pendente || !excluindo) return;
    iniciar(async () => {
      const r = await excluirEmpresa(excluindo.id);
      if (!r.ok) {
        toast.error(r.erro);
        return;
      }
      toast.success(r.mensagem);
      setExcluindo(null);
      router.refresh();
    });
  }

  const cnpjDigitado = form.cnpj.trim() !== '';
  return (
    <>
      {empresas.length === 0 ? (
        <EstadoVazio
          icone={<Building />}
          titulo="Nenhuma empresa cadastrada"
          descricao="Cadastre as empresas cujas contas você controla. Todo lançamento pertence a uma empresa."
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface" data-testid="lista-empresas">
          {empresas.map((e) => (
            <li key={e.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-fg">{e.apelido}</p>
                {e.razaoSocial && <p className="truncate text-sm text-fg-2">{e.razaoSocial}</p>}
                <p className="numeros text-meta text-fg-3">{e.cnpj ? `CNPJ ${formatarCnpj(e.cnpj)}` : 'CNPJ não informado'}</p>
              </div>
              <button type="button" onClick={() => abrir(e)} className="grid size-11 place-items-center rounded-md text-fg-2 hover:bg-surface-2" aria-label={`Editar ${e.apelido}`}>
                <Pencil className="size-4.5" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => setExcluindo(e)} className="grid size-11 place-items-center rounded-md text-danger hover:bg-danger-soft" aria-label={`Excluir ${e.apelido}`}>
                <Trash2 className="size-4.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Botao variante="secundario" className="mt-3 w-full sm:w-auto" onClick={() => abrir('nova')} icone={<Plus className="size-5" aria-hidden="true" />}>
        Nova empresa
      </Botao>

      <Dialogo
        aberto={editando !== null}
        onFechar={() => setEditando(null)}
        titulo={editando === 'nova' ? 'Nova empresa' : 'Editar empresa'}
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
          className="flex flex-col gap-4 pb-1"
          onSubmit={(ev) => {
            ev.preventDefault();
            salvar();
          }}
        >
          <Campo id="empresa-apelido" rotulo="Apelido" erro={erros.apelido} dica="Nome curto que aparece nas telas. Ex.: J F Lima.">
            <Entrada {...ariaCampo('empresa-apelido', erros.apelido, true)} value={form.apelido} maxLength={LIMITES.apelidoEmpresaMax} onChange={(ev) => {
                setForm({ ...form, apelido: ev.target.value });
                if (erros.apelido) setErros({ ...erros, apelido: '' });
              }} autoComplete="off" />
          </Campo>
          <Campo id="empresa-razao" rotulo="Razão social" opcional erro={erros.razaoSocial}>
            <Entrada {...ariaCampo('empresa-razao', erros.razaoSocial)} value={form.razaoSocial} maxLength={LIMITES.razaoSocialMax} onChange={(ev) => {
                setForm({ ...form, razaoSocial: ev.target.value });
                if (erros.razaoSocial) setErros({ ...erros, razaoSocial: '' });
              }} autoComplete="off" />
          </Campo>
          <Campo
            id="empresa-cnpj"
            rotulo="CNPJ"
            erro={erros.cnpj}
            dica={cnpjDigitado ? (ehCnpjValido(form.cnpj) ? 'CNPJ válido.' : 'Confira o CNPJ (14 caracteres).') : 'Aceita o CNPJ numérico e o novo CNPJ com letras.'}
          >
            <Entrada
              {...ariaCampo('empresa-cnpj', erros.cnpj, true)}
              value={form.cnpj}
              onChange={(ev) => {
                setForm({ ...form, cnpj: ev.target.value });
                if (erros.cnpj) setErros({ ...erros, cnpj: '' });
              }}
              onBlur={() => ehCnpjValido(form.cnpj) && setForm({ ...form, cnpj: formatarCnpj(form.cnpj) })}
              autoCapitalize="characters"
              autoComplete="off"
              className="numeros uppercase"
              placeholder="00.000.000/0000-00"
            />
          </Campo>
        </form>
      </Dialogo>

      <Dialogo
        aberto={excluindo !== null}
        onFechar={() => setExcluindo(null)}
        titulo="Excluir empresa?"
        alerta="perigo"
        descricao={excluindo ? `“${excluindo.apelido}” será excluída. Só é possível excluir empresas sem lançamentos e sem cartões.` : undefined}
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setExcluindo(null)} disabled={pendente}>
              Cancelar
            </Botao>
            <Botao variante="perigo" onClick={confirmarExclusao} carregando={pendente} textoCarregando="Excluindo...">
              Excluir
            </Botao>
          </>
        }
      />
    </>
  );
}
