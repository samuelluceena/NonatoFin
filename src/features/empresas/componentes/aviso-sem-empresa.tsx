import { Building } from 'lucide-react';
import { LinkBotao } from '@/components/ui/botao';
import { EstadoVazio } from '@/components/ui/estado-vazio';

/** Primeiro uso: todo lançamento precisa de uma empresa. */
export function AvisoSemEmpresa() {
  return (
    <EstadoVazio
      icone={<Building />}
      titulo="Cadastre suas empresas primeiro"
      descricao="Todo lançamento pertence a uma empresa (CNPJ). Cadastre, por exemplo, Cristina de Lucena Ferreira e J F Lima Confecções."
      acao={<LinkBotao href="/configuracoes/empresas">Cadastrar empresas</LinkBotao>}
    />
  );
}
