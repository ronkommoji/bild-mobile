import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, StyleSheet, TextInput, Alert, KeyboardAvoidingView, Platform, ScrollView, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { Project } from '../types/database';

export default function ProjectSwitcher() {
  const { user, projects, currentProject, members, switchProject, createProject, updateProject, joinProjectByCode } = useApp();
  const { colors } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [updating, setUpdating] = useState(false);

  const currentUserMember = members.find((m) => m.user_id === user?.id);
  const isSupervisor = currentUserMember?.role === 'supervisor';

  const handleSelect = (project: Project) => { switchProject(project); setModalVisible(false); };

  const handleCreate = async () => {
    if (!newName.trim()) { Alert.alert('Error', 'Project name is required.'); return; }
    setCreating(true);
    const { error } = await createProject(newName.trim(), newDescription.trim());
    setCreating(false);
    if (error) { Alert.alert('Error', error.message); }
    else { setNewName(''); setNewDescription(''); setShowCreate(false); setModalVisible(false); }
  };

  const startEditProject = (project: Project) => {
    setEditingProject(project);
    setEditName(project.name);
    setEditDescription(project.description ?? '');
  };

  const handleUpdateProject = async () => {
    if (!editingProject || !editName.trim()) { Alert.alert('Error', 'Project name is required.'); return; }
    setUpdating(true);
    const { error } = await updateProject(editingProject.id, { name: editName.trim(), description: editDescription.trim() || undefined });
    setUpdating(false);
    if (error) { Alert.alert('Error', error.message); }
    else { setEditingProject(null); }
  };

  const handleJoinProject = async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) { Alert.alert('Error', 'Enter a join code.'); return; }
    setJoining(true);
    const { error } = await joinProjectByCode(code);
    setJoining(false);
    if (error) { Alert.alert('Invalid code', error.message); }
    else { setJoinCode(''); setShowJoin(false); setModalVisible(false); }
  };

  const handleShareJoinCode = async () => {
    if (!currentProject?.join_code) return;
    try {
      await Share.share({
        message: `Join my project "${currentProject.name}" on Bild. Use this code: ${currentProject.join_code}`,
        title: 'Join project',
      });
    } catch {}
  };

  return (
    <>
      <TouchableOpacity style={[styles.trigger, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setModalVisible(true)}>
        <Text style={[styles.triggerText, { color: colors.text }]} numberOfLines={1}>
          {currentProject?.name || 'Select Project'}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { setModalVisible(false); setShowCreate(false); setShowJoin(false); setEditingProject(null); }}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.modalBg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}>
          <View style={[styles.modalWrapper, { backgroundColor: colors.modalBg }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {showCreate ? 'New Project' : showJoin ? 'Join Project' : editingProject ? 'Edit Project' : 'Projects'}
              </Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); setShowCreate(false); setShowJoin(false); setEditingProject(null); }}>
                <Text style={[styles.closeButton, { color: colors.primary }]}>{showCreate || showJoin || editingProject ? 'Cancel' : 'Done'}</Text>
              </TouchableOpacity>
            </View>

            {showJoin ? (
              <ScrollView contentContainerStyle={styles.createFormScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.createFormScrollView}>
                <View style={[styles.createForm, { borderTopWidth: 0 }]}>
                  <Text style={[styles.createFormLabel, styles.createFormLabelFirst, { color: colors.text }]}>Join code</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
                    value={joinCode}
                    onChangeText={setJoinCode}
                    placeholder="Enter code (e.g. ABC123)"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="characters"
                    autoCorrect={false}
                  />
                  <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary }, joining && { opacity: 0.7 }]} onPress={handleJoinProject} disabled={joining}>
                    <Text style={styles.createBtnText}>{joining ? 'Joining...' : 'Join'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border, marginTop: 12 }]} onPress={() => setShowJoin(false)}>
                    <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>Back</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            ) : showCreate ? (
              <ScrollView contentContainerStyle={styles.createFormScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.createFormScrollView}>
                <View style={[styles.createForm, { borderTopWidth: 0 }]}>
                  <Text style={[styles.createFormLabel, styles.createFormLabelFirst, { color: colors.text }]}>Project name *</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} value={newName} onChangeText={setNewName} placeholder="Project name" placeholderTextColor={colors.textMuted} />
                  <Text style={[styles.createFormLabel, { color: colors.text }]}>Description</Text>
                  <TextInput style={[styles.input, styles.inputMulti, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} value={newDescription} onChangeText={setNewDescription} placeholder="Description (optional)" placeholderTextColor={colors.textMuted} multiline />
                  <View style={styles.createActions}>
                    <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setShowCreate(false)}>
                      <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary }, creating && { opacity: 0.7 }]} onPress={handleCreate} disabled={creating}>
                      <Text style={styles.createBtnText}>{creating ? 'Creating...' : 'Create'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            ) : editingProject ? (
              <ScrollView contentContainerStyle={styles.createFormScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} style={styles.createFormScrollView}>
                <View style={[styles.createForm, { borderTopWidth: 0 }]}>
                  <Text style={[styles.createFormLabel, styles.createFormLabelFirst, { color: colors.text }]}>Project name *</Text>
                  <TextInput style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} value={editName} onChangeText={setEditName} placeholder="Project name" placeholderTextColor={colors.textMuted} />
                  <Text style={[styles.createFormLabel, { color: colors.text }]}>Description</Text>
                  <TextInput style={[styles.input, styles.inputMulti, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]} value={editDescription} onChangeText={setEditDescription} placeholder="Description (optional)" placeholderTextColor={colors.textMuted} multiline />
                  <View style={styles.createActions}>
                    <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={() => setEditingProject(null)}>
                      <Text style={[styles.cancelBtnText, { color: colors.textMuted }]}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary }, updating && { opacity: 0.7 }]} onPress={handleUpdateProject} disabled={updating}>
                      <Text style={styles.createBtnText}>{updating ? 'Saving...' : 'Save'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            ) : (
              <>
                {currentProject && isSupervisor && currentProject.join_code && (
                  <View style={[styles.joinCodeSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Text style={[styles.joinCodeLabel, { color: colors.textMuted }]}>Join code</Text>
                    <Text style={[styles.joinCodeValue, { color: colors.text }]} selectable>{currentProject.join_code}</Text>
                    <TouchableOpacity style={[styles.shareCodeBtn, { borderColor: colors.primary }]} onPress={handleShareJoinCode}>
                      <Ionicons name="share-outline" size={18} color={colors.primary} />
                      <Text style={[styles.shareCodeBtnText, { color: colors.primary }]}> Share code</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {projects.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Ionicons name="business-outline" size={48} color={colors.textMuted} />
                    <Text style={[styles.emptyText, { color: colors.text }]}>No projects yet</Text>
                    <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>Join with a code to get started</Text>
                    <TouchableOpacity style={[styles.joinProjectButton, { borderColor: colors.primary, marginTop: 24 }]} onPress={() => setShowJoin(true)}>
                      <Ionicons name="log-in-outline" size={20} color={colors.primary} />
                      <Text style={[styles.joinProjectButtonText, { color: colors.primary }]}> Join project</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <FlatList
                    data={projects}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.list}
                    renderItem={({ item }) => (
                      <View style={[styles.projectItemRow, { borderColor: colors.border }]}>
                        <TouchableOpacity
                          style={[styles.projectItem, { backgroundColor: colors.surface, borderColor: colors.border }, currentProject?.id === item.id && { borderColor: colors.primary, backgroundColor: colors.projectActiveItem }]}
                          onPress={() => handleSelect(item)}
                          activeOpacity={0.8}
                        >
                          <Text style={[styles.projectName, { color: colors.text }]}>{item.name}</Text>
                          {item.address && <Text style={[styles.projectAddress, { color: colors.textMuted }]}>{item.address}</Text>}
                          {currentProject?.id === item.id && (
                            <Ionicons name="checkmark-circle" size={20} color={colors.primary} style={styles.checkmark} />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.editProjectBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => startEditProject(item)}>
                          <Ionicons name="pencil" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    )}
                    ListFooterComponent={
                      <TouchableOpacity style={[styles.joinProjectButton, { borderColor: colors.primary }]} onPress={() => setShowJoin(true)}>
                        <Ionicons name="log-in-outline" size={20} color={colors.primary} />
                        <Text style={[styles.joinProjectButtonText, { color: colors.primary }]}> Join project</Text>
                      </TouchableOpacity>
                    }
                  />
                )}
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, maxWidth: 200 },
  triggerText: { fontSize: 15, fontWeight: '600', flex: 1 },
  modalWrapper: { flex: 1, paddingHorizontal: 20 },
  modalHandle: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 12, marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 24, fontWeight: '700' },
  closeButton: { fontSize: 17, fontWeight: '600' },
  list: { paddingTop: 8, paddingBottom: 16 },
  projectItemRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
  projectItem: { flex: 1, borderRadius: 12, padding: 16, flexDirection: 'column', borderWidth: 1 },
  editProjectBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  projectName: { fontSize: 17, fontWeight: '600' },
  projectAddress: { fontSize: 14, marginTop: 4 },
  checkmark: { position: 'absolute', right: 16, top: 16 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { fontSize: 20, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 15, textAlign: 'center' },
  createFormScrollView: { flex: 1 },
  createFormScroll: { flexGrow: 1, paddingBottom: 80 },
  createForm: { paddingTop: 20, paddingBottom: 24 },
  createFormLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, marginTop: 20 },
  createFormLabelFirst: { marginTop: 0 },
  input: { borderWidth: 1, borderRadius: 12, padding: 16, fontSize: 16 },
  inputMulti: { minHeight: 80, textAlignVertical: 'top', paddingTop: 14, marginTop: 8 },
  createActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '600' },
  createBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center' },
  createBtnText: { fontSize: 16, color: '#FFFFFF', fontWeight: '600' },
  joinProjectButton: { marginTop: 8, marginBottom: 24, padding: 16, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed', alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  joinProjectButtonText: { fontSize: 16, fontWeight: '600' },
  joinCodeSection: { marginHorizontal: 0, marginBottom: 16, padding: 16, borderRadius: 12, borderWidth: 1 },
  joinCodeLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4 },
  joinCodeValue: { fontSize: 22, fontWeight: '700', letterSpacing: 2 },
  shareCodeBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 12, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  shareCodeBtnText: { fontSize: 15, fontWeight: '600' },
});
