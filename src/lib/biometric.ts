import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

/**
 * Déverrouillage par empreinte digitale (ou Face ID) une fois connecté.
 * Le mot de passe reste nécessaire à la première connexion ; ensuite, l'empreinte protège la session
 * conservée dans le trousseau sécurisé. Indisponible sur le web.
 */
const ENABLED = 'sdr.biometric.enabled';
const ASKED = 'sdr.biometric.asked';

export async function biometricAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  } catch {
    return false;
  }
}

export async function biometricEnabled(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  return (await SecureStore.getItemAsync(ENABLED)) === '1';
}

export async function setBiometricEnabled(on: boolean) {
  if (Platform.OS === 'web') return;
  if (on) await SecureStore.setItemAsync(ENABLED, '1');
  else await SecureStore.deleteItemAsync(ENABLED);
}

export async function wasAsked(): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  return (await SecureStore.getItemAsync(ASKED)) === '1';
}
export async function markAsked() {
  if (Platform.OS !== 'web') await SecureStore.setItemAsync(ASKED, '1');
}

/** Libellé adapté à l'appareil (empreinte, visage). */
export async function biometricLabel(): Promise<string> {
  if (Platform.OS === 'web') return 'empreinte';
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION) && !types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) return 'Face ID';
  } catch {
    /* empreinte par défaut */
  }
  return 'empreinte';
}

export async function authenticate(promptMessage = 'Déverrouiller BATIS'): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Annuler',
      fallbackLabel: 'Utiliser le code du téléphone',
      disableDeviceFallback: false,
    });
    return r.success;
  } catch {
    return false;
  }
}
