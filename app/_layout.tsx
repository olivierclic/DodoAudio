import React from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SettingsProvider } from '../contexts/SettingsContext';
import { AudioProvider } from '../contexts/AudioContext';
import { ErrorBoundary } from '../components/ErrorBoundary';

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <SettingsProvider>
        <AudioProvider>
          <Slot />
        </AudioProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}
