'use client';

import { Check, Copy, MessageCircle } from 'lucide-react';
import { Fragment, useState } from 'react';
import { toast } from 'sonner';
import { Botao, classesBotao } from '@/components/ui/botao';
import { linkWhatsApp } from '@/lib/domain/fechamento';
import { copiarTexto } from '@/lib/utils/area-transferencia';

/** Mostra *negrito* do WhatsApp como negrito na prévia. */
function Linha({ texto }: { texto: string }) {
  const partes = texto.split(/(\*[^*\n]+\*)/g);
  return (
    <>
      {partes.map((p, i) =>
        p.startsWith('*') && p.endsWith('*') && p.length > 2 ? <strong key={i}>{p.slice(1, -1)}</strong> : <Fragment key={i}>{p}</Fragment>,
      )}
    </>
  );
}

export function TextoFechamento({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-2 sm:grid-cols-2">
        <Botao
          variante="secundario"
          icone={copiado ? <Check className="size-5" aria-hidden="true" /> : <Copy className="size-5" aria-hidden="true" />}
          onClick={async () => {
            if (await copiarTexto(texto)) {
              setCopiado(true);
              toast.success('Texto copiado. Agora é só colar no WhatsApp.');
              setTimeout(() => setCopiado(false), 2500);
            } else toast.error('Não foi possível copiar. Selecione o texto e copie manualmente.');
          }}
        >
          {copiado ? 'Copiado' : 'Copiar texto'}
        </Botao>
        <a href={linkWhatsApp(texto)} target="_blank" rel="noopener noreferrer" className={classesBotao('primario', 'md')}>
          <MessageCircle className="size-5" aria-hidden="true" />
          Enviar no WhatsApp
        </a>
      </div>
      <div
        className="rounded-lg border border-border bg-surface p-4 text-body leading-relaxed break-words whitespace-pre-wrap text-fg shadow-sm"
        data-testid="texto-fechamento"
        aria-label="Texto do fechamento"
      >
        {texto.split('\n').map((l, i) => (
          <Fragment key={i}>
            {/* Na prévia, "R$ 10,00" não quebra de linha (o texto copiado usa espaço normal). */}
            <Linha texto={l.replace(/R\$ /g, 'R$\u00a0')} />
            {'\n'}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
