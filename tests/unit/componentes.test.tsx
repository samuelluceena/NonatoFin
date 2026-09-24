import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampoMoeda } from '@/components/ui/campo-moeda';
import { SeloStatus } from '@/components/ui/selo-status';
import { rotuloDia } from '@/features/lancamentos/componentes/lista-lancamentos';
import { destinoSeguro } from '@/lib/auth/destino';
import { ehRotaPublica } from '@/lib/supabase/sessao-proxy';
import { estaAtivo } from '@/components/layout/navegacao';

describe('SeloStatus: estado nunca representado só por cor', () => {
  it.each([
    ['pago', 'Pago'],
    ['pendente', 'Pendente'],
    ['atrasado', 'Atrasado'],
  ] as const)('%s mostra texto e ícone', (status, texto) => {
    const { container } = render(<SeloStatus status={status} />);
    expect(screen.getByText(texto)).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

function CampoMoedaControlado() {
  const [valor, setValor] = useState(0);
  return (
    <>
      <label htmlFor="v">Valor</label>
      <CampoMoeda id="v" valor={valor} onValorChange={setValor} />
      <output data-testid="centavos">{valor}</output>
    </>
  );
}

describe('CampoMoeda (máscara de banco)', () => {
  it('digitar 299500 resulta em R$ 2.995,00 = 299500 centavos', async () => {
    render(<CampoMoedaControlado />);
    const campo = screen.getByLabelText('Valor');
    await userEvent.type(campo, '299500');
    expect(campo).toHaveValue('2.995,00');
    expect(screen.getByTestId('centavos')).toHaveTextContent('299500');
  });

  it('apagar remove o último dígito', async () => {
    render(<CampoMoedaControlado />);
    const campo = screen.getByLabelText('Valor');
    await userEvent.type(campo, '10050');
    expect(campo).toHaveValue('100,50');
    await userEvent.type(campo, '{backspace}');
    expect(campo).toHaveValue('10,05');
    expect(campo).toHaveAttribute('inputmode', 'numeric');
  });
});

describe('rótulos e navegação', () => {
  it('rotuloDia', () => {
    expect(rotuloDia('2026-09-23', '2026-09-23')).toBe('Hoje — 23/09/2026');
    expect(rotuloDia('2026-09-24', '2026-09-23')).toBe('Amanhã — 24/09/2026');
    expect(rotuloDia('2026-09-22', '2026-09-23')).toBe('Ontem — 22/09/2026');
    expect(rotuloDia('2026-09-27', '2026-09-23')).toBe('Domingo, 27/09/2026');
  });

  it('item ativo da navegação', () => {
    expect(estaAtivo('/', '/')).toBe(true);
    expect(estaAtivo('/boletos', '/')).toBe(false);
    expect(estaAtivo('/boletos/abc', '/boletos')).toBe(true);
  });
});

describe('segurança de redirecionamento e rotas', () => {
  it('destinoSeguro bloqueia open redirect', () => {
    expect(destinoSeguro('/boletos?filtro=hoje')).toBe('/boletos?filtro=hoje');
    expect(destinoSeguro('https://malicioso.com')).toBe('/');
    expect(destinoSeguro('//malicioso.com')).toBe('/');
    expect(destinoSeguro('/\\malicioso.com')).toBe('/');
    expect(destinoSeguro('/login')).toBe('/');
    expect(destinoSeguro(null)).toBe('/');
  });

  it('somente /login é rota pública', () => {
    expect(ehRotaPublica('/login')).toBe(true);
    expect(ehRotaPublica('/')).toBe(false);
    expect(ehRotaPublica('/api/exportar')).toBe(false);
    expect(ehRotaPublica('/loginx')).toBe(false);
  });
});
