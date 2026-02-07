import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Image, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { Task, TaskProof } from '../../types/database';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, currentProject } = useApp();
  const { colors, priorities, statusColors } = useTheme();
  const [task, setTask] = useState<Task | null>(null);
  const [proofs, setProofs] = useState<TaskProof[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchTask(); fetchProofs(); }, [id]);

  const fetchTask = async () => { const { data } = await supabase.from('tasks').select('*').eq('id', id).single(); setTask(data); setLoading(false); };
  const fetchProofs = async () => { const { data } = await supabase.from('task_proofs').select('*').eq('task_id', id).order('created_at', { ascending: false }); setProofs(data || []); };

  const handleStatusChange = async (newStatus: string) => {
    if (!task) return;
    const updates: any = { status: newStatus };
    if (newStatus === 'completed') updates.completed_at = new Date().toISOString();
    const { error } = await supabase.from('tasks').update(updates).eq('id', task.id);
    if (!error && user && currentProject) {
      const actionMap: Record<string, string> = { in_progress: 'task_started', completed: 'task_completed' };
      if (actionMap[newStatus]) await supabase.from('activity_feed').insert({ project_id: currentProject.id, user_id: user.id, action: actionMap[newStatus], task_id: task.id });
      fetchTask();
    }
    if (error) Alert.alert('Error', error.message);
  };

  const handleComplete = () => {
    if (proofs.length === 0) { Alert.alert('Proof Required', 'Please submit at least one proof photo before completing this task. Use the Capture tab.', [{ text: 'OK' }]); return; }
    Alert.alert('Complete Task', 'Mark this task as completed?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Complete', onPress: () => handleStatusChange('completed') }]);
  };

  if (loading || !task) return <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}><Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading...</Text></SafeAreaView>;

  const priority = priorities[task.priority as keyof typeof priorities] || priorities.medium;
  const status = statusColors[task.status as keyof typeof statusColors] || statusColors.pending;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}> Back</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: priority.bg }]}><Text style={[styles.badgeText, { color: priority.color }]}>{priority.label} Priority</Text></View>
          <View style={[styles.badge, { backgroundColor: status.bg }]}><Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text></View>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{task.title}</Text>
        {task.location && (
          <View style={styles.locationRow}><Ionicons name="location-outline" size={16} color={colors.textLight} /><Text style={[styles.location, { color: colors.textLight }]}> {task.location}</Text></View>
        )}
        {task.description && <View style={styles.section}><Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Description</Text><Text style={[styles.description, { color: colors.text }]}>{task.description}</Text></View>}
        {task.due_date && <View style={styles.section}><Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Due Date</Text><Text style={[styles.meta, { color: colors.text }]}>{new Date(task.due_date).toLocaleDateString()}</Text></View>}
        {task.blocked_reason && (
          <View style={[styles.section, styles.blockedSection]}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Blocked Reason</Text>
            <Text style={[styles.blockedReason, { color: colors.error }]}>{task.blocked_reason}</Text>
          </View>
        )}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Proof ({proofs.length} {proofs.length === 1 ? 'submission' : 'submissions'})</Text>
          {proofs.length === 0 ? <Text style={[styles.noProofs, { color: colors.textMuted }]}>No proof submitted yet</Text> : proofs.map((proof) => (
            <View key={proof.id} style={[styles.proofCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {proof.photo_url && <Image source={{ uri: proof.photo_url }} style={styles.proofPhoto} resizeMode="cover" />}
              {proof.transcript && (
                <View style={styles.transcriptRow}><Ionicons name="mic-outline" size={14} color={colors.textLight} /><Text style={[styles.proofTranscript, { color: colors.text }]}> {proof.transcript}</Text></View>
              )}
              <Text style={[styles.proofDate, { color: colors.textMuted }]}>{new Date(proof.created_at || '').toLocaleString()}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
      {task.status !== 'completed' && (
        <View style={[styles.actionBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          {task.status === 'pending' && (
            <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.primary }]} onPress={() => handleStatusChange('in_progress')}>
              <Text style={[styles.secondaryButtonText, { color: colors.primary }]}>Start Task</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.completeButton, { backgroundColor: colors.success }]} onPress={handleComplete}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
            <Text style={styles.completeButtonText}> Complete Task</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 17, fontWeight: '600' },
  scrollContent: { padding: 20, paddingBottom: 100 },
  badges: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  badgeText: { fontSize: 13, fontWeight: '700' },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  location: { fontSize: 16 },
  section: { marginTop: 24 },
  sectionLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  description: { fontSize: 16, lineHeight: 24 },
  meta: { fontSize: 16 },
  blockedSection: { backgroundColor: 'rgba(229,57,53,0.1)', borderRadius: 12, padding: 16 },
  blockedReason: { fontSize: 16, lineHeight: 22 },
  noProofs: { fontSize: 15, fontStyle: 'italic' },
  proofCard: { borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1 },
  proofPhoto: { width: '100%', height: 200, borderRadius: 8, marginBottom: 8 },
  transcriptRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  proofTranscript: { fontSize: 14, lineHeight: 20, flex: 1 },
  proofDate: { fontSize: 12 },
  loadingText: { fontSize: 16, textAlign: 'center', marginTop: 100 },
  actionBar: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, padding: 16, paddingBottom: 32, flexDirection: 'row', gap: 12 },
  secondaryButton: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 2, alignItems: 'center' },
  secondaryButtonText: { fontSize: 16, fontWeight: '700' },
  completeButton: { flex: 2, padding: 16, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  completeButtonText: { fontSize: 16, color: '#FFFFFF', fontWeight: '700' },
});
