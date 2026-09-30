# CLAUDE.md

Ce fichier définit les pratiques de code à respecter dans ce projet.

## Langage

Le projet est écrit en **TypeScript**.

- Le compilateur est configuré en mode strict (`"strict": true` dans `tsconfig.json`).
- Pas de `any` : utiliser des types explicites, ou `unknown` puis un affinage de type.
- Les dépendances injectées sont typées par des `interface` (voir « Injection de dépendances »).
- Les fichiers de test se terminent par `.test.ts`.

## Projet

Backend d'une application mobile de pierre-feuille-ciseaux avec classement. Chaque serveur est dans son propre dossier à la racine, avec son propre `package.json`, son `src/` et ses `__tests__/` :

- `account-server/` : API HTTP des comptes (inscription, connexion), du classement Elo et des statistiques de jeu, délivre les jetons d'accès.
- `game-server/` : serveur de jeu WebSocket (matchmaking et parties), n'accepte que les joueurs authentifiés et envoie les résultats des matchs à account-server.
- `bot-server/` : fait jouer des bots comme des joueurs ordinaires (un compte chacun, connexion WebSocket) quand un joueur attend seul trop longtemps.
- `game-client/` : client web React pour jouer au jeu.

Stack serveur : Node.js, `fastify` (HTTP), `ws` (WebSocket), `zod` (schémas de validation), `node:sqlite` (base de données), `jose` (JWT), `vitest` (tests), `tsx` (dev).
Stack client : React, Vite, `vitest` (tests).

## Architecture des API / serveurs

Tout serveur ou API est découpé en cinq couches, chacune dans son propre dossier :

```
src/
├── route/        # Entrées / sorties HTTP, schémas de validation
├── service/      # Orchestration : glue entre repository, model et integration
├── model/        # Logique métier : classes, règles, changements d'état
├── repository/   # Chargement / sauvegarde des models depuis les datastores
└── integration/  # Wrappers vers les API externes

__tests__/
├── unit/         # Tests unitaires, même arborescence que src/
└── e2e/          # Tests de bout en bout via les endpoints HTTP
```

### Sens des dépendances

```
route → service → repository → model
                → model
                → integration
```

- `route` n'appelle **que** `service`.
- `service` est la seule couche qui combine `repository`, `model` et `integration`.
- `repository` construit et persiste des `model`, mais ne contient pas de logique métier.
- `model` ne dépend d'**aucune** autre couche (ni base de données, ni HTTP, ni API externe).
- `integration` ne dépend d'aucune autre couche ; elle expose des méthodes simples et typées.

Une couche n'importe jamais une couche située au-dessus d'elle.

---

### `model/` — Logique métier

- Des classes qui représentent les objets du domaine.
- Contiennent les **règles métier** et les **méthodes qui changent l'état** de l'objet (ex. `order.cancel()`, `account.debit(amount)`).
- Une méthode qui modifie l'état vérifie ses invariants et lève une erreur métier si la règle n'est pas respectée.
- Aucun accès I/O : pas de requête base de données, pas d'appel HTTP, pas de lecture de fichier.
- C'est ici que se trouve l'essentiel de la logique : si une règle peut être exprimée dans un model, elle doit l'être.

### `repository/` — Accès aux datastores

- Charge les models depuis un datastore (base de données, cache, fichier…) et les sauvegarde.
- Méthodes typiques : `get(id)`, `save(model)`, éventuellement `find…(critères)` et `delete(id)`.
- Retourne toujours des **instances de model**, jamais des lignes brutes ou des objets du driver.
- Gère la conversion model ↔ format de stockage.
- Aucune règle métier.

### `integration/` — API externes

- Un wrapper par service externe (paiement, e-mail, API partenaire…).
- Encapsule le client HTTP/SDK, l'authentification, les retries et le mapping des erreurs.
- Expose des méthodes métier explicites (ex. `sendEmail(to, subject, body)`) et des types propres au projet, pas les types bruts de l'API externe.
- Aucune règle métier.

### `service/` — Orchestration

- Fait la glue entre `repository`, `model` et `integration`.
- Déroulé typique d'un cas d'usage :
  1. charger les models via les repositories ;
  2. appeler les méthodes des models pour appliquer la logique métier ;
  3. appeler les integrations si nécessaire ;
  4. sauvegarder les models via les repositories ;
  5. retourner le résultat.
- Gère les transactions et la coordination entre plusieurs models.
- Ne contient pas de règle métier propre à un objet : si le service modifie directement les attributs d'un model ou teste une règle métier, cette logique doit être déplacée dans le model.
- Ne connaît rien du HTTP (pas de requête, réponse, status code).

### `route/` — Entrées / sorties du serveur

- Déclare les endpoints (méthode, chemin).
- Définit les **schémas de validation** des entrées (body, params, query) et des sorties.
- Valide la requête, appelle le service, formate la réponse.
- Traduit les erreurs métier/service en codes HTTP.
- Aucune logique métier, aucun accès direct aux repositories, models ou integrations.

---

## Injection de dépendances

Toutes les dépendances entre couches sont **injectées**, jamais instanciées ou importées directement là où elles sont utilisées. L'objectif est de pouvoir remplacer facilement n'importe quelle dépendance par un mock dans les tests.

- Chaque classe reçoit ses dépendances **par son constructeur** (ex. un service reçoit ses repositories et ses integrations).
- Une classe ne fait jamais `new` sur une de ses dépendances et n'utilise pas de singleton global importé.
- Les dépendances sont typées par une **interface** (ou un type abstrait), pas par l'implémentation concrète, pour qu'un mock puisse la remplacer.
- L'assemblage (création des instances et câblage entre elles) est fait en un seul endroit, au démarrage de l'application (ex. `src/container.ts` ou `src/main.ts`).
- Les models ne reçoivent pas de dépendances : ils restent de purs objets métier.

---

## Tests

Les tests sont séparés du code source, dans le dossier `__tests__/` à la racine du projet :

### `__tests__/unit/` — Tests unitaires

- Reproduisent l'arborescence de `src/` : le test de `src/service/order-service.ts` est dans `__tests__/unit/service/order-service.test.ts`.
- Testent une seule classe à la fois ; toutes ses dépendances sont mockées grâce à l'injection de dépendances :
  - `model` : testé directement, sans mock (pas de dépendance) ;
  - `service` : testé avec des repositories et integrations mockés ;
  - `route` : testée avec un service mocké ;
  - `repository` / `integration` : testés avec le driver ou le client HTTP mocké.
- Aucun accès réel à une base de données, au réseau ou à une API externe.

### `__tests__/e2e/` — Tests de bout en bout

- Appellent le serveur via ses endpoints HTTP, comme le ferait un client.
- Traversent toutes les couches réelles : route → service → model → repository.
- Utilisent un datastore de test dédié ; les API externes sont remplacées par des fausses implémentations injectées dans le container.
- Un fichier par ressource ou parcours métier (ex. `__tests__/e2e/order.test.ts`).

---

## Exemple

Cas d'usage « annuler une commande et rembourser le client » :

```ts
// model/order.ts
class Order {
  cancel() {
    if (this.status === "shipped") throw new OrderAlreadyShippedError(this.id);
    this.status = "cancelled";
  }
}

// repository/order-repository.ts
interface IOrderRepository {
  get(id: string): Promise<Order>;
  save(order: Order): Promise<void>;
}

class OrderRepository implements IOrderRepository {
  constructor(private readonly db: Database) {}

  async get(id: string): Promise<Order> { /* lecture DB → new Order(...) */ }
  async save(order: Order): Promise<void> { /* Order → écriture DB */ }
}

// integration/payment-client.ts
interface IPaymentClient {
  refund(paymentId: string, amount: number): Promise<void>;
}

class PaymentClient implements IPaymentClient {
  constructor(private readonly httpClient: HttpClient, private readonly apiKey: string) {}
  async refund(paymentId: string, amount: number): Promise<void> { /* appel API externe */ }
}

// service/order-service.ts
class OrderService {
  constructor(
    private readonly orderRepository: IOrderRepository,
    private readonly paymentClient: IPaymentClient,
  ) {}

  async cancelOrder(orderId: string): Promise<Order> {
    const order = await this.orderRepository.get(orderId);
    order.cancel();
    await this.paymentClient.refund(order.paymentId, order.total);
    await this.orderRepository.save(order);
    return order;
  }
}

// route/order-route.ts
const cancelOrderSchema = { params: { orderId: "string" } };

function createOrderRoutes(orderService: IOrderService) {
  router.post("/orders/:orderId/cancel", validate(cancelOrderSchema), async (req, res) => {
    const order = await orderService.cancelOrder(req.params.orderId);
    res.status(200).json(toOrderResponse(order));
  });
  return router;
}

// container.ts — seul endroit où les instances sont créées et câblées
const orderRepository = new OrderRepository(db);
const paymentClient = new PaymentClient(httpClient, config.paymentApiKey);
const orderService = new OrderService(orderRepository, paymentClient);
app.use(createOrderRoutes(orderService));

// __tests__/unit/service/order-service.test.ts
const orderRepository = { get: mock(), save: mock() };
const paymentClient = { refund: mock() };
const service = new OrderService(orderRepository, paymentClient);
```
