import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, SafeAreaView, Share,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';
import type { Project } from '../../types/database';

const TRADE_LABELS: Record<string, string> = { electrician: 'Electrician', plumber: 'Plumber', hvac: 'HVAC Technician', general: 'General Labor', other: 'Other' };
const ROLE_LABELS: Record<string, string> = { worker: 'Field Worker', supervisor: 'Supervisor', admin: 'Admin' };

type MemberRow = {
  id: string;
  user_id: string;
  role: string | null;
  profile?: { full_name: string; trade: string | null } | null;
};

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user, projects, leaveProject, refreshProjects } = useApp();
  const { colors } = useTheme();
  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const isMember = projects.some((p) => p.id === id);

  useEffect(() => {
    if (!id) return;
    const fetchProject = async () => {
      const { data } = await supabase.from('projects').select('*').eq('id', id).single();
      setProject(data || null);
    };
    const fetchMembers = async () => {
      const { data } = await supabase
        .from('project_members')
        .select('id, user_id, role, profile:profiles(full_name, trade)')
        .eq('project_id', id);
      setMembers((data as MemberRow[]) || []);
    };
    Promise.all([fetchProject(), fetchMembers()]).finally(() => setLoading(false));
  }, [id]);

  const handleCopyJoinCode = async () => {
    if (!project?.join_code) return;
    await Clipboard.setStringAsync(project.join_code);
    Alert.alert('Copied', 'Join code copied to clipboard.');
  };

  const handleShareJoinCode = async () => {
    if (!project?.join_code) return;
    try {
      await Share.share({
        message: `Join my project "${project.name}" on Bild. Use this code: ${project.join_code}`,
        title: 'Join project',
      });
    } catch {}
  };

  const handleLeaveProject = () => {
    if (!project) return;
    Alert.alert(
      'Leave project',
      `Leave "${project.name}"? You can rejoin later with the join code.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            const { error } = await leaveProject(project.id);
            if (error) Alert.alert('Error', error.message);
            else {
              await refreshProjects();
              router.back();
            }
          },
        },
      ]
    );
  };

  if (loading || !project) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.primary} />
            <Text style={[styles.backText, { color: colors.primary }]}> Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!isMember) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={20} color={colors.primary} />
            <Text style={[styles.backText, { color: colors.primary }]}> Back</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>You are not a member of this project.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}> Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>{project.name}</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {project.address && (
          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={16} color={colors.textLight} />
            <Text style={[styles.address, { color: colors.textLight }]}> {project.address}</Text>
          </View>
        )}

        {project.join_code ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Join code</Text>
            <Text style={[styles.joinCodeValue, { color: colors.text }]} selectable>{project.join_code}</Text>
            <View style={styles.joinCodeActions}>
              <TouchableOpacity style={[styles.joinCodeBtn, { borderColor: colors.border }]} onPress={handleCopyJoinCode}>
                <Ionicons name="copy-outline" size={18} color={colors.primary} />
                <Text style={[styles.joinCodeBtnText, { color: colors.primary }]}> Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.joinCodeBtn, { borderColor: colors.border }]} onPress={handleShareJoinCode}>
                <Ionicons name="share-outline" size={18} color={colors.primary} />
                <Text style={[styles.joinCodeBtnText, { color: colors.primary }]}> Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Members ({members.length})
          </Text>
          {members.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No members yet</Text>
          ) : (
            members.map((m, index) => (
              <View key={m.id} style={[styles.memberRow, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                <Text style={[styles.memberName, { color: colors.text }]}>
                  {(m.profile?.full_name || 'Unknown').trim() || 'Unnamed'}
                </Text>
                <View style={styles.memberMeta}>
                  <Text style={[styles.memberTrade, { color: colors.textMuted }]}>
                    {TRADE_LABELS[m.profile?.trade || ''] || m.profile?.trade || '—'}
                  </Text>
                  <Text style={[styles.memberRole, { color: colors.textMuted }]}>
                    {ROLE_LABELS[m.role || ''] || m.role || '—'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <TouchableOpacity
          style={[styles.leaveBtn, { borderColor: colors.error }]}
          onPress={handleLeaveProject}
        >
          <Ionicons name="exit-outline" size={18} color={colors.error} />
          <Text style={[styles.leaveBtnText, { color: colors.error }]}> Leave project</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 17, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  content: { padding: 20, paddingBottom: 40 },
  loadingText: { fontSize: 16, textAlign: 'center', marginTop: 24 },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  address: { fontSize: 16 },
  card: { borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1 },
  cardLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  joinCodeValue: { fontSize: 20, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
  joinCodeActions: { flexDirection: 'row', gap: 10 },
  joinCodeBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1 },
  joinCodeBtnText: { fontSize: 14, fontWeight: '600' },
  emptyText: { fontSize: 15, fontStyle: 'italic' },
  memberRow: { paddingTop: 12, marginTop: 12 },
  memberName: { fontSize: 16, fontWeight: '600' },
  memberMeta: { flexDirection: 'row', gap: 12, marginTop: 4 },
  memberTrade: { fontSize: 14 },
  memberRole: { fontSize: 14 },
  leaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
  leaveBtnText: { fontSize: 16, fontWeight: '600' },
});
