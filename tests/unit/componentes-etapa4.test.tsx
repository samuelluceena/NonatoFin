/**
 * Componentes compartilhados da Etapa 4: métricas, valores, diálogo de
 * confirmação (alertdialog), painel de filtros (popover/sheet), caixa de
 * marcação e aviso.
 */
import { useRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { Dialogo } from '@/components/ui/dialogo';
import { Aviso, CampoMarcacao } from '@/components/ui/formulario';
import { Metrica, PainelMetricas } from '@/components/ui/metrica';
import { PainelFiltros } from '@/components/ui/painel-filtros';
import { Valor } from '@/components/ui/valor';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

let desktop = true;

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
  window.matchMedia = ((query: string) => ({
    matches: desktop && query.includes('min-width'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

/** Normaliza o espaço inquebrável do Intl. */
const texto = (el: HTMLElement) => el.textContent?.replace(/ /g, ' ');

describe('Valor (MoneyDisplay)', () => {
  it('saldo negativo com sinal tipográfico e cor quando pedido', () => {
    render(<Valor centavos={-19000} tom="negativo-perigo" />);
    const el = screen.getByText(/190,00/);
    expect(texto(el)).toBe('− R$ 190,00');
    expect(el).toHaveClass('text-danger', 'numeros');
  });

  it('movimento com sinal sempre', () => {
    render(<Valor centavos={2500} sinal="sempre" tom="semantico" />);
    const el = screen.getByText(/25,00/);
    expect(texto(el)).toBe('+ R$ 25,00');
    expect(el).toHaveClass('text-success');
  });
});

describe('Metrica / PainelMetricas', () => {
  it('valor no data-testid, contexto e perigo só quando > 0', () => {
    render(
      <PainelMetricas rotulo="Situação">
        <Metrica rotulo="Atrasados" valor={10000} tom="perigo" detalhe="1 boleto" testId="m-atrasados" />
        <Metrica rotulo="Pendentes" valor={0} tipo="contagem" tom="perigo" testId="m-qtd" />
      </PainelMetricas>,
    );
    expect(screen.getByRole('region', { name: 'Situação' })).toBeInTheDocument();
    expect(texto(screen.getByTestId('m-atrasados'))).toBe('R$ 100,00');
    expect(screen.getByTestId('m-atrasados')).toHaveClass('text-danger');
    expect(screen.getByTestId('m-qtd')).toHaveTextContent('0');
    expect(screen.getByTestId('m-qtd')).not.toHaveClass('text-danger');
    expect(screen.getByText('1 boleto')).toBeInTheDocument();
  });
});

describe('Dialogo de confirmação', () => {
  it('ação destrutiva usa role alertdialog, título e descrição acessíveis', () => {
    render(<Dialogo aberto onFechar={() => {}} titulo="Excluir conta?" descricao="O extrato será apagado." alerta="perigo" />);
    const dialogo = screen.getByRole('alertdialog', { name: 'Excluir conta?', hidden: true });
    expect(dialogo).toHaveAccessibleDescription('O extrato será apagado.');
  });

  it('diálogo comum continua role dialog', () => {
    render(<Dialogo aberto onFechar={() => {}} titulo="Nova categoria" />);
    expect(screen.getByRole('dialog', { name: 'Nova categoria', hidden: true })).toBeInTheDocument();
  });
});

function ComPainel({ onFechar }: { onFechar: () => void }) {
  const botao = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={botao}>Filtros</button>
      <p>fora</p>
      <PainelFiltros aberto ancora={botao} onFechar={onFechar} rodape={<button>Aplicar</button>}>
        <label>
          Categoria
          <select defaultValue="">
            <option value="">Todas</option>
          </select>
        </label>
      </PainelFiltros>
    </>
  );
}

describe('PainelFiltros', () => {
  it('desktop: popover (dialog não modal), foco no 1º campo, Esc e clique fora fecham', () => {
    desktop = true;
    const onFechar = vi.fn();
    render(<ComPainel onFechar={onFechar} />);
    const painel = screen.getByRole('dialog', { name: 'Mais filtros' });
    expect(painel).toHaveAttribute('aria-modal', 'false');
    expect(screen.getByLabelText('Categoria')).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onFechar).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(screen.getByText('fora'));
    expect(onFechar).toHaveBeenCalledTimes(2);
    fireEvent.pointerDown(screen.getByLabelText('Categoria'));
    expect(onFechar).toHaveBeenCalledTimes(2); // clique dentro não fecha
  });

  it('celular: sheet (Dialogo modal)', () => {
    desktop = false;
    render(<ComPainel onFechar={() => {}} />);
    const sheet = screen.getByRole('dialog', { name: 'Mais filtros', hidden: true });
    expect(sheet.tagName).toBe('DIALOG');
    desktop = true;
  });
});

describe('Formulários', () => {
  it('CampoMarcacao é um checkbox real ligado ao rótulo', async () => {
    const user = userEvent.setup();
    render(<CampoMarcacao rotulo="Conta padrão da empresa" descricao="Vem marcada nos novos lançamentos." />);
    const caixa = screen.getByLabelText(/Conta padrão da empresa/);
    expect(caixa).not.toBeChecked();
    await user.click(screen.getByText('Conta padrão da empresa'));
    expect(caixa).toBeChecked();
  });

  it('Aviso mostra o texto com ícone decorativo', () => {
    render(<Aviso tom="aviso">Faltam dados.</Aviso>);
    expect(screen.getByText('Faltam dados.')).toBeInTheDocument();
  });
});
