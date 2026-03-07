export interface UserBlock {
  readonly id: string;
  readonly blocker_id: string;
  readonly blocked_id: string;
  readonly created_at: string;
}
