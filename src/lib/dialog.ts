import type { AlertButton } from 'react-native';
import { showDialog } from '../components/DialogHost';

/**
 * Remplace Alert.alert dans toute l'application : boîte de dialogue de l'app, même rendu sur téléphone
 * et sur le web. Les boîtes système ne sont plus jamais utilisées (sauf l'empreinte / Face ID, gérées par le téléphone).
 */
function alert(title: string, message?: string, buttons?: AlertButton[]) {
  showDialog(title, message, buttons);
}

export const Alert = { alert };
