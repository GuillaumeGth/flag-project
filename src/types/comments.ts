export interface Comment {
  id: string;
  message_id: string;
  user_id: string;
  parent_comment_id: string | null;
  text_content: string;
  created_at: string;
}

export interface CommentUser {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface CommentWithUser extends Comment {
  user: CommentUser;
}

export interface CommentWithReplies extends CommentWithUser {
  replies: CommentWithUser[];
  like_count: number;
  has_liked: boolean;
}
