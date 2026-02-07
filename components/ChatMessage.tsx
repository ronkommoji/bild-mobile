import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface ChatMessageProps {
  content: string | null;
  senderName: string;
  isOwnMessage: boolean;
  messageType: string | null;
  createdAt: string | null;
}

export default function ChatMessageBubble({ content, senderName, isOwnMessage, messageType, createdAt }: ChatMessageProps) {
  const { colors } = useTheme();
  const time = createdAt ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <View style={[styles.container, isOwnMessage ? styles.ownContainer : styles.otherContainer]}>
      {!isOwnMessage && <Text style={[styles.senderName, { color: colors.textMuted }]}>{senderName}</Text>}
      <View style={[styles.bubble, isOwnMessage ? [styles.ownBubble, { backgroundColor: colors.primary }] : [styles.otherBubble, { backgroundColor: colors.surface, borderColor: colors.border }]]}>
        {messageType === 'voice' && (
          <View style={styles.voiceRow}>
            <Ionicons name="mic-outline" size={14} color={isOwnMessage ? 'rgba(255,255,255,0.7)' : colors.textMuted} />
            <Text style={[styles.voiceLabel, { color: isOwnMessage ? 'rgba(255,255,255,0.7)' : colors.textMuted }]}> Voice message</Text>
          </View>
        )}
        <Text style={[styles.messageText, { color: isOwnMessage ? '#FFFFFF' : colors.text }]}>{content || ''}</Text>
      </View>
      <Text style={[styles.time, { color: colors.textMuted }, isOwnMessage ? styles.ownTime : styles.otherTime]}>{time}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginVertical: 4, marginHorizontal: 16, maxWidth: '80%' },
  ownContainer: { alignSelf: 'flex-end' },
  otherContainer: { alignSelf: 'flex-start' },
  senderName: { fontSize: 12, fontWeight: '600', marginBottom: 2, marginLeft: 8 },
  bubble: { borderRadius: 16, padding: 12, paddingHorizontal: 16 },
  ownBubble: { borderBottomRightRadius: 4 },
  otherBubble: { borderBottomLeftRadius: 4, borderWidth: 1 },
  messageText: { fontSize: 15, lineHeight: 20 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  voiceLabel: { fontSize: 12 },
  time: { fontSize: 11, marginTop: 2 },
  ownTime: { textAlign: 'right', marginRight: 4 },
  otherTime: { marginLeft: 8 },
});
