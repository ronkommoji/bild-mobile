import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  SectionList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  SafeAreaView,
  Modal,
  Dimensions,
} from 'react-native';

const SCREEN_WIDTH = Dimensions.get('window').width;
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { useTasks } from '../../hooks/useTasks';
import TaskCard from '../../components/TaskCard';
import ProjectSwitcher from '../../components/ProjectSwitcher';
import { Task } from '../../types/database';

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

function sortByPriority(tasks: Task[]) {
  return [...tasks].sort(
    (a, b) => (PRIORITY_ORDER[a.priority || 'medium'] ?? 1) - (PRIORITY_ORDER[b.priority || 'medium'] ?? 1)
  );
}

type PriorityFilter = 'all' | 'high' | 'medium' | 'low';
type StatusFilter = 'all' | 'active' | 'completed';

export default function TasksScreen() {
  const router = useRouter();
  const { user, currentProject } = useApp();
  const { colors } = useTheme();
  const { tasks, activeTasks, completedTasks, proofCountByTaskId, loading, updateTaskStatus, refreshTasks } = useTasks(
    currentProject?.id,
    user?.id
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<PriorityFilter>('all');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [completedSectionOpen, setCompletedSectionOpen] = useState(false);

  const filteredActive = useMemo(() => {
    let list = sortByPriority(activeTasks);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          (t.location || '').toLowerCase().includes(q)
      );
    }
    if (filterPriority !== 'all') list = list.filter((t) => (t.priority || 'medium') === filterPriority);
    return list;
  }, [activeTasks, searchQuery, filterPriority]);

  const filteredCompleted = useMemo(() => {
    let list = sortByPriority(completedTasks);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          (t.location || '').toLowerCase().includes(q)
      );
    }
    if (filterPriority !== 'all') list = list.filter((t) => (t.priority || 'medium') === filterPriority);
    return list;
  }, [completedTasks, searchQuery, filterPriority]);

  const sections = useMemo(() => {
    const result: { title: string; data: Task[]; count: number }[] = [];
    if (filterStatus !== 'completed') {
      result.push({ title: 'Tasks', data: filteredActive, count: activeTasks.length });
    }
    if (filterStatus !== 'active') {
      result.push({
        title: 'Completed',
        data: completedSectionOpen ? filteredCompleted : [],
        count: completedTasks.length,
      });
    }
    return result;
  }, [filteredActive, filteredCompleted, activeTasks.length, completedTasks.length, completedSectionOpen, filterStatus]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshTasks();
    setRefreshing(false);
  };

  const handleMarkComplete = (taskId: string) => updateTaskStatus(taskId, 'completed');
  const handleMarkIncomplete = (taskId: string) => updateTaskStatus(taskId, 'pending');
  const handleStartCompletionFlow = (taskId: string) => {
    router.push({ pathname: '/(tabs)/capture', params: { taskId } });
  };

  const hasActiveFilters = filterPriority !== 'all' || filterStatus !== 'all';

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
            Select a project from the Blueprint tab first
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.background }]}>
        <ProjectSwitcher />
        <TouchableOpacity
          style={[styles.profileButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push('/profile')}
        >
          <Ionicons name="person-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Search + Filter button on same row */}
      <View style={[styles.searchRow, { backgroundColor: colors.background }]}>
        <TextInput
          style={[
            styles.searchInput,
            { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
          ]}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search tasks..."
          placeholderTextColor={colors.textMuted}
        />
        <TouchableOpacity
          style={[
            styles.filterButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            hasActiveFilters && { borderColor: colors.primary, backgroundColor: colors.primary },
          ]}
          onPress={() => setFilterModalVisible(true)}
        >
          <Ionicons
            name="filter-outline"
            size={22}
            color={hasActiveFilters ? '#FFFFFF' : colors.text}
          />
        </TouchableOpacity>
      </View>

      {tasks.length === 0 && !loading ? (
        <View style={styles.emptyState}>
          <Ionicons name="checkmark-circle-outline" size={48} color={colors.success} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No tasks yet</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
            Tasks will appear here when added to the project
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
          }
          renderSectionHeader={({ section }) => {
            const isCompleted = section.title === 'Completed';
            const count = section.count;
            return (
              <View style={[styles.sectionHeaderOuter, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.sectionHeaderInner}
                  onPress={isCompleted ? () => setCompletedSectionOpen((o) => !o) : undefined}
                  activeOpacity={isCompleted ? 0.7 : 1}
                  disabled={!isCompleted}
                >
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{section.title}</Text>
                  <View style={styles.sectionHeaderRight}>
                    <Text style={[styles.sectionCount, { color: colors.textMuted }]}>{count}</Text>
                    {isCompleted && (
                      <Ionicons
                        name={completedSectionOpen ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color={colors.textMuted}
                        style={styles.sectionChevron}
                      />
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            );
          }}
          renderItem={({ item, section, index }) => {
            const isCompleted = section.title === 'Completed';
            const isFirstInSection = index === 0;
            return (
              <View style={[styles.taskCardWrap, isFirstInSection && styles.firstTaskSpacer]}>
                <TaskCard
                  task={item}
                  proofCount={proofCountByTaskId[item.id] ?? 0}
                  onPress={() => router.push(`/task/${item.id}`)}
                  onMarkComplete={!isCompleted ? () => handleMarkComplete(item.id) : undefined}
                  onMarkIncomplete={isCompleted ? () => handleMarkIncomplete(item.id) : undefined}
                  onStartCompletionFlow={!isCompleted ? () => handleStartCompletionFlow(item.id) : undefined}
                  fullWidth
                />
              </View>
            );
          }}
          ListEmptyComponent={
            filteredActive.length === 0 && filteredCompleted.length === 0 ? (
              <View style={styles.emptyFilters}>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>No tasks match your filters</Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Filter modal */}
      <Modal
        visible={filterModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setFilterModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.filterModalOverlay}
          activeOpacity={1}
          onPress={() => setFilterModalVisible(false)}
        >
          <View
            style={[styles.filterModalContent, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={[styles.filterModalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.filterModalTitle, { color: colors.text }]}>Filter</Text>
              <TouchableOpacity onPress={() => setFilterModalVisible(false)}>
                <Text style={[styles.cancelText, { color: colors.primary }]}>Done</Text>
              </TouchableOpacity>
            </View>
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Priority</Text>
            <View style={styles.filterChipsRow}>
              {(['all', 'high', 'medium', 'low'] as const).map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.filterChip,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    filterPriority === p && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setFilterPriority(p)}
                >
                  <Text
                    style={[styles.filterChipText, { color: colors.text }, filterPriority === p && { color: '#FFFFFF' }]}
                  >
                    {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Status</Text>
            <View style={styles.filterChipsRow}>
              {(['all', 'active', 'completed'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.filterChip,
                    { backgroundColor: colors.background, borderColor: colors.border },
                    filterStatus === s && { backgroundColor: colors.primary, borderColor: colors.primary },
                  ]}
                  onPress={() => setFilterStatus(s)}
                >
                  <Text
                    style={[styles.filterChipText, { color: colors.text }, filterStatus === s && { color: '#FFFFFF' }]}
                  >
                    {s === 'all' ? 'All' : s === 'active' ? 'Active' : 'Completed'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: { paddingBottom: 100, paddingHorizontal: 20, overflow: 'visible' as const },
  sectionHeaderOuter: {
    width: SCREEN_WIDTH,
    marginHorizontal: -20,
    borderBottomWidth: 1,
  },
  sectionHeaderInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingTop: 16,
    paddingBottom: 20,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase' },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sectionCount: { fontSize: 13, fontWeight: '600' },
  sectionChevron: { marginLeft: 2 },
  taskCardWrap: { marginBottom: 12 },
  firstTaskSpacer: { marginTop: 20 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  emptyFilters: { padding: 24, alignItems: 'center' },
  filterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 24,
  },
  filterModalContent: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    maxWidth: 400,
    alignSelf: 'center',
    width: '100%',
  },
  filterModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  filterModalTitle: { fontSize: 18, fontWeight: '700' },
  cancelText: { fontSize: 17, fontWeight: '600' },
  filterLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  filterChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 14, fontWeight: '600' },
});
