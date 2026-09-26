/**
 * Tema (somente Claro/Escuro, botão sol/lua) e ações rápidas ("+") em jsdom.
 * Os fluxos completos, com banco, estão em tests/e2e/tema.spec.ts e
 * tests/e2e/acoes-rapidas.spec.ts.
 */
import type { AnchorHTMLAttributes } from 'react';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ContaBancaria } from '@/lib/domain/tipos';

vi.mock('next/link', () => ({
  // Sem navegação real (jsdom não navega); o clique ainda chama o onClick.
  default: ({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onClick?.(e);
      }}
      {...props}
    />
  ),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const CONTA: ContaBancaria = {
  id: '11111111-1111-4111-8111-111111111111',
  empresa: { id: '22222222-2222-4222-8222-222222222222', apelido: 'Loja Centro' },
  apelido: 'Itaú PJ',
  banco: 'Itaú',
  final: '4321',
  padrao: true,
  ativa: true,
};
const acoesContas = vi.hoisted(() => ({
  contasParaEntrada: vi.fn(),
  registrarEntrada: vi.fn(),
  conferirSaldo: vi.fn(),
  transferir: vi.fn(),
}));
vi.mock('@/features/contas/acoes', () => acoesContas);

const { Provedores } = await import('@/components/providers/provedores');
const { SeletorTema, SeletorTemaCompacto } = await import('@/components/layout/seletor-tema');
const { AcoesRapidas } = await import('@/components/layout/acoes-rapidas');

let aparelhoEscuro = false;

beforeAll(() => {
  // jsdom não implementa <dialog> modal nem matchMedia.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
  window.matchMedia = ((query: string) => ({
    matches: aparelhoEscuro && query.includes('dark'),
    media: query,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
});

beforeEach(() => {
  aparelhoEscuro = false;
  localStorage.clear();
  document.documentElement.className = '';
  vi.clearAllMocks();
});

afterEach(() => {
  document.documentElement.className = '';
});

describe('tema: somente Claro e Escuro', () => {
  it('sol/lua alterna claro ↔ escuro em um clique e salva a escolha', async () => {
    const user = userEvent.setup();
    render(
      <Provedores>
        <SeletorTemaCompacto />
      </Provedores>,
    );
    const botao = screen.getByTestId('alternar-tema');
    await waitFor(() => expect(botao).toHaveAttribute('aria-pressed', 'false'));
    expect(botao).toHaveAccessibleName('Tema escuro');
    expect(botao.querySelector('.lucide-sun')).not.toHaveClass('hidden');

    await user.click(botao);
    expect(document.documentElement).toHaveClass('dark');
    expect(botao).toHaveAttribute('aria-pressed', 'true');
    expect(botao).toHaveAttribute('title', 'Mudar para o tema claro');
    expect(localStorage.getItem('nonatofin-tema')).toBe('dark');

    await user.click(botao);
    expect(document.documentElement).not.toHaveClass('dark');
    expect(botao).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem('nonatofin-tema')).toBe('light');
  });

  it('o aparelho no escuro não muda o padrão (claro)', async () => {
    aparelhoEscuro = true;
    render(
      <Provedores>
        <SeletorTemaCompacto />
      </Provedores>,
    );
    await waitFor(() => expect(screen.getByTestId('alternar-tema')).toHaveAttribute('aria-pressed', 'false'));
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('configurações: apenas Claro e Escuro, sem "Sistema"', async () => {
    const user = userEvent.setup();
    render(
      <Provedores>
        <SeletorTema />
      </Provedores>,
    );
    const grupo = screen.getByRole('group', { name: 'Tema' });
    expect(within(grupo).getAllByRole('radio')).toHaveLength(2);
    expect(within(grupo).queryByText('Sistema')).toBeNull();
    await user.click(within(grupo).getByText('Escuro'));
    expect(within(grupo).getByLabelText('Escuro')).toBeChecked();
    expect(document.documentElement).toHaveClass('dark');
  });

  it('preferência antiga "system" vira a escolha fixa do tema do aparelho', async () => {
    aparelhoEscuro = true;
    localStorage.setItem('nonatofin-tema', 'system');
    render(
      <Provedores>
        <SeletorTemaCompacto />
      </Provedores>,
    );
    await waitFor(() => expect(localStorage.getItem('nonatofin-tema')).toBe('dark'));
    expect(document.documentElement).toHaveClass('dark');
  });
});

describe('ações rápidas ("+")', () => {
  function renderizar() {
    const user = userEvent.setup();
    render(
      <Provedores>
        <AcoesRapidas variante="fab" />
      </Provedores>,
    );
    const gatilho = screen.getByRole('button', { name: 'Novo lançamento' });
    return { user, gatilho };
  }

  it('abre com Despesa e Entrada (ícone + texto) e fecha pelo Esc, pelo fundo e pelo botão', async () => {
    const { user, gatilho } = renderizar();
    expect(gatilho).toHaveAttribute('aria-expanded', 'false');

    await user.click(gatilho);
    expect(gatilho).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('acao-despesa')).toHaveTextContent('Despesa');
    expect(screen.getByTestId('acao-entrada')).toHaveTextContent('Entrada');
    expect(screen.getByTestId('acao-despesa').querySelector('svg')).not.toBeNull();

    // Esc: o navegador fecha o <dialog> (evento "close")
    act(() => screen.getByTestId('acao-despesa').closest('dialog')!.close());
    expect(screen.queryByTestId('acao-despesa')).toBeNull();
    expect(gatilho).toHaveAttribute('aria-expanded', 'false');

    // Clique no fundo (o próprio <dialog>)
    await user.click(gatilho);
    await user.click(screen.getByTestId('acao-despesa').closest('dialog')!);
    expect(screen.queryByTestId('acao-despesa')).toBeNull();

    // Botão fechar (no lugar do "+")
    await user.click(gatilho);
    await user.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByTestId('acao-despesa')).toBeNull();
  });

  it('Despesa leva aos fluxos existentes (conta a pagar e compra no cartão) e Voltar retorna', async () => {
    const { user, gatilho } = renderizar();
    await user.click(gatilho);
    await user.click(screen.getByTestId('acao-despesa'));
    expect(screen.getByTestId('acao-conta-a-pagar')).toHaveAttribute('href', '/boletos/novo');
    expect(screen.getByTestId('acao-conta-a-pagar')).toHaveTextContent('Conta a pagar');
    expect(screen.getByTestId('acao-compra-cartao')).toHaveAttribute('href', '/cartoes/compras/nova');
    expect(screen.getByTestId('acao-compra-cartao')).toHaveTextContent('Compra no cartão');

    await user.click(screen.getByRole('button', { name: 'Voltar' }));
    expect(screen.getByTestId('acao-entrada')).toBeInTheDocument();

    await user.click(screen.getByTestId('acao-despesa'));
    await user.click(screen.getByTestId('acao-conta-a-pagar'));
    expect(screen.queryByTestId('acao-conta-a-pagar')).toBeNull(); // fecha ao escolher
  });

  it('Entrada abre o diálogo de entrada com a conta sugerida e grava pela action existente', async () => {
    acoesContas.contasParaEntrada.mockResolvedValue({ ok: true, dados: [CONTA] });
    acoesContas.registrarEntrada.mockResolvedValue({ ok: true, dados: undefined, mensagem: 'Entrada adicionada.' });
    const { user, gatilho } = renderizar();
    await user.click(gatilho);
    await user.click(screen.getByTestId('acao-entrada'));

    const conta = await screen.findByLabelText('Conta');
    expect(conta).toHaveAttribute('data-valor', CONTA.id);
    expect(conta).toHaveTextContent('Itaú PJ •••• 4321');
    await user.click(conta);
    expect(screen.getByRole('option', { name: 'Itaú PJ •••• 4321' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Escape}');
    await user.type(screen.getByLabelText('Descrição'), 'Pix recebido');
    await user.type(screen.getByLabelText('Valor'), '2500');
    await user.click(screen.getByTestId('salvar-entrada'));

    await waitFor(() => expect(acoesContas.registrarEntrada).toHaveBeenCalledTimes(1));
    expect(acoesContas.registrarEntrada).toHaveBeenCalledWith(
      expect.objectContaining({ contaId: CONTA.id, valorCentavos: 2500, descricao: 'Pix recebido' }),
    );
    await waitFor(() => expect(screen.queryByTestId('salvar-entrada')).toBeNull());
  });

  it('Entrada sem contas oferece cadastrar uma conta', async () => {
    acoesContas.contasParaEntrada.mockResolvedValue({ ok: true, dados: [] });
    const { user, gatilho } = renderizar();
    await user.click(gatilho);
    await user.click(screen.getByTestId('acao-entrada'));
    expect(await screen.findByRole('link', { name: 'Cadastrar conta' })).toHaveAttribute('href', '/contas/nova');
    expect(screen.queryByTestId('salvar-entrada')).toBeNull();
  });
});
