import React from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
// Task sheet ~42% of screen (blueprint ~58% top)
const PEEK_HEIGHT = Math.round(SCREEN_HEIGHT * 0.42);

interface TasksBottomSheetProps {
  children: React.ReactNode;
  activeCount: number;
  sheetBackgroundColor: string;
  textColor: string;
  subtextColor: string;
  borderColor: string;
  handleColor: string;
}

export default function TasksBottomSheet({
  children,
  activeCount,
  sheetBackgroundColor,
  textColor,
  subtextColor,
  borderColor,
  handleColor,
}: TasksBottomSheetProps) {
  return (
    <View
      style={[
        styles.sheet,
        {
          height: PEEK_HEIGHT,
          backgroundColor: sheetBackgroundColor,
          borderColor,
          borderTopWidth: 1,
          borderLeftWidth: 1,
          borderRightWidth: 1,
        },
      ]}
    >
      <View style={styles.handleRow}>
        <View style={[styles.modalHandle, { backgroundColor: handleColor }]} />
        <Text style={[styles.tasksBarTitle, { color: textColor }]}>Tasks</Text>
        <Text style={[styles.tasksBarSubtext, { color: subtextColor }]}>
          {activeCount} active
        </Text>
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handleRow: {
    paddingTop: 12,
    paddingBottom: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  modalHandle: { width: 36, height: 5, borderRadius: 3, marginBottom: 8 },
  tasksBarTitle: { fontSize: 18, fontWeight: '700' },
  tasksBarSubtext: { fontSize: 13, marginTop: 2 },
  content: { flex: 1, minHeight: 0 },
});

export { PEEK_HEIGHT };
