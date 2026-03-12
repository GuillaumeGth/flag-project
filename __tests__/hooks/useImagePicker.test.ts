/**
 * Tests for useImagePicker hook
 *
 * Covers:
 * 1. Initial state — imageUri is null
 * 2. pickImage — sets imageUri on success
 * 3. pickImage — does nothing when user cancels
 * 4. clearImage — resets imageUri to null
 */

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
}));

import { renderHook, act } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
import { useImagePicker } from '@/hooks/useImagePicker';

const mockLaunch = ImagePicker.launchImageLibraryAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useImagePicker', () => {
  it('starts with imageUri = null', () => {
    const { result } = renderHook(() => useImagePicker());
    expect(result.current.imageUri).toBeNull();
  });

  it('sets imageUri when user picks an image', async () => {
    mockLaunch.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/photo.jpg' }],
    });

    const { result } = renderHook(() => useImagePicker());

    await act(async () => {
      await result.current.pickImage();
    });

    expect(result.current.imageUri).toBe('file:///tmp/photo.jpg');
  });

  it('does not update imageUri when user cancels', async () => {
    mockLaunch.mockResolvedValue({ canceled: true, assets: [] });

    const { result } = renderHook(() => useImagePicker());

    await act(async () => {
      await result.current.pickImage();
    });

    expect(result.current.imageUri).toBeNull();
  });

  it('clears imageUri after clearImage is called', async () => {
    mockLaunch.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///tmp/photo.jpg' }],
    });

    const { result } = renderHook(() => useImagePicker());

    await act(async () => {
      await result.current.pickImage();
    });
    expect(result.current.imageUri).not.toBeNull();

    act(() => {
      result.current.clearImage();
    });
    expect(result.current.imageUri).toBeNull();
  });

  it('passes the correct options to launchImageLibraryAsync', async () => {
    mockLaunch.mockResolvedValue({ canceled: true, assets: [] });
    const { result } = renderHook(() => useImagePicker());

    await act(async () => {
      await result.current.pickImage();
    });

    expect(mockLaunch).toHaveBeenCalledWith({
      mediaTypes: ['images'],
      quality: 0.8,
    });
  });
});
