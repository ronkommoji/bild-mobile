import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface AISummaryProps {
  title: string;
  iconName: keyof typeof Ionicons.glyphMap;
  onGenerate: () => Promise<string>;
}

export default function AISummary({ title, iconName, onGenerate }: AISummaryProps) {
  const { colors } = useTheme();
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    setLoading(true);
    const result = await onGenerate();
    setSummary(result);
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={[styles.button, { backgroundColor: colors.accent }]} onPress={handlePress} disabled={loading}>
        <Ionicons name={iconName} size={18} color={colors.text} />
        <Text style={[styles.buttonText, { color: colors.text }]}>{title}</Text>
        {loading && <ActivityIndicator size="small" color={colors.primary} />}
      </TouchableOpacity>
      {summary && (
        <View style={[styles.summaryContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryText, { color: colors.text }]}>{summary}</Text>
          <TouchableOpacity onPress={() => setSummary(null)}>
            <Text style={[styles.dismissText, { color: colors.primary }]}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginHorizontal: 16, marginBottom: 12 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 12, padding: 14 },
  buttonText: { fontSize: 15, fontWeight: '600', flex: 1 },
  summaryContainer: { borderRadius: 12, padding: 16, marginTop: 8, borderWidth: 1 },
  summaryText: { fontSize: 14, lineHeight: 22, marginBottom: 12 },
  dismissText: { fontSize: 14, fontWeight: '600' },
});
