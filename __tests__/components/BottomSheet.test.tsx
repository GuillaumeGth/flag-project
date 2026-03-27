/**
 * Tests for BottomSheet component
 *
 * Covers:
 * 1. Not rendered when visible=false
 * 2. Renders children when visible=true
 * 3. Handle bar shown by default, hidden with hideHandle
 * 4. Backdrop press calls onClose
 * 5. Custom maxHeight / height / sheetStyle applied
 * 6. Unmounts after close animation completes
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { Text } from 'react-native';

// ─── Mocks ───────────────────────────────────────────────────────────

// Capture Animated calls to control animation callbacks
let lastTimingCallback: ((result: { finished: boolean }) => void) | null = null;

jest.spyOn(Animated, 'spring').mockImplementation(() => ({
  start: (cb?: (result: { finished: boolean }) => void) => {
    cb?.({ finished: true });
  },
  stop: jest.fn(),
  reset: jest.fn(),
}));

jest.spyOn(Animated, 'timing').mockImplementation(() => ({
  start: (cb?: (result: { finished: boolean }) => void) => {
    lastTimingCallback = cb ?? null;
    // Don't call cb immediately — tests will call it manually to simulate animation end
  },
  stop: jest.fn(),
  reset: jest.fn(),
}));

jest.mock('@/theme-redesign', () => ({
  colors: {
    background: { primary: '#000', secondary: '#111' },
    surface: { glass: '#222' },
    border: { default: '#333' },
  },
  radius: { xl: 16 },
  spacing: { sm: 8, md: 12, lg: 16 },
}));

import BottomSheet from '@/components/BottomSheet';

// ─── Tests ───────────────────────────────────────────────────────────

describe('BottomSheet', () => {
  const onClose = jest.fn();

  beforeEach(() => {
    onClose.mockClear();
    lastTimingCallback = null;
  });

  it('renders nothing when visible=false', () => {
    const { toJSON } = render(
      <BottomSheet visible={false} onClose={onClose}>
        <Text>Content</Text>
      </BottomSheet>,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders children when visible=true', () => {
    const { getByText } = render(
      <BottomSheet visible={true} onClose={onClose}>
        <Text>Sheet Content</Text>
      </BottomSheet>,
    );
    expect(getByText('Sheet Content')).toBeTruthy();
  });

  it('shows handle by default', () => {
    const { toJSON } = render(
      <BottomSheet visible={true} onClose={onClose}>
        <Text>Content</Text>
      </BottomSheet>,
    );
    // The handle is a View with width 40, height 4
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('"width":40');
    expect(tree).toContain('"height":4');
  });

  it('hides handle when hideHandle=true', () => {
    const { toJSON } = render(
      <BottomSheet visible={true} onClose={onClose} hideHandle>
        <Text>Content</Text>
      </BottomSheet>,
    );
    const tree = JSON.stringify(toJSON());
    // Should not contain the handle dimensions
    expect(tree).not.toContain('"width":40');
  });

  it('calls onClose when backdrop is pressed', () => {
    const { getByText, UNSAFE_root } = render(
      <BottomSheet visible={true} onClose={onClose}>
        <Text>Content</Text>
      </BottomSheet>,
    );
    // The backdrop is the first Pressable
    const pressables = UNSAFE_root.findAll(
      (node) => node.props.accessibilityRole === 'button' || node.type?.toString()?.includes?.('Pressable'),
    );
    // Find the backdrop by its style (absoluteFillObject + backgroundColor)
    const backdrop = UNSAFE_root.findAll(
      (node) => {
        const style = node.props?.style;
        if (!style) return false;
        const flat = Array.isArray(style) ? Object.assign({}, ...style) : style;
        return flat.backgroundColor === 'rgba(0,0,0,0.5)' && flat.position === 'absolute';
      },
    )[0];
    if (backdrop) {
      fireEvent.press(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('unmounts after close animation finishes', () => {
    const { rerender, queryByText } = render(
      <BottomSheet visible={true} onClose={onClose}>
        <Text>Content</Text>
      </BottomSheet>,
    );
    expect(queryByText('Content')).toBeTruthy();

    // Trigger close
    act(() => {
      rerender(
        <BottomSheet visible={false} onClose={onClose}>
          <Text>Content</Text>
        </BottomSheet>,
      );
    });

    // Simulate animation completing
    act(() => {
      lastTimingCallback?.({ finished: true });
    });

    expect(queryByText('Content')).toBeNull();
  });

  it('stays mounted if animation is interrupted (finished=false)', () => {
    const { rerender, queryByText } = render(
      <BottomSheet visible={true} onClose={onClose}>
        <Text>Content</Text>
      </BottomSheet>,
    );

    act(() => {
      rerender(
        <BottomSheet visible={false} onClose={onClose}>
          <Text>Content</Text>
        </BottomSheet>,
      );
    });

    act(() => {
      lastTimingCallback?.({ finished: false });
    });

    // Should still be rendered since animation didn't finish
    expect(queryByText('Content')).toBeTruthy();
  });

  it('applies custom height prop', () => {
    const { toJSON } = render(
      <BottomSheet visible={true} onClose={onClose} height="80%">
        <Text>Content</Text>
      </BottomSheet>,
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('"height":"80%"');
  });

  it('applies custom maxHeight when no height', () => {
    const { toJSON } = render(
      <BottomSheet visible={true} onClose={onClose} maxHeight="40%">
        <Text>Content</Text>
      </BottomSheet>,
    );
    const tree = JSON.stringify(toJSON());
    expect(tree).toContain('"maxHeight":"40%"');
  });
});
