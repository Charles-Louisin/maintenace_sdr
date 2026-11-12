import { Alert as RNAlert, Platform, type AlertButton } from 'react-native';

/**
 * Remplace Alert.alert de React Native, qui ne fait RIEN sur le web.
 * Même signature : sur téléphone, boîte de dialogue native ; sur le web, window.alert / window.confirm.
 * Avec plusieurs boutons sur le web : « OK » déclenche le dernier bouton qui n'est pas « cancel ».
 */
function alert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    RNAlert.alert(title, message, buttons);
    return;
  }
  const text = message ? `${title}\n\n${message}` : title;
  const actions = (buttons ?? []).filter((b) => b.style !== 'cancel');
  const cancel = (buttons ?? []).find((b) => b.style === 'cancel');
  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }
  const primary = actions[actions.length - 1];
  if (window.confirm(`${text}\n\nOK = « ${primary?.text ?? 'Confirmer'} »`)) primary?.onPress?.();
  else cancel?.onPress?.();
}

export const Alert = { alert };
