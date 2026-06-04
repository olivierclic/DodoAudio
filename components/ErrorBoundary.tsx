import React, { Component, ReactNode, ErrorInfo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Colors } from '../constants/theme';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: '' };

  static getDerivedStateFromError(err: Error) {
    return { hasError: true, error: err?.message ?? 'Unknown error' };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Erreur</Text>
          <Text style={styles.msg}>{this.state.error}</Text>
          <Pressable
            style={styles.btn}
            onPress={() => this.setState({ hasError: false, error: '' })}
          >
            <Text style={styles.btnText}>Réessayer</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', padding: 24 },
  title: { color: Colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 12 },
  msg: { color: Colors.textSecondary, fontSize: 14, textAlign: 'center', marginBottom: 24 },
  btn: { backgroundColor: Colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
