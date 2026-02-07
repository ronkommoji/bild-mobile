import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { Task } from '../types/database';

interface TaskCardProps {
  task: Task;
  onPress: () => void;
  onSwipeRight: () => void;
  onSwipeLeft: () => void;
  onMarkComplete?: () => void;
  onMarkIncomplete?: () => void;
}

export default function TaskCard({ task, onPress, onSwipeRight, onSwipeLeft, onMarkComplete, onMarkIncomplete }: TaskCardProps) {
  const { colors, priorities, statusColors } = useTheme();
  const translateX = useSharedValue(0);
  const isCompleted = task.status === 'completed';

  const priority = priorities[task.priority as keyof typeof priorities] || priorities.medium;
  const status = statusColors[task.status as keyof typeof statusColors] || statusColors.pending;

  const panGesture = Gesture.Pan()
    .onUpdate((event) => { translateX.value = event.translationX; })
    .onEnd((event) => {
      if (event.translationX > 100) { runOnJS(onSwipeRight)(); }
      else if (event.translationX < -100) { runOnJS(onSwipeLeft)(); }
      translateX.value = withSpring(0);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const handleCheckmarkPress = () => {
    if (isCompleted) onMarkIncomplete?.();
    else onMarkComplete?.();
  };

  return (
    <View style={styles.wrapper}>
      <GestureDetector gesture={panGesture}>
        <Animated.View style={animatedStyle}>
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            onPress={onPress}
            activeOpacity={1}
          >
            <View style={styles.cardHeader}>
              <View style={styles.badgesRow}>
                <View style={[styles.badge, { backgroundColor: priority.bg }]}>
                  <Text style={[styles.badgeText, { color: priority.color }]}>{priority.label}</Text>
                </View>
                <View style={[styles.badge, { backgroundColor: status.bg }]}>
                  <Text style={[styles.badgeText, { color: status.color }]}>{status.label}</Text>
                </View>
              </View>
              {(onMarkComplete != null || onMarkIncomplete != null) && (
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
            <Text style={[styles.taskTitle, { color: colors.text }]}>{task.title}</Text>
            {task.location && (
              <View style={styles.locationRow}>
                <Ionicons name="location-outline" size={14} color={colors.textLight} />
                <Text style={[styles.taskLocation, { color: colors.textLight }]}> {task.location}</Text>
              </View>
            )}
            {task.description && (
              <Text style={[styles.taskDescription, { color: colors.textMuted }]} numberOfLines={2}>
                {task.description}
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginBottom: 12 },
  card: { borderRadius: 16, padding: 16, borderWidth: 1, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  badgesRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', flex: 1 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  checkmarkBtn: { padding: 4, justifyContent: 'center', alignItems: 'center' },
  checkmarkCircleEmpty: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  taskTitle: { fontSize: 17, fontWeight: '600', marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  taskLocation: { fontSize: 14 },
  taskDescription: { fontSize: 14, lineHeight: 20 },
});
