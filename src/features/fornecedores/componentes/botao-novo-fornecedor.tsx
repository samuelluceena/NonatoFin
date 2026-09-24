'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Botao } from '@/components/ui/botao';
import { Campo, Entrada, ariaCampo } from '@/components/ui/campo';
import { Dialogo } from '@/components/ui/dialogo';
import { LIMITES } from '@/lib/config';
import { criarFornecedor } from '../acoes';

export function BotaoNovoFornecedor() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState<string>();
  const [pendente, iniciar] = useTransition();

  function salvar() {
    if (pendente) return;
    iniciar(async () => {
      const r = await criarFornecedor(nome);
      if (!r.ok) {
        setErro(r.erro);
        return;
      }
      if (r.dados.existente) toast.info(r.mensagem);
      else toast.success(r.mensagem);
      setAberto(false);
      setNome('');
      setErro(undefined);
      router.push(`/fornecedores/${r.dados.id}`);
    });
  }

  return (
    <>
      <Botao onClick={() => setAberto(true)} icone={<Plus className="size-5" aria-hidden="true" />} variante="secundario">
        Novo fornecedor
      </Botao>
      <Dialogo
        aberto={aberto}
        onFechar={() => setAberto(false)}
        titulo="Novo fornecedor"
        descricao="Maiúsculas, minúsculas e acentos não criam duplicados."
        rodape={
          <>
            <Botao variante="secundario" onClick={() => setAberto(false)} disabled={pendente}>
              Cancelar
            </Botao>
            <Botao onClick={salvar} carregando={pendente} textoCarregando="Salvando...">
              Salvar
            </Botao>
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            salvar();
          }}
        >
          <Campo id="novo-fornecedor" rotulo="Nome" erro={erro}>
            <Entrada
              {...ariaCampo('novo-fornecedor', erro)}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={LIMITES.fornecedorNomeMax}
              autoComplete="off"
              autoCapitalize="words"
            />
          </Campo>
        </form>
      </Dialogo>
    </>
  );
}
