/**
 * Gerenciamento de dados: validações (frases exatas), textos/contagens do
 * backup e o diálogo de confirmação forte (travado até senha + frase).
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Dialogo } from '@/components/ui/dialogo';
import { DialogoConfirmacaoForte } from '@/features/dados/componentes/dialogo-confirmacao-forte';
import { FRASES, esquemaLimpeza, esquemaRestauracao } from '@/features/dados/esquemas';
import { lerContagens, resumirContagens, rotuloQuantidade, tabelasDoNivel, totalDe, TABELAS_FINANCEIRAS } from '@/features/dados/formato-backup';

const roteador = { replace: vi.fn(), refresh: vi.fn(), push: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => roteador }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

beforeEach(() => vi.clearAllMocks());

describe('frases e validação', () => {
  it('opção 1 e 2 exigem a frase exata', () => {
    expect(esquemaLimpeza.safeParse({ nivel: 'financeiro', senha: 'x', frase: 'LIMPAR DADOS FINANCEIROS' }).success).toBe(true);
    expect(esquemaLimpeza.safeParse({ nivel: 'completo', senha: 'x', frase: 'REINICIAR NONATOFIN' }).success).toBe(true);
    for (const frase of ['limpar dados financeiros', 'LIMPAR DADOS FINANCEIROS ', ' LIMPAR DADOS FINANCEIROS', 'REINICIAR NONATOFIN', '']) {
      expect(esquemaLimpeza.safeParse({ nivel: 'financeiro', senha: 'x', frase }).success, frase).toBe(false);
    }
    expect(esquemaLimpeza.safeParse({ nivel: 'completo', senha: 'x', frase: 'LIMPAR DADOS FINANCEIROS' }).success).toBe(false);
  });

  it('senha obrigatória e nível válido', () => {
    expect(esquemaLimpeza.safeParse({ nivel: 'financeiro', senha: '', frase: FRASES.financeiro }).success).toBe(false);
    expect(esquemaLimpeza.safeParse({ nivel: 'tudo', senha: 'x', frase: FRASES.completo }).success).toBe(false);
  });

  it('restauração: frase RESTAURAR BACKUP e id válido', () => {
    const id = '7a1d1b8e-5f8f-4b56-9a3a-0c1d2e3f4a5b';
    expect(esquemaRestauracao.safeParse({ backupId: id, senha: 'x', frase: 'RESTAURAR BACKUP' }).success).toBe(true);
    expect(esquemaRestauracao.safeParse({ backupId: id, senha: 'x', frase: 'restaurar backup' }).success).toBe(false);
    expect(esquemaRestauracao.safeParse({ backupId: 'abc', senha: 'x', frase: 'RESTAURAR BACKUP' }).success).toBe(false);
  });
});

describe('contagens e textos', () => {
  const contagens = lerContagens({ lancamentos: 312, movimentos_conta: 1, compras_cartao: '4', parcelas_cartao: -2, empresas: 'x' });

  it('normaliza o JSON do banco (ausente, negativo ou inválido = 0)', () => {
    expect(contagens).toMatchObject({ lancamentos: 312, movimentos_conta: 1, compras_cartao: 4, parcelas_cartao: 0, empresas: 0, categorias: 0 });
  });

  it('singular, plural e separador de milhar', () => {
    expect(rotuloQuantidade('movimentos_conta', 1)).toBe('1 movimentação');
    expect(rotuloQuantidade('lancamentos', 1234)).toBe('1.234 lançamentos');
  });

  it('resume só as tabelas com registros', () => {
    expect(resumirContagens(contagens, TABELAS_FINANCEIRAS)).toBe('312 lançamentos · 4 compras no cartão · 1 movimentação');
    expect(resumirContagens(lerContagens({}), TABELAS_FINANCEIRAS)).toBe('Nenhum registro');
  });

  it('opção 1 = 4 tabelas financeiras; opção 2 = as 9', () => {
    expect(tabelasDoNivel('financeiro')).toEqual(['lancamentos', 'compras_cartao', 'parcelas_cartao', 'movimentos_conta']);
    expect(tabelasDoNivel('completo')).toHaveLength(9);
    expect(totalDe(contagens, tabelasDoNivel('financeiro'))).toBe(317);
  });
});

describe('Dialogo bloqueado', () => {
  it('não fecha com Esc enquanto bloqueado', () => {
    const fechar = vi.fn();
    const { rerender } = render(<Dialogo aberto onFechar={fechar} titulo="Teste" bloqueado />);
    const dialogo = document.querySelector('dialog')!;
    const esc = new Event('cancel', { cancelable: true });
    dialogo.dispatchEvent(esc);
    expect(esc.defaultPrevented).toBe(true);
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeDisabled();

    rerender(<Dialogo aberto onFechar={fechar} titulo="Teste" />);
    const esc2 = new Event('cancel', { cancelable: true });
    dialogo.dispatchEvent(esc2);
    expect(esc2.defaultPrevented).toBe(false);
  });
});

describe('DialogoConfirmacaoForte', () => {
  function montar(executar = vi.fn()) {
    render(
      <DialogoConfirmacaoForte
        aberto
        onFechar={() => {}}
        titulo="Restaurar NonatoFin do zero?"
        descricao="Apaga tudo."
        tituloApagado="Será apagado"
        apagado={[{ rotulo: 'Lançamentos', quantidade: 3 }]}
        tituloMantido="Será mantido"
        mantido={[{ rotulo: 'Login e senha' }]}
        aviso="Backup automático por até 30 dias."
        frase="REINICIAR NONATOFIN"
        rotuloConfirmar="Apagar tudo e reiniciar"
        textoProcessando="Apagando..."
        executar={executar}
        testId="limpeza-completo"
      />,
    );
    return { executar, botao: screen.getByTestId('limpeza-completo-confirmar') };
  }

  it('mostra o que será apagado e mantido, e o aviso de 30 dias', () => {
    montar();
    expect(screen.getByText('Será apagado')).toBeInTheDocument();
    expect(screen.getByText('Login e senha')).toBeInTheDocument();
    expect(screen.getByText(/30 dias/)).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('botão só libera com senha E frase exata', async () => {
    const usuario = userEvent.setup();
    const { botao } = montar();
    expect(botao).toBeDisabled();
    await usuario.type(screen.getByTestId('limpeza-completo-senha'), 'minha-senha');
    expect(botao).toBeDisabled();
    await usuario.type(screen.getByTestId('limpeza-completo-frase'), 'reiniciar nonatofin');
    expect(botao).toBeDisabled();
    await usuario.clear(screen.getByTestId('limpeza-completo-frase'));
    await usuario.type(screen.getByTestId('limpeza-completo-frase'), 'REINICIAR NONATOFIN');
    expect(botao).toBeEnabled();
  });

  it('envia senha e frase; senha errada aparece no campo', async () => {
    const usuario = userEvent.setup();
    const executar = vi.fn().mockResolvedValue({ ok: false, erro: 'Senha incorreta.', campos: { senha: 'Senha incorreta.' } });
    const { botao } = montar(executar);
    await usuario.type(screen.getByTestId('limpeza-completo-senha'), 'errada');
    await usuario.type(screen.getByTestId('limpeza-completo-frase'), 'REINICIAR NONATOFIN');
    await usuario.click(botao);
    expect(executar).toHaveBeenCalledWith({ senha: 'errada', frase: 'REINICIAR NONATOFIN' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Senha incorreta.');
    expect(roteador.replace).not.toHaveBeenCalled();
  });

  it('não executa duas vezes e redireciona após o sucesso', async () => {
    let concluir: (v: unknown) => void = () => {};
    const executar = vi.fn().mockReturnValue(new Promise((r) => (concluir = r)));
    const { botao } = montar(executar);
    fireEvent.change(screen.getByTestId('limpeza-completo-senha'), { target: { value: 'ok' } });
    fireEvent.change(screen.getByTestId('limpeza-completo-frase'), { target: { value: 'REINICIAR NONATOFIN' } });
    fireEvent.click(botao);
    fireEvent.submit(screen.getByTestId('limpeza-completo'));
    fireEvent.submit(screen.getByTestId('limpeza-completo'));
    expect(executar).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Não feche esta janela');
    await act(async () => concluir({ ok: true, dados: { destino: '/', backupId: 'x', contagens: {} }, mensagem: 'Feito.' }));
    expect(roteador.replace).toHaveBeenCalledWith('/');
    expect(roteador.refresh).toHaveBeenCalled();
  });
});
