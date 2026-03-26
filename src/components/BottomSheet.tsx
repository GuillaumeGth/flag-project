import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Pressable,
  Animated,
  StyleSheet,
  Dimensions,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { colors, radius, spacing } from '@/theme-redesign';

const SCREEN_HEIGHT = Dimensions.get('window').height;

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Max height as percentage string (e.g. '60%') or number. Default '60%'. */
  maxHeight?: ViewStyle['maxHeight'];
  /** Fixed height instead of maxHeight */
  height?: ViewStyle['height'];
  /** Custom style for the sheet container */
  sheetStyle?: StyleProp<ViewStyle>;
  /** Hide the default handle bar. Default false. */
  hideHandle?: boolean;
}

export default function BottomSheet({
  visible,
  onClose,
  children,
  maxHeight = '60%',
  height,
  sheetStyle,
  hideHandle = false,
}: BottomSheetProps) {
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const [rendered, setRendered] = useState(visible);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 20,
        stiffness: 200,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: SCREEN_HEIGHT,
        duration: 280,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setRendered(false);
      });
    }
  }, [visible]);

  if (!rendered) return null;

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheetContainer} pointerEvents="box-none">
        <Animated.View style={[styles.sheet, height ? { height } : { maxHeight }, sheetStyle, { transform: [{ translateY }] }]}>
          {!hideHandle && <View style={styles.handle} />}
          {children}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    elevation: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheetContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background.secondary ?? colors.background.primary,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surface.glass,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
});
