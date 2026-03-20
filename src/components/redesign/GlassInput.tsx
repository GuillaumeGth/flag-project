import React, { forwardRef, useRef, useCallback, useEffect } from 'react';
import {
  TextInput,
  TextInputProps,
  StyleSheet,
  StyleProp,
  TextStyle,
  Keyboard,
  Platform,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedRef,
  measure,
  withTiming,
  Easing,
  runOnUI,
} from 'react-native-reanimated';
import { colors, radius, typography } from '@/theme-redesign';

interface GlassInputProps extends TextInputProps {
  style?: StyleProp<TextStyle>;
  borderVariant?: 'default' | 'accent';
}

const KEYBOARD_PADDING = 16;
const SCREEN_HEIGHT = Dimensions.get('screen').height;

// Layout properties that must live on the Animated.View wrapper,
// not on the TextInput, to preserve flex/margin behavior.
const LAYOUT_KEYS = new Set([
  'flex', 'flexGrow', 'flexShrink', 'flexBasis',
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight',
  'marginHorizontal', 'marginVertical',
  'alignSelf',
]);

function splitStyles(style?: StyleProp<TextStyle>) {
  const flat = (StyleSheet.flatten(style) || {}) as Record<string, any>;
  const layout: Record<string, any> = {};
  const visual: Record<string, any> = {};

  for (const key of Object.keys(flat)) {
    if (LAYOUT_KEYS.has(key)) {
      layout[key] = flat[key];
    } else {
      visual[key] = flat[key];
    }
  }

  return { layout, visual };
}

const GlassInput = forwardRef<TextInput, GlassInputProps>(
  ({ style, borderVariant = 'default', onFocus, onBlur, ...props }, ref) => {
    const containerRef = useAnimatedRef<Animated.View>();
    const localRef = useRef<TextInput>(null);
    const isFocusedRef = useRef(false);
    const translateY = useSharedValue(0);

    // Forward ref to consumers while keeping a local ref for internal use
    const setInputRef = useCallback(
      (node: TextInput | null) => {
        localRef.current = node;
        if (!ref) return;
        if (typeof ref === 'function') ref(node);
        else (ref as React.MutableRefObject<TextInput | null>).current = node;
      },
      [ref],
    );

    const { layout: wrapperLayout, visual: inputVisual } = splitStyles(style);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateY: translateY.value }],
      zIndex: translateY.value < 0 ? 100 : 0,
    }));

    // Reset position when keyboard hides (e.g. user taps "Done" on iOS toolbar)
    useEffect(() => {
      const event = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
      const sub = Keyboard.addListener(event, () => {
        translateY.value = withTiming(0, {
          duration: 250,
          easing: Easing.out(Easing.cubic),
        });
      });
      return () => sub.remove();
    }, []);

    const handleFocus = useCallback(
      (e: any) => {
        isFocusedRef.current = true;
        onFocus?.(e);

        const kbEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const sub = Keyboard.addListener(kbEvent, (evt) => {
          sub.remove();
          if (!isFocusedRef.current) return;

          const keyboardTop = evt.endCoordinates.screenY;
          const animDuration = Platform.OS === 'ios' ? (evt.duration || 250) : 250;

          // Measure on UI thread via Reanimated, then animate if occluded
          runOnUI(() => {
            'worklet';
            const measured = measure(containerRef);
            if (!measured) return;

            const inputBottom = measured.pageY + measured.height;
            const overlap = inputBottom - keyboardTop + KEYBOARD_PADDING;

            if (overlap > 0) {
              translateY.value = withTiming(-overlap, {
                duration: animDuration,
                easing: Easing.out(Easing.cubic),
              });
            }
          })();
        });

        // Safety: remove listener if keyboard never shows (hardware keyboard)
        setTimeout(() => sub.remove(), 1000);
      },
      [onFocus],
    );

    const handleBlur = useCallback(
      (e: any) => {
        isFocusedRef.current = false;
        onBlur?.(e);

        translateY.value = withTiming(0, {
          duration: 250,
          easing: Easing.out(Easing.cubic),
        });
      },
      [onBlur],
    );

    return (
      <Animated.View
        ref={containerRef}
        style={[wrapperLayout, animatedStyle]}
        collapsable={false}
      >
        <TextInput
          ref={setInputRef}
          placeholderTextColor={colors.text.tertiary}
          style={[
            styles.base,
            borderVariant === 'accent' && styles.borderAccent,
            inputVisual,
          ]}
          onFocus={handleFocus}
          onBlur={handleBlur}
          {...props}
        />
      </Animated.View>
    );
  },
);

GlassInput.displayName = 'GlassInput';

export default GlassInput;

const styles = StyleSheet.create({
  base: {
    fontSize: typography.sizes.md,
    color: colors.text.primary,
    backgroundColor: colors.surface.glass,
    borderWidth: 1,
    borderColor: colors.border.default,
    borderRadius: radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  borderAccent: {
    borderColor: colors.border.accent,
  },
});
