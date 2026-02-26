import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';

interface UseImagePickerResult {
  imageUri: string | null;
  pickImage: () => Promise<void>;
  clearImage: () => void;
}

export function useImagePicker(): UseImagePickerResult {
  const [imageUri, setImageUri] = useState<string | null>(null);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const clearImage = () => {
    setImageUri(null);
  };

  return { imageUri, pickImage, clearImage };
}
