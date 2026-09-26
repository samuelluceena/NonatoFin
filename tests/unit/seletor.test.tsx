/**
 * Seletor customizado (substitui todo <select> nativo): acessibilidade,
 * teclado, clique fora e integração com React Hook Form (register e
 * Controller) — os valores enviados continuam os mesmos.
 */
import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Controller, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';
import { Campo } from '@/components/ui/campo';
import { Seletor, type OpcaoSeletor } from '@/components/ui/seletor';

const EMPRESAS: OpcaoSeletor[] = [
  { valor: 'a', rotulo: 'Ateliê Centro' },
  { valor: 'b', rotulo: 'Bazar Iguatu', desabilitada: true },
  { valor: 'c', rotulo: 'Confecções Lima' },
  { valor: 'd', rotulo: 'Côco Modas' },
];

function Controlado({ inicial = '', aoMudar }: { inicial?: string; aoMudar?: (v: string) => void }) {
  const [valor, setValor] = useState(inicial);
  return (
    <>
      <Campo id="empresa" rotulo="Empresa">
        <Seletor
          id="empresa"
          name="empresa"
          value={valor}
          onChange={(e) => {
            setValor(e.target.value);
            aoMudar?.(e.target.value);
          }}
          placeholder="Selecione a empresa"
          opcoes={EMPRESAS}
        />
      </Campo>
      <p>fora</p>
    </>
  );
}

describe('Seletor', () => {
  it('não usa <select> nativo e expõe combobox + listbox ligados ao rótulo', async () => {
    const user = userEvent.setup();
    const { container } = render(<Controlado />);
    expect(container.querySelector('select')).toBeNull();
    const campo = screen.getByRole('combobox', { name: 'Empresa' });
    expect(campo).toHaveAttribute('id', 'empresa');
    expect(campo).toHaveAttribute('aria-expanded', 'false');
    expect(campo).toHaveTextContent('Selecione a empresa');

    await user.click(campo);
    const lista = screen.getByRole('listbox', { name: 'Empresa' });
    expect(campo).toHaveAttribute('aria-expanded', 'true');
    expect(campo).toHaveAttribute('aria-controls', lista.id);
    expect(screen.getAllByRole('option')).toHaveLength(5);
    expect(screen.getByRole('option', { name: 'Bazar Iguatu' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('clique escolhe, marca a opção e devolve o foco; opção desabilitada não escolhe', async () => {
    const user = userEvent.setup();
    const aoMudar = vi.fn();
    const { container } = render(<Controlado aoMudar={aoMudar} />);
    const campo = screen.getByLabelText('Empresa');

    await user.click(campo);
    await user.click(screen.getByRole('option', { name: 'Bazar Iguatu' }));
    expect(aoMudar).not.toHaveBeenCalled();

    await user.click(screen.getByRole('option', { name: 'Confecções Lima' }));
    expect(aoMudar).toHaveBeenCalledWith('c');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(campo).toHaveTextContent('Confecções Lima');
    expect(campo).toHaveAttribute('data-valor', 'c');
    expect(campo).toHaveFocus();
    expect(container.querySelector('input[type="hidden"][name="empresa"]')).toHaveValue('c');

    await user.click(campo);
    expect(screen.getByRole('option', { name: 'Confecções Lima' })).toHaveAttribute('aria-selected', 'true');
    // Escolher a mesma opção não dispara "change" (como o select nativo).
    await user.click(screen.getByRole('option', { name: 'Confecções Lima' }));
    expect(aoMudar).toHaveBeenCalledTimes(1);
  });

  it('teclado: Enter/Espaço/setas abrem, setas pulam desabilitadas, Enter escolhe, Esc fecha', async () => {
    const user = userEvent.setup();
    const aoMudar = vi.fn();
    render(<Controlado aoMudar={aoMudar} />);
    const campo = screen.getByLabelText('Empresa');
    campo.focus();

    await user.keyboard('{Enter}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    const ativa = () => document.getElementById(campo.getAttribute('aria-activedescendant') ?? '')?.textContent;
    expect(ativa()).toBe('Selecione a empresa');
    await user.keyboard('{ArrowDown}');
    expect(ativa()).toBe('Ateliê Centro');
    await user.keyboard('{ArrowDown}'); // pula "Bazar" (desabilitada)
    expect(ativa()).toBe('Confecções Lima');
    await user.keyboard('{End}');
    expect(ativa()).toBe('Côco Modas');
    await user.keyboard('{Home}');
    expect(ativa()).toBe('Selecione a empresa');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(campo).toHaveFocus();
    expect(aoMudar).not.toHaveBeenCalled();

    await user.keyboard(' ');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(aoMudar).toHaveBeenLastCalledWith('a');
    expect(screen.queryByRole('listbox')).toBeNull();

    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    await user.keyboard('{Tab}');
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('digitar letras salta para a opção (sem acento, repetindo avança)', async () => {
    const user = userEvent.setup();
    render(<Controlado />);
    const campo = screen.getByLabelText('Empresa');
    await user.click(campo);
    const ativa = () => document.getElementById(campo.getAttribute('aria-activedescendant') ?? '')?.textContent;
    await user.keyboard('c');
    expect(ativa()).toBe('Confecções Lima');
    await user.keyboard('c');
    expect(ativa()).toBe('Côco Modas');
  });

  it('clique fora fecha sem escolher', async () => {
    const user = userEvent.setup();
    render(<Controlado inicial="a" />);
    await user.click(screen.getByLabelText('Empresa'));
    fireEvent.pointerDown(screen.getByText('fora'));
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByLabelText('Empresa')).toHaveTextContent('Ateliê Centro');
  });

  it('desabilitado não abre', async () => {
    const user = userEvent.setup();
    render(<Seletor id="x" aria-label="Fatura" disabled placeholder="—" opcoes={[]} />);
    await user.click(screen.getByRole('combobox', { name: 'Fatura' }));
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});

interface Valores {
  empresaId: string;
  parcelas: number;
}

function FormularioRHF({ aoEnviar }: { aoEnviar: (v: Valores) => void }) {
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<Valores>({ defaultValues: { empresaId: 'c', parcelas: 1 } });
  return (
    <form onSubmit={(e) => void handleSubmit(aoEnviar)(e)}>
      <Campo id="empresaId" rotulo="Empresa" erro={errors.empresaId?.message}>
        <Seletor
          id="empresaId"
          {...register('empresaId', { validate: (v) => v !== '' || 'Selecione a empresa.' })}
          placeholder="Selecione a empresa"
          opcoes={EMPRESAS}
        />
      </Campo>
      <Campo id="parcelas" rotulo="Parcelas">
        <Controller
          control={control}
          name="parcelas"
          render={({ field }) => (
            <Seletor
              id="parcelas"
              name={field.name}
              ref={field.ref}
              onBlur={field.onBlur}
              value={String(field.value)}
              onChange={(e) => field.onChange(Number(e.target.value))}
              opcoes={[1, 2, 3].map((n) => ({ valor: String(n), rotulo: n === 1 ? 'À vista' : `${n}x` }))}
            />
          )}
        />
      </Campo>
      <button type="button" onClick={() => setValue('empresaId', '')}>
        Limpar
      </button>
      <button type="submit">Salvar</button>
    </form>
  );
}

describe('Seletor + React Hook Form', () => {
  it('register: mostra o defaultValue, envia o valor escolhido; Controller converte para número', async () => {
    const user = userEvent.setup();
    const aoEnviar = vi.fn();
    render(<FormularioRHF aoEnviar={aoEnviar} />);
    const empresa = screen.getByLabelText('Empresa');
    expect(empresa).toHaveTextContent('Confecções Lima');

    await user.click(empresa);
    await user.click(screen.getByRole('option', { name: 'Côco Modas' }));
    await user.click(screen.getByLabelText('Parcelas'));
    await user.click(screen.getByRole('option', { name: '3x' }));
    await user.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(aoEnviar).toHaveBeenCalledTimes(1));
    expect(aoEnviar.mock.calls[0][0]).toEqual({ empresaId: 'd', parcelas: 3 });
  });

  it('setValue atualiza o campo e o erro de validação foca o Seletor', async () => {
    const user = userEvent.setup();
    const aoEnviar = vi.fn();
    render(<FormularioRHF aoEnviar={aoEnviar} />);
    await user.click(screen.getByRole('button', { name: 'Limpar' }));
    const empresa = screen.getByLabelText('Empresa');
    expect(empresa).toHaveTextContent('Selecione a empresa');

    await user.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Selecione a empresa.');
    expect(aoEnviar).not.toHaveBeenCalled();
    expect(empresa).toHaveFocus();
  });
});
