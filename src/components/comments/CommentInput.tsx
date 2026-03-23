import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/theme-redesign';
import GlassInput from '@/components/redesign/GlassInput';

interface CommentInputProps {
  onSubmit: (text: string) => void;
  replyingTo?: { id: string; userName: string } | null;
  onCancelReply?: () => void;
  onFocus?: () => void;
}

export default function CommentInput({ onSubmit, replyingTo, onCancelReply, onFocus }: CommentInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<React.ElementRef<typeof GlassInput>>(null);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText('');
  };

  return (
    <View style={styles.wrapper}>
      {replyingTo && (
        <View style={styles.replyBanner}>
          <Text style={styles.replyText} numberOfLines={1}>
            Réponse à <Text style={styles.replyUserName}>{replyingTo.userName}</Text>
          </Text>
          <TouchableOpacity onPress={onCancelReply} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close" size={16} color={colors.text.tertiary} />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.container}>
        <GlassInput
          ref={inputRef}
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Écrire un commentaire..."
          multiline
          maxLength={2000}
          onFocus={onFocus}
        />
        {text.trim().length > 0 && (
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <Ionicons name="send" size={18} color={colors.primary.violet} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface.glassDark,
  },
  replyText: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    flex: 1,
  },
  replyUserName: {
    fontWeight: '700',
    color: colors.text.accent,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: typography.sizes.sm,
    maxHeight: 80,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.xl,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface.glass,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
