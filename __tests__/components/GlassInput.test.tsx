/**
 * Tests for GlassInput component
 *
 * Covers:
 * 1. Rendering — props passthrough, ref forwarding
 * 2. Keyboard avoidance — translateY when input is occluded by keyboard
 * 3. Reset — translateY back to 0 on blur and keyboard hide
 * 4. No-op — no translation when input is above keyboard
 * 5. Edge case — measure returns null, blur before keyboard event
 * 6. onFocus / onBlur callback forwarding
 */

import React, { createRef } from 'react';
import { Keyboard, TextInput, View } from 'react-native';

// ─── Mock state (prefixed "mock" for jest.mock scope) ────────────────

let mockTranslateY = 0;
let mockMeasureResult: { pageY: number; height: number } | null = {
  pageY: 200,
  height: 50,
};

jest.mock('react-native-reanimated', () => {
  const { View: RNView } = require('react-native');
  const React = require('react');

  const AnimatedView = React.forwardRef((props: any, ref: any) =>
    React.createElement(RNView, { ...props, ref }),
  );

  return {
    __esModule: true,
    default: {
      View: AnimatedView,
      createAnimatedComponent: (Component: any) => Component,
    },
    useAnimatedRef: () => React.createRef(),
    useSharedValue: (initial: number) => {
      const sv = { value: initial };
      return new Proxy(sv, {
        set(target: any, prop, value) {
          if (prop === 'value') mockTranslateY = value;
          target[prop] = value;
          return true;
        },
      });
    },
    useAnimatedStyle: (fn: () => any) => fn(),
    withTiming: (toValue: number) => {
      mockTranslateY = toValue;
      return toValue;
    },
    Easing: {
      out: (fn: any) => fn,
      cubic: (t: number) => t,
    },
    measure: () => mockMeasureResult,
    runOnUI: (fn: () => void) => () => fn(),
  };
});

import { render, fireEvent } from '@testing-library/react-native';
import GlassInput from '@/components/redesign/GlassInput';

// ─── Keyboard mock ───────────────────────────────────────────────────

type KBCallback = (event: any) => void;
const kbListeners: Record<string, KBCallback[]> = {};

jest.spyOn(Keyboard, 'addListener').mockImplementation(
  ((event: string, callback: KBCallback) => {
    if (!kbListeners[event]) kbListeners[event] = [];
    kbListeners[event].push(callback);
    return {
      remove: () => {
        const idx = kbListeners[event]?.indexOf(callback);
        if (idx !== undefined && idx >= 0)
          kbListeners[event].splice(idx, 1);
      },
    };
  }) as any,
);

function emitKB(event: string, payload: any = {}) {
  [...(kbListeners[event] || [])].forEach((cb) => cb(payload));
}

// ─── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.useFakeTimers();
  mockTranslateY = 0;
  mockMeasureResult = { pageY: 200, height: 50 };
  Object.keys(kbListeners).forEach((k) => {
    kbListeners[k] = [];
  });
});

afterEach(() => {
  jest.useRealTimers();
});

// ─── Tests ───────────────────────────────────────────────────────────

describe('GlassInput — rendering', () => {
  it('renders and can be found by placeholder', () => {
    const { getByPlaceholderText } = render(
      <GlassInput placeholder="Hello" />,
    );
    expect(getByPlaceholderText('Hello')).toBeTruthy();
  });

  it('forwards onChangeText to the underlying TextInput', () => {
    const onChange = jest.fn();
    const { getByPlaceholderText } = render(
      <GlassInput placeholder="Type" onChangeText={onChange} />,
    );
    fireEvent.changeText(getByPlaceholderText('Type'), 'abc');
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  it('forwards ref to the underlying TextInput', () => {
    const ref = createRef<TextInput>();
    render(<GlassInput ref={ref} placeholder="ref-test" />);
    expect(ref.current).toBeTruthy();
  });
});

describe('GlassInput — keyboard avoidance', () => {
  it('translates up when keyboard occludes the input', () => {
    // Input bottom = 200 + 50 = 250, keyboard top = 220
    // Overlap = 250 − 220 + 16(padding) = 46
    mockMeasureResult = { pageY: 200, height: 50 };

    const { getByPlaceholderText } = render(
      <GlassInput placeholder="msg" />,
    );

    fireEvent(getByPlaceholderText('msg'), 'focus');
    emitKB('keyboardWillShow', {
      endCoordinates: { screenY: 220 },
      duration: 250,
    });

    expect(mockTranslateY).toBe(-46);
  });

  it('does NOT translate when input is above the keyboard', () => {
    mockMeasureResult = { pageY: 200, height: 50 };

    const { getByPlaceholderText } = render(
      <GlassInput placeholder="msg" />,
    );

    fireEvent(getByPlaceholderText('msg'), 'focus');
    emitKB('keyboardWillShow', {
      endCoordinates: { screenY: 600 },
      duration: 250,
    });

    expect(mockTranslateY).toBe(0);
  });

  it('resets translateY on blur', () => {
    mockMeasureResult = { pageY: 400, height: 50 };

    const { getByPlaceholderText } = render(
      <GlassInput placeholder="msg" />,
    );
    const input = getByPlaceholderText('msg');

    fireEvent(input, 'focus');
    emitKB('keyboardWillShow', {
      endCoordinates: { screenY: 420 },
      duration: 250,
    });
    expect(mockTranslateY).toBeLessThan(0);

    fireEvent(input, 'blur');
    expect(mockTranslateY).toBe(0);
  });

  it('resets translateY when keyboard hides', () => {
    mockMeasureResult = { pageY: 400, height: 50 };

    const { getByPlaceholderText } = render(
      <GlassInput placeholder="msg" />,
    );
    const input = getByPlaceholderText('msg');

    fireEvent(input, 'focus');
    emitKB('keyboardWillShow', {
      endCoordinates: { screenY: 420 },
      duration: 250,
    });
    expect(mockTranslateY).toBeLessThan(0);

    emitKB('keyboardWillHide');
    expect(mockTranslateY).toBe(0);
  });

  it('does not translate when measure returns null', () => {
    mockMeasureResult = null;

    const { getByPlaceholderText } = render(
      <GlassInput placeholder="msg" />,
    );

    fireEvent(getByPlaceholderText('msg'), 'focus');
    emitKB('keyboardWillShow', {
      endCoordinates: { screenY: 100 },
      duration: 250,
    });

    expect(mockTranslateY).toBe(0);
  });

  it('ignores keyboard event arriving after blur', () => {
    mockMeasureResult = { pageY: 400, height: 50 };

    const { getByPlaceholderText } = render(
      <GlassInput placeholder="msg" />,
    );
    const input = getByPlaceholderText('msg');

    fireEvent(input, 'focus');
    fireEvent(input, 'blur');

    // Late keyboard event — isFocusedRef is false, should be ignored
    emitKB('keyboardWillShow', {
      endCoordinates: { screenY: 420 },
      duration: 250,
    });

    expect(mockTranslateY).toBe(0);
  });
});

describe('GlassInput — callback forwarding', () => {
  it('calls onFocus prop when focused', () => {
    const onFocus = jest.fn();
    const { getByPlaceholderText } = render(
      <GlassInput placeholder="msg" onFocus={onFocus} />,
    );
    fireEvent(getByPlaceholderText('msg'), 'focus');
    expect(onFocus).toHaveBeenCalledTimes(1);
  });

  it('calls onBlur prop when blurred', () => {
    const onBlur = jest.fn();
    const { getByPlaceholderText } = render(
      <GlassInput placeholder="msg" onBlur={onBlur} />,
    );
    const input = getByPlaceholderText('msg');
    fireEvent(input, 'focus');
    fireEvent(input, 'blur');
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
