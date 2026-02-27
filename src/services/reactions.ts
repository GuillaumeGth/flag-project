import { supabase } from './supabase';
import { MessageReaction, ReactionSummary } from '@/types/reactions';
import { reportError } from './errorReporting';

export const ALLOWED_EMOJIS = ['❤️', '🫂', '😂', '😮', '😢', '😡', '👍'] as const;
export type AllowedEmoji = (typeof ALLOWED_EMOJIS)[number];

type MutableReactionEntry = {
  count: number;
  user_ids: string[];
  has_reacted: boolean;
};

function buildReactionSummaries(
  reactions: MessageReaction[],
  currentUserId: string
): ReactionSummary[] {
  const map = new Map<string, MutableReactionEntry>();

  for (const r of reactions) {
    if (!map.has(r.emoji)) {
      map.set(r.emoji, { count: 0, user_ids: [], has_reacted: false });
    }
    const entry = map.get(r.emoji)!;
    entry.count++;
    entry.user_ids.push(r.user_id);
    if (r.user_id === currentUserId) entry.has_reacted = true;
  }

  return Array.from(map.entries()).map(([emoji, data]) => ({
    emoji,
    count: data.count,
    has_reacted: data.has_reacted,
    user_ids: data.user_ids,
  }));
}

/**
 * Fetch and aggregate reactions for a batch of messages in a single query.
 * Returns a map of messageId → ReactionSummary[].
 * All requested IDs are present in the result (with empty array if no reactions).
 */
export async function fetchReactionsForMessages(
  messageIds: string[],
  currentUserId: string
): Promise<Record<string, ReactionSummary[]>> {
  if (messageIds.length === 0) return {};

  const result: Record<string, ReactionSummary[]> = {};
  for (const id of messageIds) result[id] = [];

  const { data, error } = await supabase
    .from('message_reactions')
    .select('*')
    .in('message_id', messageIds);

  if (error) {
    reportError(error, 'reactions.fetchReactionsForMessages');
    return result;
  }

  const byMessage = new Map<string, MessageReaction[]>();
  for (const r of data as MessageReaction[]) {
    if (!byMessage.has(r.message_id)) byMessage.set(r.message_id, []);
    byMessage.get(r.message_id)!.push(r);
  }

  for (const [messageId, reactions] of byMessage) {
    result[messageId] = buildReactionSummaries(reactions, currentUserId);
  }

  return result;
}

/**
 * Toggle a reaction on a message.
 * If `hasReacted` is true, removes the existing reaction; otherwise adds it.
 * Validates the emoji against the allowed set before writing.
 */
export async function toggleReaction(
  messageId: string,
  emoji: string,
  currentUserId: string,
  hasReacted: boolean
): Promise<void> {
  if (!(ALLOWED_EMOJIS as readonly string[]).includes(emoji)) return;

  if (hasReacted) {
    const { error } = await supabase
      .from('message_reactions')
      .delete()
      .eq('message_id', messageId)
      .eq('user_id', currentUserId)
      .eq('emoji', emoji);
    if (error) reportError(error, 'reactions.toggleReaction.delete');
  } else {
    const { error } = await supabase
      .from('message_reactions')
      .insert({ message_id: messageId, user_id: currentUserId, emoji });
    if (error) reportError(error, 'reactions.toggleReaction.insert');
  }
}
