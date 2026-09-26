'use client';

import { Building2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';
import { toast } from 'sonner';
import { Seletor, type ControleSeletor } from '@/components/ui/seletor';
import type { Empresa } from '@/lib/domain/tipos';
import { selecionarEmpresa } from '../acoes';
import { TODAS_EMPRESAS } from '../constantes';

interface Props {
  empresas: Pick<Empresa, 'id' | 'apelido'>[];
  selecionadaId: string | null;
  className?: string;
}

/** Seletor global de empresa (filtra todas as telas). Oculto com 0 ou 1 empresa. */
export function SeletorEmpresa({ empresas, selecionadaId, className }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  // Desabilitado durante a troca, o gatilho perde o foco: devolve ao terminar (teclado).
  const controle = useRef<ControleSeletor>(null);
  const devolverFoco = useRef(false);
  useEffect(() => {
    if (!pendente && devolverFoco.current) {
      devolverFoco.current = false;
      controle.current?.focus();
    }
  }, [pendente]);
  if (empresas.length < 2) return null;

  return (
    <Seletor
      variante="compacto"
      aria-label="Empresa"
      data-testid="seletor-empresa"
      ref={controle}
      icone={<Building2 />}
      value={selecionadaId ?? TODAS_EMPRESAS}
      disabled={pendente}
      onChange={(e) => {
        const valor = e.target.value;
        devolverFoco.current = true;
        iniciar(async () => {
          const r = await selecionarEmpresa(valor);
          if (!r.ok) toast.error(r.erro);
          router.refresh();
        });
      }}
      opcoes={[{ valor: TODAS_EMPRESAS, rotulo: 'Todas as empresas' }, ...empresas.map((e) => ({ valor: e.id, rotulo: e.apelido }))]}
      className={className}
    />
  );
}
