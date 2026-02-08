import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Image, SafeAreaView,
  Modal, FlatList, TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import { useTaskComments } from '../../hooks/useTaskComments';
import { Task, TaskProof } from '../../types/database';

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, currentProject, members } = useApp();
  const { colors, priorities, statusColors } = useTheme();
  const { comments, sendComment } = useTaskComments(id);
  const [task, setTask] = useState<Task | null>(null);
  const [proofs, setProofs] = useState<TaskProof[]>([]);
  const [loading, setLoading] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [mentionSearch, setMentionSearch] = useState('');
  const [showMentionPicker, setShowMentionPicker] = useState(false);
  const [pendingMentions, setPendingMentions] = useState<string[]>([]);

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

  const onCommentChange = (text: string) => {
    setCommentInput(text);
    const lastAt = text.lastIndexOf('@');
    if (lastAt !== -1) {
      const after = text.slice(lastAt + 1);
      const hasSpace = after.includes(' ');
      if (!hasSpace) {
        setMentionSearch(after.toLowerCase());
        setShowMentionPicker(true);
        return;
      }
    }
    setShowMentionPicker(false);
  };

  const memberOptions = members.filter((m) => {
    const name = ((m as any).profile?.full_name || 'Member').toLowerCase();
    return name.includes(mentionSearch);
  });

  const insertMention = (member: { user_id: string; profile?: { full_name: string } }) => {
    const name = (member.profile?.full_name || 'Member').split(' ')[0];
    const lastAt = commentInput.lastIndexOf('@');
    const before = commentInput.slice(0, lastAt);
    const after = commentInput.slice(lastAt).replace(/@[^\s]*$/, '');
    setCommentInput(`${before}@${name} ${after}`);
    setPendingMentions((prev) => (prev.includes(member.user_id) ? prev : [...prev, member.user_id]));
    setShowMentionPicker(false);
    setMentionSearch('');
  };

  const handleSendComment = async () => {
    if (!commentInput.trim() || !user) return;
    const content = commentInput.trim();
    setCommentInput('');
    await sendComment(user.id, content, pendingMentions);
    setPendingMentions([]);
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
        <TouchableOpacity style={[styles.commentsCta, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowComments(true)}>
          <Ionicons name="chatbubble-outline" size={20} color={colors.primary} />
          <Text style={[styles.commentsCtaText, { color: colors.text }]}>Comments ({comments.length})</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </TouchableOpacity>
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
      <View style={[styles.actionBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {task.status === 'completed' ? (
          <TouchableOpacity style={[styles.completeButton, { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.border }]} onPress={() => handleStatusChange('pending')}>
            <Ionicons name="arrow-undo-outline" size={20} color={colors.text} />
            <Text style={[styles.completeButtonText, { color: colors.text }]}> Move to uncompleted</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={[styles.completeButton, { backgroundColor: colors.primary }]} onPress={() => router.push({ pathname: '/(tabs)/capture', params: { taskId: task.id } })}>
            <Ionicons name="camera-outline" size={20} color="#FFFFFF" />
            <Text style={styles.completeButtonText}> Start task</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Comments / mini-chat modal */}
      <Modal visible={showComments} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowComments(false)}>
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Comments</Text>
            <TouchableOpacity onPress={() => setShowComments(false)}><Text style={[styles.cancelText, { color: colors.primary }]}>Done</Text></TouchableOpacity>
          </View>
          <Text style={[styles.mentionHint, { color: colors.textMuted }]}>Use @ to mention someone from the project</Text>
          <FlatList
            data={comments}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.commentsList}
            ListEmptyComponent={<Text style={[styles.emptyComments, { color: colors.textMuted }]}>No comments yet. Ask a question or @mention a teammate.</Text>}
            renderItem={({ item }) => (
              <View style={[styles.commentBubble, item.user_id === user?.id ? { alignSelf: 'flex-end', backgroundColor: colors.primary } : { alignSelf: 'flex-start', backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.commentSender, { color: item.user_id === user?.id ? 'rgba(255,255,255,0.9)' : colors.textMuted }]}>{(item as any).profile?.full_name || 'Someone'}</Text>
                <Text style={[styles.commentText, { color: item.user_id === user?.id ? '#FFFFFF' : colors.text }]}>{item.content}</Text>
                <Text style={[styles.commentTime, { color: item.user_id === user?.id ? 'rgba(255,255,255,0.7)' : colors.textMuted }]}>{item.created_at ? new Date(item.created_at).toLocaleString() : ''}</Text>
              </View>
            )}
          />
          {showMentionPicker && memberOptions.length > 0 && (
            <View style={[styles.mentionPicker, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {memberOptions.map((m) => (
                <TouchableOpacity key={m.user_id} style={styles.mentionOption} onPress={() => insertMention(m)}>
                  <Text style={[styles.mentionOptionText, { color: colors.primary }]}>@{(m as any).profile?.full_name || 'Member'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
            <View style={[styles.commentInputRow, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
              <TextInput
                style={[styles.commentInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.text }]}
                value={commentInput}
                onChangeText={onCommentChange}
                placeholder="Message or @mention..."
                placeholderTextColor={colors.textMuted}
                multiline
                maxLength={1000}
              />
              <TouchableOpacity style={[styles.sendCommentBtn, { backgroundColor: colors.primary }, !commentInput.trim() && styles.sendDisabled]} onPress={handleSendComment} disabled={!commentInput.trim()}>
                <Ionicons name="send" size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
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
  commentsCta: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 14, borderRadius: 12, borderWidth: 1, marginTop: 24 },
  commentsCtaText: { fontSize: 16, fontWeight: '600', flex: 1 },
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
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  cancelText: { fontSize: 17, fontWeight: '600' },
  mentionHint: { fontSize: 12, paddingHorizontal: 20, paddingTop: 8 },
  commentsList: { padding: 16, paddingBottom: 12 },
  emptyComments: { fontSize: 15, textAlign: 'center', paddingVertical: 24 },
  commentBubble: { maxWidth: '85%', borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1 },
  commentSender: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  commentText: { fontSize: 15, lineHeight: 20 },
  commentTime: { fontSize: 11, marginTop: 4 },
  mentionPicker: { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  mentionOption: { padding: 12 },
  mentionOptionText: { fontSize: 15, fontWeight: '600' },
  commentInputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 8, borderTopWidth: 1 },
  commentInput: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, maxHeight: 100, borderWidth: 1 },
  sendCommentBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sendDisabled: { opacity: 0.5 },
});
