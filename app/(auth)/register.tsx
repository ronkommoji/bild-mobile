import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { Link } from 'expo-router';
import { useApp } from '../../context/AppContext';
import { useTheme } from '../../context/ThemeContext';

const TRADES = [
  { value: 'electrician', label: 'Electrician' },
  { value: 'plumber', label: 'Plumber' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'general', label: 'General Labor' },
  { value: 'other', label: 'Other' },
];

export default function RegisterScreen() {
  const { signUp } = useApp();
  const { colors } = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [trade, setTrade] = useState('general');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    const { error } = await signUp(email.trim(), password, fullName.trim(), trade);
    setLoading(false);
    if (error) {
      Alert.alert('Registration Failed', error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Image source={require('../../assets/icon.png')} style={styles.logoImage} />
          <Text style={[styles.logo, { color: colors.primary }]}>Bild</Text>
          <Text style={[styles.tagline, { color: colors.textLight }]}>Create your account</Text>
        </View>

        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.text }]}>Full Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={fullName} onChangeText={setFullName} placeholder="John Smith" placeholderTextColor={colors.textMuted} autoCapitalize="words"
          />
          <Text style={[styles.label, { color: colors.text }]}>Email</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={email} onChangeText={setEmail} placeholder="you@company.com" placeholderTextColor={colors.textMuted}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
          />
          <Text style={[styles.label, { color: colors.text }]}>Password</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text }]}
            value={password} onChangeText={setPassword} placeholder="Min. 6 characters" placeholderTextColor={colors.textMuted} secureTextEntry
          />
          <Text style={[styles.label, { color: colors.text }]}>Trade</Text>
          <View style={styles.tradeContainer}>
            {TRADES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.tradeChip, { backgroundColor: colors.inputBg, borderColor: colors.border }, trade === t.value && { backgroundColor: colors.primary, borderColor: colors.primary }]}
                onPress={() => setTrade(t.value)}
              >
                <Text style={[styles.tradeChipText, { color: colors.text }, trade === t.value && { color: '#FFFFFF' }]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }, loading && styles.buttonDisabled]}
            onPress={handleRegister} disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Creating account...' : 'Create Account'}</Text>
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textMuted }]}>Already have an account? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity><Text style={[styles.linkText, { color: colors.primary }]}>Sign In</Text></TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 32 },
  logoImage: { width: 72, height: 72, borderRadius: 18, marginBottom: 10 },
  logo: { fontSize: 48, fontWeight: '800', letterSpacing: -2 },
  tagline: { fontSize: 18, marginTop: 8 },
  form: { width: '100%' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  input: { borderWidth: 1, borderRadius: 12, padding: 16, fontSize: 16 },
  tradeContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tradeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },
  tradeChipText: { fontSize: 14, fontWeight: '500' },
  button: {
    borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 32,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { fontSize: 15 },
  linkText: { fontSize: 15, fontWeight: '600' },
});
