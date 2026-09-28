import Link from 'next/link';
import { Entrada } from './campo';
import { classesBotao } from './botao';

interface Props {
  acao: string;
  de: string;
  ate: string;
  /** Parâmetros atuais que devem ser preservados. */
  manter?: Record<string, string>;
  rotuloDe?: string;
  rotuloAte?: string;
}

/**
 * Filtro de período por formulário GET (funciona mesmo sem JavaScript).
 * Datas em inputs nativos (seletor do celular), valor AAAA-MM-DD.
 */
export function FiltroPeriodo({ acao, de, ate, manter = {}, rotuloDe = 'De', rotuloAte = 'Até' }: Props) {
  const limpar = new URLSearchParams(Object.entries(manter).filter(([, v]) => v)).toString();
  return (
    <form action={acao} method="get" className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
      {Object.entries(manter).map(([chave, valor]) => (valor ? <input key={chave} type="hidden" name={chave} value={valor} /> : null))}
      <label className="flex flex-col gap-1 text-meta font-medium text-fg-2">
        {rotuloDe}
        <Entrada type="date" name="de" defaultValue={de} className="h-11" />
      </label>
      <label className="flex flex-col gap-1 text-meta font-medium text-fg-2">
        {rotuloAte}
        <Entrada type="date" name="ate" defaultValue={ate} className="h-11" />
      </label>
      <button type="submit" className={classesBotao('secundario', 'md')}>
        Aplicar período
      </button>
      {(de || ate) && (
        <Link href={limpar ? `${acao}?${limpar}` : acao} className={classesBotao('fantasma', 'md')}>
          Limpar
        </Link>
      )}
    </form>
  );
}
