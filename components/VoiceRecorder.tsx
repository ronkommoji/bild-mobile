import React, { useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioRecorder, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import { transcribeAudio } from '../lib/gemini';
import { useTheme } from '../context/ThemeContext';

/** Normalize URI for file-system APIs (iOS may return path without file://). */
function normalizeUri(uri: string): string {
  if (uri.startsWith('file://')) return uri;
  return uri.startsWith('/') ? `file://${uri}` : `file:///${uri}`;
}

/** If the recording file appears at recorderUri, copy to a stable path; otherwise return null. */
async function tryCopyRecordingToStablePath(recorderUri: string): Promise<string | null> {
  const uri = normalizeUri(recorderUri);
  const docDir = FileSystem.documentDirectory;
  if (!docDir) return null;
  const maxWaitMs = 4000;
  const intervalMs = 200;
  for (let elapsed = 0; elapsed < maxWaitMs; elapsed += intervalMs) {
    try {
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && !info.isDirectory) {
        const destUri = `${docDir}recording-${Date.now()}.m4a`;
        await FileSystem.copyAsync({ from: uri, to: destUri });
        return destUri;
      }
    } catch {
      // getInfoAsync can fail on some paths; keep retrying
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return null;
}

interface VoiceRecorderProps {
  onTranscriptionComplete: (transcript: string, audioUri?: string) => void;
  showTranscript?: boolean;
  /** Hint text shown below the Record button */
  hintText?: string;
}

export default function VoiceRecorder({ onTranscriptionComplete, showTranscript = true, hintText }: VoiceRecorderProps) {
  const { colors } = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) return;
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      setDuration(0); setTranscript(''); setAudioUri(null);
      // Required on iOS: prepare creates the output file; without it the file never exists at recorder.uri
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
      intervalRef.current = setInterval(() => { setDuration((d) => d + 1); }, 1000);
    } catch (err) { console.error('Failed to start recording:', err); }
  }, [recorder]);

  const stopRecording = useCallback(async () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    setIsRecording(false);
    await recorder.stop();
    const rawUri = recorder.uri;
    if (rawUri) {
      setTranscribing(true);
      try {
        // Give native time to flush the file, then try copy to stable path or use raw URI
        await new Promise((r) => setTimeout(r, 400));
        const stableUri = await tryCopyRecordingToStablePath(rawUri);
        const uriToUse = stableUri ?? normalizeUri(rawUri);
        setAudioUri(stableUri ?? rawUri);
        const text = await transcribeAudio(uriToUse);
        setTranscript(text);
      } catch (e) {
        console.error('Failed to process recording:', e);
      } finally {
        setTranscribing(false);
      }
    }
  }, [recorder]);

  const handleSubmit = () => { onTranscriptionComplete(transcript, audioUri || undefined); };

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <View style={styles.container}>
      <View style={styles.recorderArea}>
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={[styles.recordingDot, { backgroundColor: colors.error }]} />
            <Text style={[styles.recordingTime, { color: colors.text }]}>{formatDuration(duration)}</Text>
          </View>
        )}
        <TouchableOpacity
          style={[styles.recordButton, { backgroundColor: colors.primary }, isRecording && { backgroundColor: colors.error }]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Ionicons name={isRecording ? 'stop' : 'mic'} size={36} color="#FFFFFF" />
          <Text style={styles.recordButtonText}>{isRecording ? 'Stop' : 'Record'}</Text>
        </TouchableOpacity>
        {hintText ? (
          <Text style={[styles.hintText, { color: colors.textMuted }]}>{hintText}</Text>
        ) : null}
      </View>
      {transcribing && (
        <View style={styles.transcribingContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.transcribingText, { color: colors.textMuted }]}>Transcribing...</Text>
        </View>
      )}
      {showTranscript && transcript ? (
        <View style={[styles.transcriptContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.transcriptLabel, { color: colors.textMuted }]}>Transcript</Text>
          <Text style={[styles.transcriptText, { color: colors.text }]}>{transcript}</Text>
        </View>
      ) : null}
      {(transcript || audioUri) && !transcribing && (
        <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Submit</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  recorderArea: { alignItems: 'center', gap: 16 },
  hintText: { fontSize: 15, textAlign: 'center', marginTop: 8, paddingHorizontal: 24 },
  recordingIndicator: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot: { width: 12, height: 12, borderRadius: 6 },
  recordingTime: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  recordButton: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6 },
  recordButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600', marginTop: 4 },
  transcribingContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 24 },
  transcribingText: { fontSize: 15 },
  transcriptContainer: { width: '100%', marginTop: 24, borderRadius: 12, padding: 16, borderWidth: 1 },
  transcriptLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8 },
  transcriptText: { fontSize: 15, lineHeight: 22 },
  submitButton: { marginTop: 24, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 48 },
  submitButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
});
