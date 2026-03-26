/**
 * ScrollableWithScrollbar
 *
 * Wrappers pour ScrollView et FlatList qui affichent une scrollbar custom
 * en dégradé (style glassmorphism) cohérente avec le design system.
 *
 * Usage :
 *   <ScrollViewWithScrollbar style={...} contentContainerStyle={...}>
 *     {children}
 *   </ScrollViewWithScrollbar>
 *
 *   <FlatListWithScrollbar ref={flatListRef} data={...} renderItem={...} />
 */

import React, { useState, forwardRef } from 'react';
import {
  View,
  ScrollView,
  FlatList,
  type FlatListProps,
  type ScrollViewProps,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { scrollbar } from '@/theme-redesign';

// ─── Hook interne ─────────────────────────────────────────────────────────────

function useScrollbarState() {
  const [listHeight, setListHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);
  const [scrollY, setScrollY] = useState(0);

  const thumbHeight =
    listHeight > 0 && contentHeight > listHeight
      ? Math.max(scrollbar.minThumbHeight, (listHeight / contentHeight) * listHeight)
      : 0;

  const maxThumbTop = listHeight - thumbHeight;
  const maxScroll = contentHeight - listHeight;
  const thumbTop = maxScroll > 0 ? (scrollY / maxScroll) * maxThumbTop : 0;

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setScrollY(Math.abs(e.nativeEvent.contentOffset.y));
  }

  return { setListHeight, setContentHeight, thumbHeight, thumbTop, handleScroll };
}

// ─── Overlay scrollbar ────────────────────────────────────────────────────────

function ScrollbarOverlay({ thumbHeight, thumbTop }: { thumbHeight: number; thumbTop: number }) {
  if (thumbHeight <= 0) return null;
  return (
    <View
      style={{
        position: 'absolute',
        right: scrollbar.inset,
        top: scrollbar.inset,
        bottom: scrollbar.inset,
        width: scrollbar.width,
        borderRadius: scrollbar.borderRadius,
        backgroundColor: scrollbar.trackColor,
      }}
      pointerEvents="none"
    >
      <LinearGradient
        colors={scrollbar.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={{
          position: 'absolute',
          width: scrollbar.width,
          borderRadius: scrollbar.borderRadius,
          height: thumbHeight,
          top: thumbTop,
        }}
      />
    </View>
  );
}

// ─── ScrollViewWithScrollbar ──────────────────────────────────────────────────

type ScrollViewWithScrollbarProps = Omit<ScrollViewProps, 'style'> & {
  /** Appliqué au View wrapper (ex: maxHeight, flex, backgroundColor…) */
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function ScrollViewWithScrollbar({
  children,
  style,
  onScroll,
  onContentSizeChange,
  ...rest
}: ScrollViewWithScrollbarProps) {
  const { setListHeight, setContentHeight, thumbHeight, thumbTop, handleScroll } =
    useScrollbarState();

  return (
    <View
      style={[{ flex: 1 }, style]}
      onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          handleScroll(e);
          onScroll?.(e);
        }}
        onContentSizeChange={(w, h) => {
          setContentHeight(h);
          onContentSizeChange?.(w, h);
        }}
        style={{ flex: 1 }}
        {...rest}
      >
        {children}
      </ScrollView>
      <ScrollbarOverlay thumbHeight={thumbHeight} thumbTop={thumbTop} />
    </View>
  );
}

// ─── FlatListWithScrollbar ────────────────────────────────────────────────────

function FlatListWithScrollbarInner<T>(
  { style, onScroll, onContentSizeChange, ...rest }: FlatListProps<T>,
  ref: React.ForwardedRef<FlatList<T>>,
) {
  const { setListHeight, setContentHeight, thumbHeight, thumbTop, handleScroll } =
    useScrollbarState();

  return (
    <View
      style={[{ flex: 1 }, style as StyleProp<ViewStyle>]}
      onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}
    >
      <FlatList
        ref={ref}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          handleScroll(e);
          onScroll?.(e);
        }}
        onContentSizeChange={(w, h) => {
          setContentHeight(h);
          onContentSizeChange?.(w, h);
        }}
        style={{ flex: 1 }}
        {...rest}
      />
      <ScrollbarOverlay thumbHeight={thumbHeight} thumbTop={thumbTop} />
    </View>
  );
}

export const FlatListWithScrollbar = forwardRef(FlatListWithScrollbarInner) as <T>(
  props: FlatListProps<T> & { ref?: React.ForwardedRef<FlatList<T>> },
) => React.ReactElement | null;
