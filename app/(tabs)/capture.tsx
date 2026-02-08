import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image, ScrollView,
  Alert, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { useTasks } from '../../hooks/useTasks';
import { uploadPhoto, uploadVoiceNote } from '../../lib/storage';
import { checkProofCompleteness } from '../../lib/gemini';
import { supabase } from '../../lib/supabase';
import VoiceRecorder from '../../components/VoiceRecorder';
import { Task } from '../../types/database';

type CaptureStep = 'photos' | 'voice' | 'review' | 'complete';

export default function CaptureScreen() {
  const router = useRouter();
  const { taskId: paramTaskId } = useLocalSearchParams<{ taskId?: string }>();
  const { user, currentProject } = useApp();
  const { colors } = useTheme();
  const { updateTaskStatus } = useTasks(currentProject?.id, user?.id);
  const [step, setStep] = useState<CaptureStep>('voice');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [voiceUri, setVoiceUri] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (!paramTaskId || !currentProject) return;
    const load = async () => {
      const { data } = await supabase.from('tasks').select('*').eq('id', paramTaskId).eq('project_id', currentProject.id).single();
      if (data) {
        setSelectedTask(data as Task);
        setStep('voice');
      }
    };
    load();
  }, [paramTaskId, currentProject?.id]);

  useEffect(() => {
    if (currentProject && !paramTaskId) router.replace('/(tabs)/tasks');
  }, [currentProject, paramTaskId]);

  const goToTasksTab = () => router.replace('/(tabs)/tasks');

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
    if (photo?.uri) setPhotos((prev) => [...prev, photo.uri]);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled && result.assets[0]) setPhotos((prev) => [...prev, result.assets[0].uri]);
  };

  const removePhoto = (index: number) => setPhotos((prev) => prev.filter((_, i) => i !== index));

  const handleVoiceComplete = (text: string, uri?: string) => { setTranscript(text); setVoiceUri(uri || null); setStep('photos'); };

  const handleSubmit = async () => {
    if (!user || !selectedTask || !currentProject) return;
    if (photos.length === 0) { Alert.alert('Photo Required', 'Please take at least one photo.'); return; }
    setSubmitting(true);
    try {
      const completeness = await checkProofCompleteness(selectedTask.title, transcript, photos.length);
      if (!completeness.isComplete && completeness.suggestion) {
        const shouldContinue = await new Promise<boolean>((resolve) => {
          Alert.alert('Quick Check', completeness.suggestion, [
            { text: 'Add More', onPress: () => resolve(false) },
            { text: 'Submit Anyway', onPress: () => resolve(true) },
          ]);
        });
        if (!shouldContinue) { setSubmitting(false); return; }
      }
      const photoUrls: string[] = [];
      for (const photoUri of photos) { const url = await uploadPhoto(photoUri, user.id); if (url) photoUrls.push(url); }
      let voiceUrl: string | null = null;
      if (voiceUri) voiceUrl = await uploadVoiceNote(voiceUri, user.id);
      await supabase.from('task_proofs').insert({
        task_id: selectedTask.id,
        photo_url: photoUrls[0] || null,
        photo_urls: photoUrls,
        voice_note_url: voiceUrl,
        transcript: transcript || null,
        submitted_by: user.id,
      });
      await supabase.from('activity_feed').insert({ project_id: currentProject.id, user_id: user.id, action: 'proof_submitted', task_id: selectedTask.id, metadata: { photo_count: photoUrls.length, has_voice: !!voiceUrl } });
      await updateTaskStatus(selectedTask.id, 'completed');
      setStep('complete');
    } catch { Alert.alert('Error', 'Failed to submit proof. Please try again.'); }
    setSubmitting(false);
  };

  if (!currentProject) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Project Selected</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Select a project from the Blueprint tab first</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!paramTaskId) return null;

  if (step === 'photos') {
    if (!permission?.granted) {
      return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.centered}>
            <Ionicons name="camera" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Camera Permission</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>We need camera access to capture proof photos</Text>
            <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={requestPermission}>
              <Text style={styles.primaryButtonText}>Grant Permission</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.stepHeader, styles.photosStepHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.centeredHeaderRow}>
            <TouchableOpacity onPress={() => setStep('voice')} style={styles.navBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.stepTitle, styles.stepTitleAbsoluteCenter, { color: colors.text }]} pointerEvents="none">Photos</Text>
            <View style={styles.navBtnSpacer} />
          </View>
          <Text style={[styles.taskName, { color: colors.primary }]}>{selectedTask?.title}</Text>
        </View>
        <View style={styles.photosContentWrap}>
          <View style={styles.cameraContainer}>
            <CameraView ref={cameraRef} style={styles.camera} facing="back" onCameraReady={() => setCameraReady(true)} />
            <View style={styles.cameraControls}>
              <TouchableOpacity style={styles.galleryButton} onPress={pickImage}>
                <Ionicons name="images-outline" size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.shutterButton} onPress={takePhoto} disabled={!cameraReady}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.photoCheckButton, { backgroundColor: colors.primary }]}
                onPress={() => { if (photos.length === 0) { Alert.alert('Required', 'Add at least one photo.'); return; } setStep('review'); }}
              >
                <Ionicons name="checkmark" size={28} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
          {photos.length > 0 && (
            <ScrollView horizontal style={[styles.photoStrip, { borderTopColor: colors.border }]} contentContainerStyle={styles.photoStripContent} showsHorizontalScrollIndicator={false}>
              {photos.map((uri, index) => (
                <View key={index} style={styles.photoThumbContainer}>
                  <Image source={{ uri }} style={styles.photoThumb} />
                  <TouchableOpacity style={[styles.removePhoto, { backgroundColor: colors.error }]} onPress={() => removePhoto(index)}>
                    <Ionicons name="close" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (step === 'voice') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.stepHeader, styles.photosStepHeader, { borderBottomColor: colors.border }]}>
          <View style={styles.centeredHeaderRow}>
            <TouchableOpacity onPress={goToTasksTab} style={styles.navBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.primary} />
            </TouchableOpacity>
            <Text style={[styles.stepTitle, styles.stepTitleAbsoluteCenter, { color: colors.text }]} pointerEvents="none">Voice Note</Text>
            <TouchableOpacity onPress={() => setStep('photos')} style={styles.navBtn}>
              <Text style={[styles.navText, { color: colors.primary }]}>Skip </Text><Ionicons name="arrow-forward" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
          {selectedTask?.title ? (
            <Text style={[styles.taskName, { color: colors.primary }]} numberOfLines={2}>{selectedTask.title}</Text>
          ) : null}
        </View>
        <VoiceRecorder
          onTranscriptionComplete={handleVoiceComplete}
          hintText="Describe the work you completed"
        />
      </SafeAreaView>
    );
  }

  if (step === 'review') {
    return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.stepHeader, { borderBottomColor: colors.border }]}>
        <View style={styles.stepHeaderRow}>
          <TouchableOpacity onPress={() => setStep('photos')} style={styles.navBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.primary} />
          </TouchableOpacity>
          <Text style={[styles.stepTitle, { color: colors.text }]}>Approve</Text>
          <View style={{ width: 60 }} />
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.reviewContent}>
        <View style={styles.reviewSection}>
          <Text style={[styles.reviewLabel, { color: colors.textMuted }]}>Task</Text>
          <Text style={[styles.reviewValue, { color: colors.text }]}>{selectedTask?.title}</Text>
        </View>
        <View style={styles.reviewSection}>
          <Text style={[styles.reviewLabel, { color: colors.textMuted }]}>Photos ({photos.length})</Text>
          <ScrollView horizontal contentContainerStyle={styles.photoStripContent}>
            {photos.map((uri, i) => <Image key={i} source={{ uri }} style={styles.reviewPhoto} />)}
          </ScrollView>
        </View>
        {transcript ? (
          <View style={styles.reviewSection}>
            <Text style={[styles.reviewLabel, { color: colors.textMuted }]}>Voice Note</Text>
            <Text style={[styles.reviewTranscript, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}>{transcript}</Text>
          </View>
        ) : null}
      </ScrollView>
      <View style={[styles.submitBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary }, submitting && { opacity: 0.7 }]} onPress={handleSubmit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.submitButtonText}>Submit Proof</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    );
  }

  if (step === 'complete') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <View style={[styles.completeIconWrap, { backgroundColor: colors.success }]}>
            <Ionicons name="checkmark-circle" size={64} color="#FFFFFF" />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Task complete</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            {selectedTask?.title} has been marked complete with your photos and voice note.
          </Text>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={goToTasksTab}>
            <Text style={styles.primaryButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 15, textAlign: 'center' },
  stepHeader: { padding: 16, borderBottomWidth: 1 },
  photosStepHeader: { paddingTop: 8, paddingBottom: 8 },
  photosHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  centeredHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', position: 'relative' },
  navBtnSpacer: { minWidth: 40 },
  stepHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepTitle: { fontSize: 20, fontWeight: '700' },
  stepTitleAbsoluteCenter: { position: 'absolute', left: 0, right: 0, textAlign: 'center' },
  stepSubtitle: { fontSize: 14, marginTop: 4 },
  taskName: { fontSize: 14, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  navBtn: { flexDirection: 'row', alignItems: 'center' },
  navText: { fontSize: 16, fontWeight: '600' },
  taskList: { padding: 16 },
  taskSelectCard: { borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1 },
  taskSelectTitle: { fontSize: 17, fontWeight: '600' },
  taskSelectLocation: { fontSize: 14 },
  photosContentWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cameraContainer: { flex: 1, width: '100%', position: 'relative', alignSelf: 'center' },
  camera: { flex: 1 },
  cameraControls: { position: 'absolute', bottom: 20, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 40 },
  shutterButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#FFFFFF' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFFFFF' },
  galleryButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.3)', justifyContent: 'center', alignItems: 'center' },
  photoCheckButton: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  photoStrip: { maxHeight: 100, borderTopWidth: 1 },
  photoStripContent: { padding: 8, gap: 8 },
  photoThumbContainer: { position: 'relative' },
  photoThumb: { width: 80, height: 80, borderRadius: 8 },
  removePhoto: { position: 'absolute', top: -4, right: -4, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  primaryButton: { borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginTop: 16 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  completeIconWrap: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  reviewContent: { padding: 20 },
  reviewSection: { marginBottom: 24 },
  reviewLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  reviewValue: { fontSize: 18, fontWeight: '600' },
  reviewPhoto: { width: 120, height: 120, borderRadius: 8 },
  reviewTranscript: { fontSize: 15, padding: 12, borderRadius: 8, borderWidth: 1, lineHeight: 22, overflow: 'hidden' },
  submitBar: { padding: 16, paddingBottom: 32, borderTopWidth: 1 },
  submitButton: { borderRadius: 12, padding: 18, alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  submitButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
});
