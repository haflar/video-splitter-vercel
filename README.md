# Split 120

PWA mobile/desktop qui découpe une vidéo en MP4 de **120 000 000 octets maximum**.

## Architecture Vercel
- Compatible avec un **Vercel Blob privé**.
- Upload direct navigateur -> Vercel Blob privé (multipart pour les gros fichiers).
- La vidéo ne traverse pas la limite de payload des Vercel Functions.
- Les Functions créent des URLs GET temporaires signées pour que FFmpeg lise la vidéo privée directement depuis Blob.
- Chaque partie est produite séparément par FFmpeg dans `/tmp`, puis renvoyée dans le Blob privé.
- Les téléchargements utilisent des URLs signées temporaires : les vidéos ne deviennent jamais publiques.
- La vidéo source est supprimée après le découpage.
- L'utilisateur peut supprimer les parties depuis l'interface.
- Les vieux fichiers sont nettoyés à la prochaine ouverture de l'application.

## Déploiement
1. Créer/ouvrir le projet Vercel depuis ce dossier.
2. Dans **Storage**, créer un store **Blob Private** et le connecter au projet.
3. Déployer/redeploy.
4. Ouvrir l'URL sur le téléphone puis **Ajouter à l'écran d'accueil**.

## Code d'accès
`V120-I4IFNOZJ`

## Limites pratiques
- Le découpage rapide utilise `-c copy`, idéal pour les MP4/MOV habituels de téléphone.
- Chaque Function produit une partie d'environ 108 Mo cible et vérifie qu'elle reste <= 120 000 000 octets.
- Sur les plans avec une durée de Function limitée, une partie doit finir avant le timeout du plan.
- trigger deploy
