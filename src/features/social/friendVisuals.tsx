/**
 * L.3d — o visual do amigo em dois componentes.
 *
 * Saíram do `FriendsList` na mesma fatia que o painel de busca e a lista de
 * pedidos, que são os dois lugares que desenham amigo. As classes são as de
 * antes, byte a byte.
 */
import React from 'react';
import { Bot, Cpu, Shield, Skull, Wifi, Zap } from 'lucide-react';

/** O ícone de avatar gravado no perfil (`cpu` é o padrão). */
export const FriendAvatar: React.FC<{ iconKey: string }> = ({ iconKey }) => {
  switch (iconKey) {
    case 'shield':
      return <Shield className="w-3.5 h-3.5 text-accent-400" />;
    case 'skull':
      return <Skull className="w-3.5 h-3.5 text-fault-400" />;
    case 'bot':
      return <Bot className="w-3.5 h-3.5 text-signal-400" />;
    case 'zap':
      return <Zap className="w-3.5 h-3.5 text-ok-400" />;
    default:
      return <Cpu className="w-3.5 h-3.5 text-ok-400" />;
  }
};

/** O LED de status do amigo, com a cor e o rótulo de antes. */
export const FriendStatus: React.FC<{ status: string }> = ({ status }) => {
  let color = 'text-ok-400';
  let label = 'ONLINE';
  if (status === 'em jogo') {
    color = 'text-accent-400';
    label = 'EM JOGO';
  } else if (status === 'inativo') {
    color = 'text-signal-400';
    label = 'INATIVO';
  } else if (status === 'offline') {
    color = 'text-subtle';
    label = 'OFFLINE';
  }

  return (
    <div className="flex items-center space-x-1 text-micro">
      <Wifi className={`w-2.5 h-2.5 ${color}`} />
      <span className={`font-bold uppercase ${color}`}>{label}</span>
    </div>
  );
};
