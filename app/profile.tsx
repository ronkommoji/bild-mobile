import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, SafeAreaView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';

const TRADE_LABELS: Record<string, string> = { electrician: 'Electrician', plumber: 'Plumber', hvac: 'HVAC Technician', general: 'General Labor', other: 'Other' };
const ROLE_LABELS: Record<string, string> = { worker: 'Field Worker', supervisor: 'Supervisor', admin: 'Admin' };

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, projects, signOut } = useApp();
  const { colors, isDark, toggleTheme } = useTheme();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await signOut(); } },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.primary} />
          <Text style={[styles.backText, { color: colors.primary }]}> Back</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {profile?.full_name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?'}
            </Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{profile?.full_name || 'Unknown'}</Text>
          <Text style={[styles.email, { color: colors.textMuted }]}>{user?.email}</Text>
        </View>

        <View style={styles.infoSection}>
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Trade</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{TRADE_LABELS[profile?.trade || ''] || profile?.trade || 'Not set'}</Text>
          </View>
          <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Role</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>{ROLE_LABELS[profile?.role || ''] || profile?.role || 'Worker'}</Text>
          </View>
        </View>

        {/* Dark Mode Toggle */}
        <View style={[styles.settingRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.settingLeft}>
            <Ionicons name={isDark ? 'moon' : 'sunny-outline'} size={22} color={colors.text} />
            <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>My Projects</Text>
          {projects.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Not a member of any projects</Text>
          ) : projects.map((project) => (
            <TouchableOpacity
              key={project.id}
              style={[styles.projectCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => router.push(`/project/${project.id}`)}
              activeOpacity={0.8}
            >
              <Text style={[styles.projectName, { color: colors.text }]}>{project.name}</Text>
              {project.address && (
                <View style={styles.addressRow}>
                  <Ionicons name="location-outline" size={14} color={colors.textLight} />
                  <Text style={[styles.projectAddress, { color: colors.textLight }]}> {project.address}</Text>
                </View>
              )}
              <View style={styles.projectStatusBadge}>
                <Text style={[styles.projectStatusText, { color: colors.success }]}>{project.status || 'active'}</Text>
              </View>
              <View style={styles.projectCardFooter}>
                <Text style={[styles.tapHint, { color: colors.textMuted }]}>Tap for details</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={[styles.signOutButton, { backgroundColor: colors.surface, borderColor: colors.error }]} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color={colors.error} />
            <Text style={[styles.signOutText, { color: colors.error }]}> Sign Out</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.version, { color: colors.textMuted }]}>Bild v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  backBtn: { flexDirection: 'row', alignItems: 'center' },
  backText: { fontSize: 17, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  content: { padding: 20, paddingBottom: 40 },
  avatarContainer: { alignItems: 'center', marginBottom: 32 },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarText: { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  name: { fontSize: 24, fontWeight: '700' },
  email: { fontSize: 15, marginTop: 4 },
  infoSection: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  infoCard: { flex: 1, borderRadius: 12, padding: 16, borderWidth: 1 },
  infoLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  infoValue: { fontSize: 16, fontWeight: '600' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, padding: 16, borderWidth: 1, marginBottom: 24 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingLabel: { fontSize: 16, fontWeight: '600' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  emptyText: { fontSize: 15, fontStyle: 'italic' },
  projectCard: { borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1 },
  projectName: { fontSize: 16, fontWeight: '600' },
  addressRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  projectAddress: { fontSize: 14 },
  projectStatusBadge: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: 'rgba(76,175,80,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  projectStatusText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  projectCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 12, gap: 4 },
  tapHint: { fontSize: 13 },
  signOutButton: { borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, flexDirection: 'row', justifyContent: 'center' },
  signOutText: { fontSize: 16, fontWeight: '600' },
  version: { textAlign: 'center', fontSize: 13, marginTop: 16 },
});
