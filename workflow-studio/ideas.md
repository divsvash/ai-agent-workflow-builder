# Workflow Studio — Frontend Design Direction

## Three stylistic approaches

### Theme Name: Command Room
Very Brief Intro: A quiet, editorial control room for serious automation work: warm paper surfaces, ink-dark navigation, and one precise signal color. It makes execution state feel legible and consequential without borrowing from the familiar neon workflow-tool aesthetic.
Probability: 0.07

### Theme Name: Glass Circuit
Very Brief Intro: A restrained, low-contrast interface with translucent panels, cool graphite, and restrained cyan for active system signals. The mood is technical and observant, with depth coming from layering rather than glow.
Probability: 0.03

### Theme Name: Field Notes
Very Brief Intro: A utilitarian notebook for building and reviewing automations: chalky surfaces, compact annotations, and tactile status markers. It feels human and operational while keeping the execution timeline in the foreground.
Probability: 0.09

## Selected approach: Command Room

### Design Movement
Contemporary editorial modernism, borrowing the compositional discipline of a newsroom dashboard and the material honesty of industrial wayfinding. The interface should feel like an instrument panel for operators, not a canvas toy.

### Core Principles
1. **Execution before decoration.** The live run timeline is the primary visual object; the builder is a focused supporting surface.
2. **Signal hierarchy.** Every color, weight, and marker communicates a meaningful state: ready, running, paused, complete, or failed.
3. **Editorial rhythm.** Use strong type, deliberate whitespace, offset panels, and short labels to make dense technical information scannable.
4. **Backend honesty.** The frontend renders only states and operations supplied by the GraphQL/Nhost layer. Loading, empty, error, and unknown states remain explicit.

### Color Philosophy
The base is a warm mineral canvas rather than a generic white, paired with deep blue-black ink for navigation and high-contrast reading. **Signal orange** is the ownable brand accent: it is energetic enough to call attention to a paused approval or active run, but not so loud that it turns every control into an alert. Muted sage communicates completed work and dusty red is reserved for failures. Color is sparse and semantic.

### Layout Paradigm
Use a persistent left rail for organization and navigation, a narrow context header for the current workspace, and an asymmetric main stage where the execution timeline occupies the broad left column while usage, trigger, and run metadata occupy a right-side ledger. The workflow editor uses a vertical step list with a slim sequence spine, not a large node canvas.

### Signature Elements
1. A **signal-knot mark**: three offset lines joining into a small square, used in the brand lockup and as the favicon.
2. **Run rail markers**: numbered circles connected by a hairline spine; each status owns a marker treatment.
3. **Ledger labels**: compact uppercase mono labels with short orange underlines, used for context and metadata headings.

### Interaction Philosophy
Interactions should feel like operating a precise console. Hovering reveals affordances without shifting layout; selected steps gain a quiet orange edge; destructive or consequential actions ask for explicit confirmation only when the backend operation requires it. The UI never pretends a mutation succeeded: after Run or Approve, it shows an in-flight state and waits for refreshed query or subscription data.

### Animation
Use short, physical transitions under 220ms for hover, focus, buttons, and panel changes. Run status changes may fade and translate the marker by a few pixels to make live updates perceptible, while the layout itself stays stable. The paused approval state may use a slow, low-amplitude breathing border, never a flashing alert. Respect `prefers-reduced-motion` and remove non-essential motion when requested.

### Typography System
Use **Space Grotesk** for display text and UI headings, **DM Sans** for readable interface copy, and **IBM Plex Mono** for status labels, IDs, timestamps, and compact metadata. Headings are tight and medium-to-bold, body copy is 14–15px with generous line height, and mono labels are uppercase with modest tracking. Avoid using a single font weight across the product.

### Brand Essence
Workflow Studio is an operator-grade frontend for teams who need to build, run, and inspect AI workflows without losing sight of the real execution state. It is **clear, grounded, exacting**.

### Brand Voice
Headlines are concise and operational. CTAs name the action and the object. Microcopy explains what the interface knows and what it is waiting to learn from the backend. Avoid generic onboarding language.

Example lines:

> See the run, not just the recipe.

> Approval is waiting on an operator.

### Wordmark & Logo
The mark is a compact signal-knot: two cobalt/navy rails converge into an orange square, suggesting triggers becoming action. The wordmark uses a custom-spaced uppercase `WORKFLOW` above a smaller `STUDIO`, aligned to the mark rather than rendered as a default text logo.

### Signature Brand Color
**Signal Orange — `#E56B3F`**. This color belongs to Workflow Studio because it marks the exact point where automation hands control back to a person.

### Frontend Scope Guardrails
This project implements only the frontend. It does not create database migrations, backend functions, authorization rules, fake execution behavior, or invented API semantics. GraphQL operation documents are isolated in a typed client layer and are intentionally adjustable to the actual schema supplied by the backend agents. The demo view may use clearly labeled presentation states only where no backend configuration is available, and must not imply that mocked data is real.

## Style Decisions

The execution timeline is the dominant artifact on the main screen; summary metrics now sit below the run surface as supporting ledger information. Signal Orange `#E56B3F` remains sparse and semantic, reserved for active or paused states, selected edges, and primary execution actions. The numbered hairline rail is treated as the recurring product motif, and the frontend labels its empty rail as waiting for live backend data rather than fabricating a run.
