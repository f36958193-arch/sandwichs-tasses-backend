# La Kribienne — Backend API

Serveur pour l'application La Kribienne. Écrit uniquement avec les
modules natifs de Node.js — **aucune installation (`npm install`)
n'est nécessaire**, juste avoir Node.js installé sur ton ordinateur.

## Démarrer le serveur

1. Installe Node.js si ce n'est pas déjà fait : https://nodejs.org (version 18 ou plus récente)
2. Ouvre un terminal dans ce dossier (`backend/`)
3. Lance :

```
node server.js
```

Tu devrais voir :
```
La Kribienne — API démarrée sur http://localhost:3000
```

Le serveur reste allumé tant que le terminal est ouvert. Pour l'arrêter : `Ctrl + C`.

## Où sont les données ?

Tout est sauvegardé automatiquement dans le fichier `data.json` qui
apparaît dans ce dossier au premier démarrage. Les photos uploadées
sont sauvegardées dans le dossier `uploads/`. Contrairement au
prototype précédent, rien n'est perdu quand tu fermes le navigateur
ou redémarres le serveur.

## Routes disponibles

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/accounts` | Créer un compte (ou se reconnecter si l'email existe déjà) |
| GET | `/api/accounts/:email` | Récupérer un compte |
| GET | `/api/dishes` | Liste des plats |
| POST | `/api/admin/dishes` | Ajouter un plat (admin) |
| PATCH | `/api/admin/dishes/:id` | Modifier un plat (admin) |
| DELETE | `/api/admin/dishes/:id` | Retirer un plat (admin) |
| POST | `/api/orders` | Envoyer une commande |
| GET | `/api/orders?email=...` | Historique des commandes d'un client |
| GET | `/api/admin/orders` | Toutes les commandes (admin) |
| PATCH | `/api/admin/orders/:id` | Répondre à une commande (admin) |
| POST | `/api/reservations` | Envoyer une réservation |
| GET | `/api/reservations?email=...` | Historique des réservations d'un client |
| GET | `/api/admin/reservations` | Toutes les réservations (admin) |
| PATCH | `/api/admin/reservations/:id` | Répondre à une réservation (admin) |
| GET | `/api/admin/stats` | Statistiques (visiteurs, commandes) |

## Prochaine étape

Ce serveur tourne actuellement seulement sur ton ordinateur
(`localhost`). Pour que l'app soit accessible à tout le monde depuis
internet, il faudra l'héberger (ex: Render, Railway) — et connecter
le fichier `app-restaurant-full.html` à ces routes au lieu de garder
les données en mémoire du navigateur.
