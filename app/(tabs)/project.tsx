import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, TextInput,
  KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator,
  Pressable, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../../context/AppContext';
import ProjectSwitcher from '../../components/ProjectSwitcher';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import { getProjectFileViewUrl } from '../../lib/storage';
import { DocumentPreviewModal } from '../../components/DocumentPreviewModal';
import type { ProjectFile as ProjectFileRow } from '../../types/database';

/** Extract error message from Edge Function response body when status is non-2xx */
async function getEdgeFunctionErrorMessage(error: unknown): Promise<string | null> {
  const err = error as { context?: Response } | null;
  if (!err?.context || typeof err.context?.json !== 'function') return null;
  try {
    const body = await err.context.json();
    if (body && typeof body === 'object' && typeof (body as { error?: string }).error === 'string') {
      return (body as { error: string }).error;
    }
  } catch (_) {}
  return null;
}

const RECENT_SYNC_MS = 60 * 60 * 1000; // 1 hour — skip sync if project was synced within this window

type BobTab = 'chat' | 'files';

type ProjectFile = Pick<ProjectFileRow, 'id' | 'name' | 'file_path' | 'file_size' | 'content_type' | 'created_at'>;

type CitationSource = { title?: string; uri?: string };
type BobMessage = {
  id: string;
  role: 'user' | 'bob';
  content: string;
  citations?: CitationSource[];
};

export default function BobScreen() {
  const router = useRouter();
  const { currentProject } = useApp();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<BobTab>('chat');
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [messages, setMessages] = useState<BobMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);
  const hasSyncedForProject = useRef<string | null>(null);
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);
  const [filesRefreshing, setFilesRefreshing] = useState(false);
  const [filesLoading, setFilesLoading] = useState(true);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const fetchFiles = useCallback(async () => {
    if (!currentProject) {
      setFilesLoading(false);
      return;
    }
    setFilesError(null);
    const { data, error } = await supabase
      .from('project_files')
      .select('id, name, file_path, file_size, content_type, created_at')
      .eq('project_id', currentProject.id)
      .order('created_at', { ascending: false });
    if (error) {
      setFilesError(error.message || 'Failed to load files');
      setFiles([]);
    } else {
      setFiles((data as ProjectFile[]) || []);
    }
    setFilesLoading(false);
  }, [currentProject?.id]);

  useEffect(() => {
    setFilesLoading(true);
    fetchFiles();
  }, [fetchFiles]);

  // Refetch files when user switches to Files tab so list is always up to date
  useEffect(() => {
    if (currentProject && activeTab === 'files') fetchFiles();
  }, [currentProject?.id, activeTab, fetchFiles]);

  const refreshFiles = useCallback(async () => {
    setFilesRefreshing(true);
    await fetchFiles();
    setFilesRefreshing(false);
  }, [fetchFiles]);

  const showDocumentPreview = useCallback(async (file: ProjectFile) => {
    setPreviewTitle(file.name);
    setPreviewUrl(null);
    setPreviewVisible(true);
    setOpeningFileId(file.id);
    const url = await getProjectFileViewUrl(file.file_path);
    setOpeningFileId(null);
    if (url) setPreviewUrl(url);
    else {
      setPreviewVisible(false);
      Alert.alert('Cannot open file', 'Failed to load the document.');
    }
  }, []);

  const openCitation = useCallback(
    async (citation: CitationSource) => {
      const title = citation?.title || citation?.uri || 'Source';
      const hasViewUrl = citation?.uri && (citation.uri.startsWith('http://') || citation.uri.startsWith('https://'));
      if (hasViewUrl) {
        setPreviewTitle(title);
        setPreviewUrl(citation.uri!);
        setPreviewVisible(true);
        return;
      }
      const match = files.find((f) => f.name === title || f.name?.includes(title) || title?.includes(f.name));
      if (match) {
        await showDocumentPreview(match);
        return;
      }
    },
    [files, showDocumentPreview]
  );

  // When opening Bob Chat tab: use last sync time from project; only call bob-sync if no recent sync.
  useEffect(() => {
    if (!currentProject || activeTab !== 'chat') return;
    if (hasSyncedForProject.current === currentProject.id) return;

    const runSyncOrSkip = async () => {
      const { data: projectRow } = await supabase
        .from('projects')
        .select('gemini_file_search_synced_at, gemini_file_search_store_name')
        .eq('id', currentProject.id)
        .single();

      const syncedAt = projectRow?.gemini_file_search_synced_at;
      const storeName = projectRow?.gemini_file_search_store_name;
      const isRecent =
        !!storeName &&
        !!syncedAt &&
        Date.now() - new Date(syncedAt).getTime() < RECENT_SYNC_MS;

      if (isRecent) {
        hasSyncedForProject.current = currentProject.id;
        return; // do not call bob-sync
      }

      setSyncing(true);
      setSyncError(null);
      const { data, error } = await supabase.functions.invoke('bob-sync', {
        body: { project_id: currentProject.id },
      });
      setSyncing(false);
      if (error) {
        const msg = await getEdgeFunctionErrorMessage(error);
        setSyncError(msg || error.message || 'Sync failed');
        return;
      }
      if (data?.error) {
        setSyncError(data.error);
        return;
      }
      hasSyncedForProject.current = currentProject.id;
    };

    runSyncOrSkip();
  }, [currentProject?.id, activeTab]);

  useEffect(() => {
    if (!currentProject) hasSyncedForProject.current = null;
  }, [currentProject?.id]);

  const handleResyncFiles = useCallback(async () => {
    if (!currentProject) return;
    setSyncError(null);
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('bob-sync', {
        body: { project_id: currentProject.id },
      });
      if (error) {
        const msg = await getEdgeFunctionErrorMessage(error);
        setSyncError(msg || error.message || 'Sync failed');
        return;
      }
      if (data?.error) {
        setSyncError(data.error);
        return;
      }
      hasSyncedForProject.current = currentProject.id;
    } finally {
      setSyncing(false);
    }
  }, [currentProject?.id]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !currentProject) return;
    setInput('');
    const userMsg: BobMessage = { id: `u-${Date.now()}`, role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke('bob-chat', {
        body: {
          project_id: currentProject.id,
          message: text,
          access_token: session?.access_token ?? undefined,
        },
      });
      if (error) {
        const msg = await getEdgeFunctionErrorMessage(error);
        const bobMsg: BobMessage = {
          id: `b-${Date.now()}`,
          role: 'bob',
          content: msg || error.message || "Couldn't reach Bob. Try again.",
        };
        setMessages((prev) => [...prev, bobMsg]);
        return;
      }
      if (data?.error) {
        const bobMsg: BobMessage = {
          id: `b-${Date.now()}`,
          role: 'bob',
          content: data.error,
        };
        setMessages((prev) => [...prev, bobMsg]);
        return;
      }
      let citations: CitationSource[] | undefined = Array.isArray(data?.citations)
        ? data.citations.map((c: CitationSource) => ({ title: c?.title, uri: c?.uri }))
        : undefined;
      if ((!citations || citations.length === 0) && Array.isArray(data?.groundingChunks)) {
        const fromChunks = data.groundingChunks
          .map((chunk: { retrieval?: { title?: string; uri?: string }; web?: { title?: string; uri?: string } }) => {
            if (chunk?.retrieval) return { title: chunk.retrieval.title, uri: chunk.retrieval.uri };
            if (chunk?.web) return { title: chunk.web.title, uri: chunk.web.uri };
            return null;
          })
          .filter((c): c is CitationSource => c != null && (c.title != null || c.uri != null));
        if (fromChunks.length > 0) citations = fromChunks;
      }
      const bobMsg: BobMessage = {
        id: `b-${Date.now()}`,
        role: 'bob',
        content: typeof data?.text === 'string' ? data.text : "Bob didn't return a response.",
        citations,
      };
      setMessages((prev) => [...prev, bobMsg]);
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } finally {
      setLoading(false);
    }
  };

  if (!currentProject) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <ProjectSwitcher />
          <TouchableOpacity
            style={[styles.profileButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => router.push('/profile')}
          >
            <Ionicons name="person-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Ionicons name="business-outline" size={48} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Project Selected</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Select a project from the Blueprint tab first</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ProjectSwitcher />
        <TouchableOpacity
          style={[styles.profileButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => router.push('/profile')}
        >
          <Ionicons name="person-outline" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(['chat', 'files'] as BobTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomWidth: 2, borderBottomColor: colors.primary }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, { color: colors.textMuted }, activeTab === tab && { color: colors.primary, fontWeight: '700' }]}>
              {tab === 'chat' ? 'Chat' : 'Files'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'chat' && (
        <KeyboardAvoidingView style={styles.chatContainer} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatListContent}
            ListEmptyComponent={
              <View style={styles.emptyChat}>
                <Ionicons name="chatbubbles-outline" size={48} color={colors.textMuted} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Chat with Bob</Text>
                <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
                  {syncing ? 'Syncing files with Bob…' : `Bob is trained on all your docs, ask him anything!`}
                </Text>
                {syncError && (
                  <Text style={[styles.syncError, { color: colors.textMuted }]}>{syncError}</Text>
                )}
                {!syncing && (
                  <TouchableOpacity
                    style={[styles.resyncBtn, { borderColor: colors.border }]}
                    onPress={handleResyncFiles}
                  >
                    <Ionicons name="refresh-outline" size={16} color={colors.primary} style={styles.resyncIcon} />
                    <Text style={[styles.resyncBtnText, { color: colors.primary }]}>Resync files</Text>
                  </TouchableOpacity>
                )}
              </View>
            }
            renderItem={({ item }) => (
              <View style={[styles.bubbleWrap, item.role === 'user' ? styles.bubbleRight : styles.bubbleLeft]}>
                <View style={[styles.bubble, item.role === 'user' ? [styles.bubbleUser, { backgroundColor: colors.primary }] : [styles.bubbleBob, { backgroundColor: colors.surface, borderColor: colors.border }]]}>
                  {item.role === 'bob' && <Text style={[styles.bobLabel, { color: colors.textMuted }]}>Bob</Text>}
                  {item.role === 'user' ? (
                    <Text style={[styles.bubbleText, { color: '#FFFFFF' }]}>{item.content}</Text>
                  ) : (
                    <>
                      <Text style={[styles.bubbleText, { color: colors.text }]}>{item.content}</Text>
                      {item.role === 'bob' && (() => {
                        const raw = item.citations ?? [];
                        const seen = new Set<string>();
                        const deduped = raw.filter((c) => {
                          const label = (c?.title || c?.uri || '').trim();
                          if (!label || seen.has(label)) return false;
                          seen.add(label);
                          return true;
                        });
                        if (deduped.length === 0) return null;
                        return (
                          <View style={[styles.citationsBlock, { borderTopColor: colors.border }]}>
                            <Text style={[styles.citationsLabel, { color: colors.textMuted }]}>
                              {deduped.length === 1 ? 'Source: ' : 'Sources: '}
                            </Text>
                            <View style={styles.citationsLinks}>
                              {deduped.map((c, idx) => {
                                const label = c?.title || c?.uri || 'Document';
                                return (
                                  <Pressable
                                    key={idx}
                                    onPress={() => openCitation(c)}
                                    style={({ pressed }) => [styles.citationLink, { opacity: pressed ? 0.7 : 1 }]}
                                  >
                                    <Ionicons name="document-text" size={14} color={colors.primary} style={styles.citationIcon} />
                                    <Text style={[styles.citationLinkText, { color: colors.primary }]} numberOfLines={1}>{label}</Text>
                                  </Pressable>
                                );
                              })}
                            </View>
                          </View>
                        );
                      })()}
                    </>
                  )}
                </View>
              </View>
            )}
            ListFooterComponent={
              syncing ? (
                <View style={styles.loaderRow}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.loaderText, { color: colors.textMuted }]}>Syncing files…</Text>
                </View>
              ) : loading ? (
                <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
              ) : null
            }
          />
          <View style={[styles.inputRow, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
              value={input}
              onChangeText={setInput}
              placeholder="Ask Bob..."
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: colors.primary }, (!input.trim() || loading) && styles.sendDisabled]}
              onPress={handleSend}
              disabled={!input.trim() || loading}
            >
              <Ionicons name="send" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {activeTab === 'files' && (
        <View style={styles.filesContainer}>
          {filesLoading && !filesRefreshing ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.emptySubtitle, { color: colors.textMuted, marginTop: 12 }]}>Loading files…</Text>
            </View>
          ) : filesError ? (
            <View style={styles.centered}>
              <Ionicons name="warning-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Couldn't load files</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>{filesError}</Text>
              <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => { setFilesLoading(true); fetchFiles(); }}>
                <Text style={styles.retryBtnText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : files.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="folder-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Project Files</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>Documents uploaded to this project appear here. Bob uses these for context in Chat.</Text>
            </View>
          ) : (
            <FlatList
              data={files}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.filesList}
              refreshing={filesRefreshing}
              onRefresh={refreshFiles}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.fileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => showDocumentPreview(item)}
                  disabled={openingFileId === item.id}
                  activeOpacity={0.7}
                >
                  {openingFileId === item.id ? (
                    <ActivityIndicator size="small" color={colors.primary} style={styles.fileCardLoader} />
                  ) : (
                    <Ionicons name="document-text-outline" size={24} color={colors.primary} />
                  )}
                  <View style={styles.fileInfo}>
                    <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                    {item.file_size != null && <Text style={[styles.fileMeta, { color: colors.textMuted }]}>{Math.round(item.file_size / 1024)} KB</Text>}
                  </View>
                  <Ionicons name="open-outline" size={18} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      )}

      <DocumentPreviewModal
        visible={previewVisible}
        url={previewUrl}
        title={previewTitle}
        onClose={() => {
          setPreviewVisible(false);
          setPreviewUrl(null);
          setPreviewTitle('');
        }}
      />
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
    borderBottomWidth: 1,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  tabBar: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  tabText: { fontSize: 15, fontWeight: '500' },
  chatContainer: { flex: 1 },
  chatListContent: { padding: 16, paddingBottom: 16 },
  emptyChat: { alignItems: 'center', paddingVertical: 48 },
  bubbleWrap: { marginBottom: 12 },
  bubbleLeft: { alignSelf: 'flex-start', maxWidth: '88%' },
  bubbleRight: { alignSelf: 'flex-end', maxWidth: '88%' },
  bubble: { borderRadius: 16, padding: 14 },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleBob: { borderBottomLeftRadius: 4, borderWidth: 1 },
  bobLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  citationsBlock: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  citationsLabel: { fontSize: 12, marginBottom: 4, fontWeight: '600' },
  citationsLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  citationLink: { flexDirection: 'row', alignItems: 'center', maxWidth: '100%' },
  citationIcon: { marginRight: 4 },
  citationLinkText: { fontSize: 12, textDecorationLine: 'underline' },
  syncError: { fontSize: 13, marginTop: 8, textAlign: 'center' },
  resyncBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  resyncIcon: { marginRight: 6 },
  resyncBtnText: { fontSize: 14, fontWeight: '600' },
  loader: { marginVertical: 12 },
  loaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginVertical: 12 },
  loaderText: { fontSize: 14 },
  inputRow: { flexDirection: 'row', padding: 8, alignItems: 'flex-end', gap: 8, borderTopWidth: 1 },
  input: { flex: 1, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, maxHeight: 120, borderWidth: 1 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sendDisabled: { opacity: 0.5 },
  filesContainer: { flex: 1 },
  filesList: { padding: 16 },
  fileCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 10 },
  fileCardLoader: { marginRight: 0 },
  fileInfo: { marginLeft: 12, flex: 1 },
  fileName: { fontSize: 16, fontWeight: '600' },
  fileMeta: { fontSize: 13, marginTop: 2 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginTop: 16, marginBottom: 8 },
  emptySubtitle: { fontSize: 15, textAlign: 'center', lineHeight: 22 },
  retryBtn: { marginTop: 16, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  retryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
