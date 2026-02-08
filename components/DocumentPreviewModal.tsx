import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useTheme } from '../context/ThemeContext';

type DocumentPreviewModalProps = {
  visible: boolean;
  url: string | null;
  title: string;
  onClose: () => void;
};

export function DocumentPreviewModal({ visible, url, title, onClose }: DocumentPreviewModalProps) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: colors.background }]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.webViewContainer}>
          {!url ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading document…</Text>
            </View>
          ) : (
            <WebView
              source={{ uri: url }}
              style={[styles.webView, { width, height: height - (Platform.OS === 'ios' ? 100 : 80) }]}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.loadingWrap}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              )}
              scalesPageToFit
              javaScriptEnabled
              domStorageEnabled
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 56 : 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 17, fontWeight: '600', flex: 1, marginRight: 12 },
  closeBtn: { padding: 4, borderRadius: 8 },
  webViewContainer: { flex: 1 },
  webView: { flex: 1 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 15 },
});
