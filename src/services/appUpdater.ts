import { Alert } from 'react-native';

/**
 * Vérifie si une nouvelle version est disponible via Firebase App Distribution
 * et affiche une alerte in-app pour inviter l'utilisateur à mettre à jour.
 *
 * Ne fait rien en mode dev ou si le SDK n'est pas disponible.
 */
export async function checkForAppUpdate(): Promise<void> {
  if (__DEV__) return;

  try {
    const { default: appDistribution } = await import('@react-native-firebase/app-distribution');
    const release = await appDistribution().checkForUpdate();

    if (!release.isUpdateAvailable) return;

    Alert.alert(
      'Mise à jour disponible',
      `Une nouvelle version de Fläag est disponible${release.displayVersion ? ` (${release.displayVersion})` : ''}. Voulez-vous mettre à jour maintenant ?`,
      [
        { text: 'Plus tard', style: 'cancel' },
        {
          text: 'Mettre à jour',
          onPress: () => appDistribution().updateApp(),
        },
      ]
    );
  } catch {
    // Silently fail — non critique, ne doit pas bloquer l'app
  }
}
