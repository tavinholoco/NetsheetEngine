/**
 * L.3d — o perfil que o pedido de amizade grava no banco.
 *
 * A G.1f mapeou o mesmo objeto montado duas vezes, igual, em
 * `handleSendRequest` e `handleAccept`. É um helper só, e os dois caminhos
 * continuam mandando exatamente o que mandavam.
 */
import { generateCyberpunkId, type User, type UserProfileData } from '../../lib/supabase';

export function profileFromUser(user: User): UserProfileData {
  return {
    uid: user.uid,
    cyberpunkId: generateCyberpunkId(user.uid),
    email: user.email,
    displayName: user.displayName || user.email?.split('@')[0] || 'Edgerunner',
    bio: '',
    avatarIcon: 'cpu',
    avatarUrl: '',
    status: 'online'
  };
}
