import { useState } from 'react';
import { Audio } from 'expo-av';
import { log } from '@/utils/debug';
import { reportError } from '@/services/errorReporting';

interface UseAudioRecorderResult {
  isRecording: boolean;
  recordingUri: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string | null>;
  clearRecording: () => void;
}

export function useAudioRecorder(): UseAudioRecorderResult {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        reportError(new Error('Microphone permission denied'), 'useAudioRecorder.startRecording');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setIsRecording(true);
    } catch (error) {
      log('useAudioRecorder', 'Failed to start recording:', error);
      reportError(error, 'useAudioRecorder.startRecording');
    }
  };

  const stopRecording = async (): Promise<string | null> => {
    if (!recording) return null;

    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecording(null);

    if (uri) {
      setRecordingUri(uri);
      return uri;
    }
    return null;
  };

  const clearRecording = () => {
    setRecordingUri(null);
  };

  return { isRecording, recordingUri, startRecording, stopRecording, clearRecording };
}
