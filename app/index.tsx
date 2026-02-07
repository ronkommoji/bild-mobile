import { Redirect } from 'expo-router';
import { useApp } from '../context/AppContext';

export default function Index() {
  const { session, authLoading } = useApp();

  if (authLoading) return null;

  if (session) {
    return <Redirect href="/(tabs)/today" />;
  }

  return <Redirect href="/(auth)/login" />;
}
