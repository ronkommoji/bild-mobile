import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput,
  KeyboardAvoidingView, Platform, SafeAreaView, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { useChat } from '../../hooks/useChat';
import { useTasks } from '../../hooks/useTasks';
import { supabase } from '../../lib/supabase';
import { generateDailySummary, generateTodayOverview } from '../../lib/gemini';
import ChatMessageBubble from '../../components/ChatMessage';
import AISummary from '../../components/AISummary';
import { ActivityFeedItem } from '../../types/database';

type Tab = 'updates' | 'chat' | 'files';

export default function ProjectScreen() {
  const { user, currentProject, members } = useApp();
  const { colors } = useTheme();
  const { messages, sendMessage } = useChat(currentProject?.id);
  const { pendingTasks } = useTasks(currentProject?.id, user?.id);
  const [activeTab, setActiveTab] = useState<Tab>('updates');
  const [activities, setActivities] = useState<(ActivityFeedItem & { profile?: { full_name: string } | null; task?: { title: string } | null })[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const chatListRef = useRef<FlatList>(null);

  const fetchActivities = async () => {
    if (!currentProject) return;
    const { data } = await supabase.from('activity_feed').select('*, profile:profiles(full_name), task:tasks(title)').eq('project_id', currentProject.id).order('created_at', { ascending: false }).limit(50);
    setActivities((data as any) || []);
  };

  useEffect(() => { fetchActivities(); }, [currentProject?.id]);
  const onRefresh = async () => { setRefreshing(true); await fetchActivities(); setRefreshing(false); };
  const handleSendMessage = async () => { if (!chatInput.trim() || !user) return; const text = chatInput.trim(); setChatInput(''); await sendMessage(user.id, text); };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = { task_completed: 'completed task', task_blocked: 'blocked task', task_started: 'started working on', proof_submitted: 'submitted proof for', message_sent: 'sent a message', member_joined: 'joined the project' };
    return labels[action] || action;
  };

  const handleGenerateSummary = async () => {
    const activityData = activities.map((a) => ({ action: a.action, userName: (a.profile as any)?.full_name || 'Unknown', taskTitle: (a.task as any)?.title, metadata: a.metadata, created_at: a.created_at || new Date().toISOString() }));
    return generateDailySummary(currentProject?.name || 'Project', activityData);
  };

  const handleGenerateOverview = async () => {
    const taskData = pendingTasks.map((t) => { const m = members.find((m) => m.user_id === t.assigned_to); return { title: t.title, priority: t.priority || 'medium', location: t.location || undefined, assignedTo: (m as any)?.profile?.full_name || undefined }; });
    return generateTodayOverview(currentProject?.name || 'Project', taskData);
  };

  if (!currentProject) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Ionicons name="business-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Project Selected</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Select a project from the Today tab first</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}><Text style={[styles.headerTitle, { color: colors.text }]}>{currentProject.name}</Text></View>
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(['updates', 'chat', 'files'] as Tab[]).map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && { borderBottomWidth: 2, borderBottomColor: colors.primary }]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, { color: colors.textMuted }, activeTab === tab && { color: colors.primary, fontWeight: '700' }]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'updates' && (
        <FlatList data={activities} keyExtractor={(item) => item.id} contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          ListHeaderComponent={
            <View>
              <AISummary title="What happened yesterday?" iconName="bar-chart-outline" onGenerate={handleGenerateSummary} />
              <AISummary title="What's left today?" iconName="clipboard-outline" onGenerate={handleGenerateOverview} />
            </View>
          }
          ListEmptyComponent={<View style={styles.emptyList}><Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>No activity yet</Text></View>}
          renderItem={({ item }) => (
            <View style={styles.activityCard}>
              <View style={[styles.activityDot, { backgroundColor: colors.primary }]} />
              <View style={styles.activityContent}>
                <Text style={[styles.activityText, { color: colors.text }]}>
                  <Text style={styles.activityName}>{(item.profile as any)?.full_name || 'Someone'}</Text>{' '}
                  {getActionLabel(item.action)}
                  {(item.task as any)?.title && <Text style={[styles.activityTask, { color: colors.primary }]}> "{(item.task as any)?.title}"</Text>}
                </Text>
                <Text style={[styles.activityTime, { color: colors.textMuted }]}>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</Text>
              </View>
            </View>
          )}
        />
      )}

      {activeTab === 'chat' && (
        <KeyboardAvoidingView style={styles.chatContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
          <FlatList ref={chatListRef} data={messages} keyExtractor={(item) => item.id} contentContainerStyle={styles.chatListContent}
            onContentSizeChange={() => chatListRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={<View style={styles.emptyList}><Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>No messages yet. Start the conversation!</Text></View>}
            renderItem={({ item }) => (
              <ChatMessageBubble content={item.content} senderName={(item.profile as any)?.full_name || 'Unknown'}
                isOwnMessage={item.user_id === user?.id} messageType={item.message_type} createdAt={item.created_at} />
            )}
          />
          <View style={[styles.chatInputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <TextInput style={[styles.chatInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={chatInput} onChangeText={setChatInput} placeholder="Type a message..." placeholderTextColor={colors.textMuted} multiline maxLength={1000} />
            <TouchableOpacity style={[styles.sendButton, { backgroundColor: colors.primary }, !chatInput.trim() && styles.sendButtonDisabled]} onPress={handleSendMessage} disabled={!chatInput.trim()}>
              <Ionicons name="send" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {activeTab === 'files' && (
        <View style={styles.centered}>
          <Ionicons name="folder-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Project Files</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Files uploaded by supervisors will appear here.{'\n'}This is a read-only view.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '700' },
  tabBar: { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 15, fontWeight: '500' },
  listContent: { paddingTop: 16, paddingBottom: 20 },
  chatContainer: { flex: 1 },
  chatListContent: { paddingVertical: 12 },
  chatInputBar: { flexDirection: 'row', padding: 12, borderTopWidth: 1, alignItems: 'flex-end', gap: 8 },
  chatInput: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, borderWidth: 1 },
  sendButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
  activityCard: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 10, gap: 12 },
  activityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  activityContent: { flex: 1 },
  activityText: { fontSize: 15, lineHeight: 22 },
  activityName: { fontWeight: '700' },
  activityTask: { fontWeight: '600' },
  activityTime: { fontSize: 12, marginTop: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  emptyList: { padding: 32, alignItems: 'center' },
});
