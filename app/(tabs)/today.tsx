import React, { useState } from 'react';
import {
  View, Text, FlatList, SectionList, StyleSheet, RefreshControl, TouchableOpacity,
  Alert, Modal, SafeAreaView, TextInput, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { useTasks } from '../../hooks/useTasks';
import { supabase } from '../../lib/supabase';
import TaskCard from '../../components/TaskCard';
import ProjectSwitcher from '../../components/ProjectSwitcher';
import VoiceRecorder from '../../components/VoiceRecorder';

const PRIORITY_OPTIONS = ['high', 'medium', 'low'] as const;

export default function TodayScreen() {
  const router = useRouter();
  const { user, currentProject, members } = useApp();
  const { colors } = useTheme();
  const { tasks, activeTasks, completedTasks, loading, updateTaskStatus, refreshTasks } = useTasks(currentProject?.id, user?.id);
  const [blockingTaskId, setBlockingTaskId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Task creation state
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newAssignee, setNewAssignee] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [completedSectionOpen, setCompletedSectionOpen] = useState(false);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const onRefresh = async () => { setRefreshing(true); await refreshTasks(); setRefreshing(false); };
  const handleSwipeRight = (taskId: string) => { updateTaskStatus(taskId, 'in_progress'); };
  const handleSwipeLeft = (taskId: string) => { setBlockingTaskId(taskId); };
  const handleBlockedSubmit = async (transcript: string) => {
    if (blockingTaskId) {
      await updateTaskStatus(blockingTaskId, 'blocked', transcript || 'No reason provided');
      setBlockingTaskId(null);
    }
  };
  const handleMarkComplete = (taskId: string) => { updateTaskStatus(taskId, 'completed'); };
  const handleMarkIncomplete = (taskId: string) => { updateTaskStatus(taskId, 'pending'); };

  const handleCreateTask = async () => {
    if (!newTitle.trim()) { Alert.alert('Error', 'Task title is required.'); return; }
    if (!currentProject || !user) return;
    setCreating(true);
    const todayDate = new Date().toISOString().split('T')[0];
    const { error } = await supabase.from('tasks').insert({
      project_id: currentProject.id,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      location: newLocation.trim() || null,
      priority: newPriority,
      assigned_to: newAssignee || user.id,
      due_date: todayDate,
      created_by: user.id,
    });
    setCreating(false);
    if (error) { Alert.alert('Error', error.message); }
    else {
      setNewTitle(''); setNewDescription(''); setNewLocation(''); setNewPriority('medium'); setNewAssignee(null);
      setShowCreate(false); refreshTasks();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <ProjectSwitcher />
        <TouchableOpacity style={[styles.profileButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => router.push('/profile')}>
          <Ionicons name="person-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.dateContainer}>
        <Text style={[styles.dateText, { color: colors.text }]}>{today}</Text>
        {currentProject && <Text style={[styles.projectLabel, { color: colors.textLight }]}>{currentProject.name}</Text>}
      </View>

      {!currentProject ? (
        <View style={styles.emptyState}>
          <Ionicons name="business-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Project Selected</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Tap the project switcher above to create or select a project</Text>
        </View>
      ) : activeTasks.length === 0 && completedTasks.length === 0 && !loading ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={48} color={colors.success} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>All Clear!</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>No tasks for today. Tap + to add one.</Text>
        </View>
      ) : (
        <SectionList
          sections={[
            { title: 'To do', data: activeTasks },
            ...(completedTasks.length > 0 ? [{ title: 'Completed', data: completedSectionOpen ? completedTasks : [], count: completedTasks.length }] : []),
          ]}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderSectionHeader={({ section }) => {
            const isCompleted = section.title === 'Completed';
            const count = (section as { count?: number }).count ?? section.data.length;
            const header = (
              <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
                <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{section.title}</Text>
                <View style={styles.sectionHeaderRight}>
                  <Text style={[styles.sectionCount, { color: colors.textMuted }]}>{count}</Text>
                  {isCompleted && (
                    <Ionicons name={completedSectionOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} style={styles.sectionChevron} />
                  )}
                </View>
              </View>
            );
            if (isCompleted) {
              return (
                <TouchableOpacity onPress={() => setCompletedSectionOpen((o) => !o)} activeOpacity={0.7}>
                  {header}
                </TouchableOpacity>
              );
            }
            return header;
          }}
          renderItem={({ item, section, index }) => (
            <View style={index === 0 ? styles.firstTaskSpacer : undefined}>
              <TaskCard
                task={item}
                onPress={() => router.push(`/task/${item.id}`)}
                onSwipeRight={() => handleSwipeRight(item.id)}
                onSwipeLeft={() => handleSwipeLeft(item.id)}
                onMarkComplete={section.title === 'To do' ? () => handleMarkComplete(item.id) : undefined}
                onMarkIncomplete={section.title === 'Completed' ? () => handleMarkIncomplete(item.id) : undefined}
              />
            </View>
          )}
        />
      )}

      {/* FAB to add task */}
      {currentProject && (
        <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Blocked reason modal */}
      <Modal visible={blockingTaskId !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBlockingTaskId(null)}>
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={styles.modalHeaderCreate}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Why is this blocked?</Text>
            <TouchableOpacity onPress={() => setBlockingTaskId(null)}>
              <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>Record a voice note explaining the blocker</Text>
          <VoiceRecorder onTranscriptionComplete={(transcript) => handleBlockedSubmit(transcript)} />
        </View>
      </Modal>

      {/* Create task modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={0}>
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <View style={styles.modalHeaderCreate}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>New Task</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.createForm} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={[styles.fieldLabel, { color: colors.text, marginTop: 0 }]}>Title *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={newTitle} onChangeText={setNewTitle} placeholder="What needs to be done?" placeholderTextColor={colors.textMuted}
            />
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.inputMulti, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={newDescription} onChangeText={setNewDescription} placeholder="Optional details..." placeholderTextColor={colors.textMuted}
              multiline numberOfLines={3}
            />
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Location</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
              value={newLocation} onChangeText={setNewLocation} placeholder="Room / area" placeholderTextColor={colors.textMuted}
            />
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Priority</Text>
            <View style={styles.priorityRow}>
              {PRIORITY_OPTIONS.map((p) => (
                <TouchableOpacity key={p}
                  style={[styles.priorityChip, { borderColor: colors.border, backgroundColor: colors.surface }, newPriority === p && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setNewPriority(p)}
                >
                  <Text style={[styles.priorityChipText, { color: colors.text }, newPriority === p && { color: '#FFFFFF' }]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.fieldLabel, { color: colors.text }]}>Assign to</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assigneeRow}>
              <TouchableOpacity
                style={[styles.assigneeChip, { borderColor: colors.border, backgroundColor: colors.surface }, newAssignee === null && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setNewAssignee(null)}
              >
                <Text style={[styles.assigneeText, { color: colors.text }, newAssignee === null && { color: '#FFFFFF' }]}>Me</Text>
              </TouchableOpacity>
              {members.filter((m) => m.user_id !== user?.id).map((m) => (
                <TouchableOpacity key={m.user_id}
                  style={[styles.assigneeChip, { borderColor: colors.border, backgroundColor: colors.surface }, newAssignee === m.user_id && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => setNewAssignee(m.user_id)}
                >
                  <Text style={[styles.assigneeText, { color: colors.text }, newAssignee === m.user_id && { color: '#FFFFFF' }]}>
                    {(m as any).profile?.full_name || 'Member'}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: colors.primary }, creating && { opacity: 0.7 }]}
              onPress={handleCreateTask} disabled={creating}
            >
              <Text style={styles.createButtonText}>{creating ? 'Creating...' : 'Create Task'}</Text>
            </TouchableOpacity>
          </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  profileButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
  dateContainer: { paddingHorizontal: 20, paddingVertical: 12 },
  dateText: { fontSize: 22, fontWeight: '700' },
  projectLabel: { fontSize: 14, marginTop: 2 },
  listContent: { paddingBottom: 100 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, paddingTop: 16, paddingBottom: 20, borderBottomWidth: 1 },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionCount: { fontSize: 13, fontWeight: '600' },
  sectionChevron: { marginLeft: 2 },
  firstTaskSpacer: { marginTop: 20 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  modalContainer: { flex: 1, paddingHorizontal: 20 },
  modalHandle: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  modalHeaderCreate: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '700' },
  cancelText: { fontSize: 17, fontWeight: '600' },
  modalSubtitle: { fontSize: 15, marginBottom: 24 },
  createForm: { paddingBottom: 60 },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 20 },
  input: { borderWidth: 1, borderRadius: 12, padding: 16, fontSize: 16 },
  inputMulti: { minHeight: 90, textAlignVertical: 'top', paddingTop: 14 },
  priorityRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  priorityChip: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  priorityChipText: { fontSize: 15, fontWeight: '600' },
  assigneeRow: { gap: 10, paddingVertical: 6 },
  assigneeChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  assigneeText: { fontSize: 14, fontWeight: '500' },
  createButton: { marginTop: 36, borderRadius: 14, padding: 18, alignItems: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  createButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
});
