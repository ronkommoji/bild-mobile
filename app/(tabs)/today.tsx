import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  SafeAreaView,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { useTasks } from '../../hooks/useTasks';
import { useBlueprint } from '../../hooks/useBlueprint';
import { supabase } from '../../lib/supabase';
import TaskCard from '../../components/TaskCard';
import BlueprintView from '../../components/BlueprintView';
import TasksBottomSheet from '../../components/TasksBottomSheet';
import ProjectSwitcher from '../../components/ProjectSwitcher';
import { Task } from '../../types/database';

const PRIORITY_OPTIONS = ['high', 'medium', 'low'] as const;

function sortByPriority(tasks: Task[]) {
  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return [...tasks].sort(
    (a, b) => (order[a.priority || 'medium'] ?? 1) - (order[b.priority || 'medium'] ?? 1)
  );
}

export default function BlueprintScreen() {
  const router = useRouter();
  const { user, currentProject, members } = useApp();
  const { colors } = useTheme();
  const { activeTasks, proofCountByTaskId, loading, updateTaskStatus, refreshTasks } = useTasks(currentProject?.id, user?.id);
  const { blueprintImageUrl, rooms, pins, tasks: blueprintTasks, loading: blueprintLoading, refresh: refreshBlueprint } = useBlueprint(currentProject?.id);

  const [refreshing, setRefreshing] = useState(false);
  const [selectedRoomFilter, setSelectedRoomFilter] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [newAssignee, setNewAssignee] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const activeTasksFilteredByRoom = selectedRoomFilter
    ? activeTasks.filter((t) => (t.location || '').toLowerCase() === selectedRoomFilter.toLowerCase())
    : activeTasks;
  const activeTasksSorted = sortByPriority(activeTasksFilteredByRoom);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshTasks(), refreshBlueprint()]);
    setRefreshing(false);
  };

  const handleMarkComplete = (taskId: string) => updateTaskStatus(taskId, 'completed');
  const handleStartCompletionFlow = (taskId: string) => {
    router.push({ pathname: '/(tabs)/capture', params: { taskId } });
  };

  const handleCreateTask = async () => {
    if (!newTitle.trim()) {
      Alert.alert('Error', 'Task title is required.');
      return;
    }
    if (!currentProject || !user) return;
    setCreating(true);
    const { error } = await supabase.from('tasks').insert({
      project_id: currentProject.id,
      title: newTitle.trim(),
      description: newDescription.trim() || null,
      location: newLocation.trim() || null,
      priority: newPriority,
      assigned_to: newAssignee || user.id,
      created_by: user.id,
    });
    setCreating(false);
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setNewTitle('');
      setNewDescription('');
      setNewLocation('');
      setNewPriority('medium');
      setNewAssignee(null);
      setShowCreate(false);
      refreshTasks();
      refreshBlueprint();
    }
  };

  if (!currentProject) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <ProjectSwitcher />
          <TouchableOpacity
            style={[styles.profileButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/profile')}
          >
            <Ionicons name="person-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.emptyState}>
          <Ionicons name="business-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Project Selected</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Tap the project switcher above to create or select a project
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <ProjectSwitcher />
        <TouchableOpacity
          style={[styles.profileButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push('/profile')}
        >
          <Ionicons name="person-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.blueprintWrap}>
        <BlueprintView
          imageUrl={blueprintImageUrl}
          rooms={rooms}
          pins={pins}
          tasks={blueprintTasks}
          loading={blueprintLoading}
          onPinPress={(taskId) => router.push(`/task/${taskId}`)}
          onRoomPress={(roomName) => setSelectedRoomFilter(roomName)}
        />
      </View>

      {/* Bottom sheet: filter by room when a room is tapped on blueprint */}
      <TasksBottomSheet
        activeCount={activeTasksFilteredByRoom.length}
        sheetBackgroundColor={colors.background}
        textColor={colors.text}
        subtextColor={colors.textMuted}
        borderColor={colors.border}
        handleColor={colors.border}
      >
        {activeTasksFilteredByRoom.length === 0 ? (
          <View style={styles.emptyModal}>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              {selectedRoomFilter ? `No tasks in ${selectedRoomFilter}` : 'No active tasks'}
            </Text>
            {selectedRoomFilter ? (
              <TouchableOpacity
                style={[styles.clearRoomFilterBtn, { borderColor: colors.primary }]}
                onPress={() => setSelectedRoomFilter(null)}
              >
                <Text style={[styles.clearRoomFilterText, { color: colors.primary }]}>Show all tasks</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : (
          <>
            {selectedRoomFilter ? (
              <View style={[styles.roomFilterBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <Text style={[styles.roomFilterLabel, { color: colors.textMuted }]}>Room: {selectedRoomFilter}</Text>
                <TouchableOpacity onPress={() => setSelectedRoomFilter(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Text style={[styles.clearRoomFilterText, { color: colors.primary }]}>Clear</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <FlatList
              data={activeTasksSorted}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.taskListContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            }
            renderItem={({ item }) => (
              <View style={styles.taskCardWrap}>
                <TaskCard
                  task={item}
                  proofCount={proofCountByTaskId[item.id] ?? 0}
                  onPress={() => router.push(`/task/${item.id}`)}
                  onMarkComplete={() => handleMarkComplete(item.id)}
                  onStartCompletionFlow={() => handleStartCompletionFlow(item.id)}
                />
              </View>
            )}
          />
          </>
        )}
      </TasksBottomSheet>

      {/* Create task modal */}
      <Modal
        visible={showCreate}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowCreate(false)}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <View style={styles.modalHeaderCreate}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>New Task</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Text style={[styles.cancelText, { color: colors.primary }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={styles.createForm}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={[styles.fieldLabel, { color: colors.text, marginTop: 0 }]}>Title *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="What needs to be done?"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Description</Text>
              <TextInput
                style={[styles.input, styles.inputMulti, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={newDescription}
                onChangeText={setNewDescription}
                placeholder="Optional details..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
              />
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Location</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                value={newLocation}
                onChangeText={setNewLocation}
                placeholder="Room / area"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Priority</Text>
              <View style={styles.priorityRow}>
                {PRIORITY_OPTIONS.map((p) => (
                  <TouchableOpacity
                    key={p}
                    style={[
                      styles.priorityChip,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                      newPriority === p && { backgroundColor: colors.primary, borderColor: colors.primary },
                    ]}
                    onPress={() => setNewPriority(p)}
                  >
                    <Text
                      style={[styles.priorityChipText, { color: colors.text }, newPriority === p && { color: '#FFFFFF' }]}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Assign to</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assigneeRow}>
                <TouchableOpacity
                  style={[
                    styles.assigneeChip,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    newAssignee === null && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setNewAssignee(null)}
                >
                  <Text
                    style={[
                      styles.assigneeText,
                      { color: colors.text },
                      newAssignee === null && { color: '#FFFFFF' },
                    ]}
                  >
                    Me
                  </Text>
                </TouchableOpacity>
                {members
                  .filter((m) => m.user_id !== user?.id)
                  .map((m) => (
                    <TouchableOpacity
                      key={m.user_id}
                      style={[
                        styles.assigneeChip,
                        { borderColor: colors.border, backgroundColor: colors.surface },
                        newAssignee === m.user_id && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => setNewAssignee(m.user_id)}
                    >
                      <Text
                        style={[
                          styles.assigneeText,
                          { color: colors.text },
                          newAssignee === m.user_id && { color: '#FFFFFF' },
                        ]}
                      >
                        {(m as { profile?: { full_name?: string } })?.profile?.full_name || 'Member'}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </ScrollView>
              <TouchableOpacity
                style={[styles.createButton, { backgroundColor: colors.primary }, creating && { opacity: 0.7 }]}
                onPress={handleCreateTask}
                disabled={creating}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  blueprintWrap: { flex: 1, minHeight: 200 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  modalContainer: { flex: 1, paddingHorizontal: 20 },
  modalTitle: { fontSize: 22, fontWeight: '700' },
  cancelText: { fontSize: 17, fontWeight: '600' },
  emptyModal: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  roomFilterBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 16,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  roomFilterLabel: { fontSize: 14, fontWeight: '600' },
  clearRoomFilterBtn: { marginTop: 12, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10, borderWidth: 2 },
  clearRoomFilterText: { fontSize: 14, fontWeight: '600' },
  taskListContent: { paddingBottom: 40, paddingHorizontal: 4, paddingTop: 8 },
  taskCardWrap: { marginBottom: 12 },
  modalHeaderCreate: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
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
  createButton: {
    marginTop: 36,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
});
