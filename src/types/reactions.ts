export interface MessageReaction {
  readonly id: string;
  readonly message_id: string;
  readonly user_id: string;
  readonly emoji: string;
  readonly created_at: string;
}

// Aggregated reaction data for a single emoji on a message
export interface ReactionSummary {
  readonly emoji: string;
  readonly count: number;
  /** True if the current authenticated user has reacted with this emoji */
  readonly has_reacted: boolean;
  readonly user_ids: readonly string[];
}
