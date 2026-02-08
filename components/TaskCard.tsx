import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { Task } from '../types/database';

interface TaskCardProps {
  task: Task;
  onPress: () => void;
  proofCount?: number;
  onMarkComplete?: () => void;
  onMarkIncomplete?: () => void;
  /** When user taps check and task has no proofs yet: navigate to capture flow */
  onStartCompletionFlow?: () => void;
  /** If true, no horizontal margin (e.g. when parent already provides padding) */
  fullWidth?: boolean;
}

export default function TaskCard({
  task,
  onPress,
  proofCount = 0,
  onMarkComplete,
  onMarkIncomplete,
  onStartCompletionFlow,
  fullWidth,
}: TaskCardProps) {
  const { colors, priorities } = useTheme();
  const isCompleted = task.status === 'completed';

  const priority = priorities[task.priority as keyof typeof priorities] || priorities.medium;

  const handleCheckmarkPress = () => {
    if (isCompleted) {
      onMarkIncomplete?.();
    } else {
      if (proofCount > 0) {
        onMarkComplete?.();
      } else {
        onStartCompletionFlow?.();
      }
    }
  };

  const showCheckmark = (onMarkComplete != null || onMarkIncomplete != null) || onStartCompletionFlow != null;

  return (
    <View style={[styles.wrapper, fullWidth && styles.wrapperFullWidth]}>
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={styles.cardHeader}>
          <Text style={[styles.taskTitle, { color: colors.text }]} numberOfLines={2}>{task.title}</Text>
          {showCheckmark && (
            <TouchableOpacity
              onPress={handleCheckmarkPress}
              style={styles.checkmarkBtn}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              {isCompleted ? (
                <Ionicons name="checkmark-circle" size={28} color={colors.success} />
              ) : (
                <View style={[styles.checkmarkCircleEmpty, { borderColor: colors.textMuted }]} />
              )}
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.metaRow}>
          <View style={styles.locationRow}>
            {task.location ? (
              <>
                <Ionicons name="location-outline" size={14} color={colors.textLight} />
                <Text style={[styles.taskLocation, { color: colors.textLight }]}> {task.location}</Text>
              </>
            ) : null}
          </View>
          <View style={[styles.badge, { backgroundColor: priority.bg }]}>
            <Text style={[styles.badgeText, { color: priority.color }]}>{priority.label}</Text>
          </View>
        </View>
        {task.description && (
          <Text style={[styles.taskDescription, { color: colors.textMuted }]} numberOfLines={2}>
            {task.description}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginBottom: 12 },
  wrapperFullWidth: { marginHorizontal: 0 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 0 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, marginBottom: 4, gap: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  checkmarkBtn: { padding: 4, justifyContent: 'center', alignItems: 'center' },
  checkmarkCircleEmpty: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  taskTitle: { fontSize: 17, fontWeight: '600', lineHeight: 22, flex: 1, marginRight: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  taskLocation: { fontSize: 14 },
  taskDescription: { fontSize: 14, lineHeight: 20 },
});
