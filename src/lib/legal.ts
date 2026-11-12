/**
 * Textes juridiques de BATIS : politique de confidentialité, conditions d'utilisation, mentions légales.
 * Ils décrivent ce que l'application fait réellement ; mettez-les à jour si son fonctionnement change.
 *
 * À COMPLÉTER : les informations de l'éditeur ci-dessous (laissées vides, elles s'affichent « À compléter »).
 */
export const PUBLISHER = {
  /** Nom et prénom (ou raison sociale) de la personne qui publie l'application */
  name: 'YIMBNE Charles Louisin',
  /** Adresse e-mail de contact pour les questions et demandes sur les données */
  email: 'clynlouisin@gmail.com',
  /** Ville et pays */
  location: 'PK33, Douala, Cameroun',
  /** Hébergeur du serveur de production (nom, adresse) — ex. « Render Services, Inc., San Francisco, États-Unis » */
  serverHost: 'Railway Corporation — Railway, San Francisco, Californie, États-Unis',
};

/** Date de dernière mise à jour des textes (à changer à chaque modification) */
export const LEGAL_UPDATED_AT = '12 novembre 2026';

const fill = (v: string) => v.trim() || 'À compléter';

export type LegalDocId = 'confidentialite' | 'conditions' | 'mentions-legales';
export type LegalSection = { title: string; paragraphs: string[] };
export type LegalDoc = { title: string; intro: string; sections: LegalSection[] };

export const LEGAL_LINKS: { id: LegalDocId; title: string; subtitle: string }[] = [
  { id: 'confidentialite', title: 'Politique de confidentialité', subtitle: 'Données traitées et vos droits' },
  { id: 'conditions', title: 'Conditions d’utilisation', subtitle: 'Règles d’usage de l’application' },
  { id: 'mentions-legales', title: 'Mentions légales', subtitle: 'Éditeur et hébergement' },
];

export function getLegalDoc(id: LegalDocId): LegalDoc {
  switch (id) {
    case 'confidentialite':
      return {
        title: 'Politique de confidentialité',
        intro:
          'BATIS est un outil personnel de suivi de la maintenance des Salles du Royaume, utilisé par une seule personne : son propriétaire. Cette page explique quelles données sont enregistrées, pourquoi, où elles sont conservées et comment les faire corriger ou supprimer.',
        sections: [
          {
            title: 'Responsable du traitement',
            paragraphs: [`Le responsable du traitement est l’éditeur de l’application : ${fill(PUBLISHER.name)}. Contact : ${fill(PUBLISHER.email)}.`],
          },
          {
            title: 'Données enregistrées',
            paragraphs: [
              'Compte du propriétaire : adresse e-mail, nom affiché, téléphone facultatif. Le mot de passe et le code de récupération ne sont jamais conservés en clair : seule une empreinte chiffrée (Argon2id) est stockée.',
              'Contacts (volontaires et frères responsables) : nom, numéro de téléphone, assemblée, disponibilités, historique des missions et des appels. Ces personnes n’ont pas de compte et ne se connectent pas à l’application.',
              'Activité de maintenance : salles, assemblées, interventions prévues, documents importés (programmes PDF, Excel, images), réponses reçues collées dans l’application et rapports mensuels générés.',
              'Données techniques : jeton de notification de l’appareil, sessions de connexion (expirées après 30 jours sans usage) et journal des actions importantes (connexions, validations, modifications).',
            ],
          },
          {
            title: 'Pourquoi ces données sont traitées',
            paragraphs: [
              'Uniquement pour organiser les interventions de maintenance : planifier, répartir les appels entre volontaires, préparer les messages WhatsApp, enregistrer les comptes rendus et produire le rapport mensuel. Le traitement repose sur l’intérêt légitime de cette organisation.',
              'Aucune publicité, aucune mesure d’audience, aucun profilage commercial. Les données ne sont ni vendues ni louées.',
            ],
          },
          {
            title: 'Services utilisés pour faire fonctionner l’application',
            paragraphs: [
              'Base de données : MongoDB Atlas (MongoDB, Inc.).',
              'Stockage des fichiers importés et des rapports : UploadThing (Ping Labs, Inc.). Les fichiers sont accessibles par une adresse longue et impossible à deviner ; l’application ne la communique qu’au propriétaire connecté, via un lien temporaire signé.',
              'Analyse automatique par intelligence artificielle : OpenRouter (OpenRouter, Inc.), qui transmet le texte au fournisseur du modèle choisi. Elle sert uniquement à lire les documents importés et, sur demande explicite, à pré-remplir une réponse reçue. Le texte d’origine n’est jamais modifié et tout résultat doit être validé à la main.',
              'Notifications : service de notifications d’Expo (650 Industries, Inc.), qui reçoit le jeton de l’appareil et le texte du rappel.',
              'Ces prestataires peuvent être situés hors de votre pays, notamment aux États-Unis. Ils ne traitent les données que pour rendre le service demandé.',
            ],
          },
          {
            title: 'Sur le téléphone',
            paragraphs: [
              'Les jetons de connexion sont gardés dans le stockage sécurisé du téléphone. Les données déjà consultées sont gardées localement pour fonctionner hors connexion et sont effacées à la déconnexion. Les brouillons de réponses restent sur le téléphone jusqu’à leur enregistrement sur le serveur.',
              'Empreinte digitale et Face ID : la reconnaissance est faite par le système du téléphone. BATIS ne reçoit jamais votre empreinte ni l’image de votre visage, seulement la réponse « reconnu » ou « non reconnu ».',
              'Permissions demandées : notifications (rappels d’appels et de suivis), biométrie (déverrouillage) et accès aux fichiers que vous choisissez vous-même d’importer.',
            ],
          },
          {
            title: 'Durée de conservation',
            paragraphs: [
              'Les données sont conservées tant qu’elles servent au suivi de la maintenance, puis supprimées par le propriétaire. Les sessions expirent après 30 jours sans usage. Un message envoyé par WhatsApp reste soumis aux règles de WhatsApp, indépendamment de BATIS.',
            ],
          },
          {
            title: 'Sécurité',
            paragraphs: [
              'Échanges chiffrés (HTTPS) en production, mots de passe hachés, sessions courtes renouvelées à chaque usage, verrouillage du compte après 5 tentatives échouées, verrouillage de l’application après 2 minutes en arrière-plan.',
            ],
          },
          {
            title: 'Vos droits',
            paragraphs: [
              'Toute personne dont les coordonnées figurent dans BATIS (volontaire, frère responsable) peut demander à y accéder, à les faire corriger ou à les faire supprimer, et peut s’opposer à leur utilisation. Écrivez à : ' +
                `${fill(PUBLISHER.email)}. Une réponse est apportée dans un délai d’un mois.`,
              'Vous pouvez aussi saisir l’autorité de protection des données personnelles de votre pays.',
            ],
          },
          {
            title: 'Modifications',
            paragraphs: [`Cette politique peut évoluer avec l’application. Dernière mise à jour : ${LEGAL_UPDATED_AT}.`],
          },
        ],
      };

    case 'conditions':
      return {
        title: 'Conditions d’utilisation',
        intro:
          'Ces conditions encadrent l’usage de BATIS. En vous connectant, vous les acceptez. L’application n’a pas d’inscription publique : un seul compte existe, celui de son propriétaire.',
        sections: [
          {
            title: 'Objet',
            paragraphs: [
              'BATIS aide à suivre la maintenance de plusieurs Salles du Royaume : import des programmes, planning, répartition des appels entre volontaires, messages WhatsApp préparés, comptes rendus et rapport mensuel.',
            ],
          },
          {
            title: 'Accès et compte',
            paragraphs: [
              'L’accès est réservé au propriétaire du compte. Gardez votre mot de passe et votre code de récupération pour vous seul ; toute action faite avec votre compte est réputée faite par vous.',
              'Après 5 tentatives de connexion échouées, le compte est bloqué 15 minutes. Un mot de passe oublié se réinitialise uniquement avec le code de récupération.',
            ],
          },
          {
            title: 'Données de tiers',
            paragraphs: [
              'Vous enregistrez des coordonnées de volontaires et de responsables. Vous vous engagez à n’y mettre que ce qui est utile à la maintenance, à les tenir à jour et à respecter leurs demandes de correction ou de suppression.',
              'Aucun message n’est envoyé automatiquement : chaque message WhatsApp est ouvert, relu et envoyé par vous.',
            ],
          },
          {
            title: 'Intelligence artificielle',
            paragraphs: [
              'Les données extraites par l’IA sont des propositions. Elles restent en brouillon tant que vous ne les avez pas vérifiées et validées. Vous restez responsable du contenu validé et des rapports transmis.',
            ],
          },
          {
            title: 'Disponibilité',
            paragraphs: [
              'L’application est fournie telle quelle, sans garantie de disponibilité permanente. Une coupure du serveur ou d’un prestataire peut la rendre temporairement inutilisable ; les données déjà chargées restent consultables hors connexion.',
              'Pensez à garder une copie des rapports mensuels importants.',
            ],
          },
          {
            title: 'Usage interdit',
            paragraphs: [
              'Il est interdit de tenter d’accéder au serveur sans autorisation, de contourner ses protections, ou d’utiliser l’application à d’autres fins que l’organisation de la maintenance.',
            ],
          },
          {
            title: 'Modifications',
            paragraphs: [`Ces conditions peuvent évoluer avec l’application. Dernière mise à jour : ${LEGAL_UPDATED_AT}.`],
          },
        ],
      };

    case 'mentions-legales':
      return {
        title: 'Mentions légales',
        intro: 'Informations sur l’éditeur et l’hébergement de l’application BATIS.',
        sections: [
          {
            title: 'Éditeur',
            paragraphs: [
              `Nom : ${fill(PUBLISHER.name)}`,
              `Localisation : ${fill(PUBLISHER.location)}`,
              `Contact : ${fill(PUBLISHER.email)}`,
              'BATIS est une application à usage personnel, distribuée hors des boutiques d’applications. Elle n’est ni éditée ni approuvée par une organisation religieuse.',
            ],
          },
          {
            title: 'Directeur de la publication',
            paragraphs: [fill(PUBLISHER.name)],
          },
          {
            title: 'Hébergement',
            paragraphs: [
              `Serveur de l’application : ${fill(PUBLISHER.serverHost)}`,
              'Base de données : MongoDB, Inc. — MongoDB Atlas, 1633 Broadway, New York, NY 10019, États-Unis.',
              'Fichiers : Ping Labs, Inc. — UploadThing, États-Unis.',
              'Notifications : 650 Industries, Inc. — Expo, Palo Alto, Californie, États-Unis.',
            ],
          },
          {
            title: 'Propriété intellectuelle',
            paragraphs: [
              'Le nom BATIS, son logo, son interface et son code sont la propriété de leur éditeur. Toute reproduction sans autorisation est interdite. Les documents importés restent la propriété de leurs auteurs.',
            ],
          },
          {
            title: 'Données personnelles',
            paragraphs: [
              'Le traitement des données est décrit dans la politique de confidentialité, accessible depuis l’écran de connexion et depuis « Registres et paramètres ».',
            ],
          },
        ],
      };
  }
}
