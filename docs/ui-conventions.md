# CourierChat UI Conventions

> This is a living guide. Major structural decisions may also be recorded as
> ADRs. This document is structured for eventual migration to a VuePress site
> (sibling project pattern, cf. Musebot).

## App shell

```
+---------+---------------------------------------------+
| Icon    | Header (sticky top)                          |
| Rail    |  [room name] [info]          [user menu]    |
| (left)  +---------------------------------------------+
|         |                                              |
| [logo]  | Main content (active room / chat view)       |
| [room1] |                                              |
| [room2] |                                              |
| [room3] |                                              |
| ...     |                                              |
| [+]     |                                              |
+---------+---------------------------------------------+
| Status bar (thin): connection state + heartbeat       |
+--------------------------------------------------------+
```

- **Icon rail (left):** narrow vertical rail of circular room icons, teal
  background (`background-primary`), sticky full-height. This preserves the
  original CourierChat nav design. The app logo sits at the top as the
  home/default icon.
- **Header (top):** sticky, spans the content area. Shows the current room
  name and room info (transport mode as a tooltip/title attribute, member
  count, etc.). User menu on the right (username, settings, about, logout).
- **Main content:** the active room / chat view. Fills remaining space.
- **Status bar (bottom):** thin strip showing connection state and heartbeat
  liveness indicator. Always visible but unobtrusive.

## Icon rail

The icon rail is the primary navigation between rooms. Each room is represented
by a circular icon.

- **Default icon:** the CourierChat logo (for the home/landing entry and as a
  fallback for rooms without a chosen icon).
- **Custom icon:** the room creator chooses an icon from the Nuxt Icon set
  (Iconify collections via `@nuxt/icon`) or enters an emoji as the icon.
- **Hover label effect (preserved from legacy):** on hover, the room name
  rotates into view to the right of the icon, using the ported `animNavHover`
  keyframe (rotate3d 90deg -> none, opacity 0 -> 1, transform-origin left
  center). The label is a pill-shaped element with `background-interactive`
  (orange) background and white text, positioned absolutely to the right of
  the icon. See `app/assets/css/animations.css` and the `navHover` animation in
  `tailwind.config.ts`.
- **Active state:** the active room's icon is highlighted (e.g. inset ring or
  brighter background). The active label can remain visible.
- **Create room:** a `+` icon at the bottom of the rail opens the create-room
  flow.
- **Responsive:** on mobile the rail may collapse to a drawer or remain as a
  thin icon-only strip; the hover-label effect is retained but triggered on tap
  for touch devices.

## Header

- **Left:** current room name (large, prominent).
- **Center/right of name:** room metadata - member count, transport mode
  (mesh/star/relay) shown as a subtle indicator with a tooltip for detail.
- **Far right:** user menu (username display + dropdown: settings, about,
  logout).
- The header is sticky and spans only the content area (right of the icon rail).

## Routing

File-based routing under `app/pages/`:

- `/login` - username claim form. The only auth step is providing a unique
  active username. No password, no email. On success, redirect to `/rooms`.
- `/rooms` - room list / landing after auth. Redirects to the default room or
  shows the create-room prompt if no rooms exist.
- `/rooms/[name]` - active chat room.
- `/settings` - user settings, connection info / debug panel (per ADR 0002
  transparency).
- `/about` - about page.

### Auth flow

- Unauthenticated users are redirected to `/login` from all routes except
  `/login` and `/about`.
- `/login` uses a minimal centered layout (the `auth` layout) with the
  legacy login animation (logo + form fade-in via the ported animation
  delays).
- On username claim success, the session is established (cookie per the
  README's session-identifier-only rule) and the user is redirected to
  `/rooms`.

## Layouts

`app/layouts/`:

- `default.vue` - the shell: icon rail + header + main + status bar. Used by
  all authenticated app pages.
- `auth.vue` - minimal centered layout for `/login`.
- `app/error.vue` - full-page error (Nuxt convention, not a layout).

## Status bar

- Thin strip at the bottom of the `default` layout.
- Connection state: disconnected / connecting / connected / relay-mode.
- Heartbeat liveness: a subtle pulsing dot indicating the heartbeat is active.
- The status bar reflects state passively; state changes also trigger toast
  notifications (see below).

## Toast notifications

- Used for connection state changes and other transient events (peer joined,
  peer left, file received, hub changed, etc.).
- Auto-dismiss after a short duration; user can dismiss manually.
- **Notification history:** a view (accessible from the header or status bar)
  shows the log of past notifications for the current session. History is
  in-memory only (consistent with ephemerality); it is cleared on
  disconnect/refresh.

## Component conventions

### Naming

- Vue components use Nuxt component naming conventions. Multi-word component
  names are required (ESLint rule `vue/multi-word-component-names` is currently
  off; revisit if it causes friction).
- Shell sub-components under `app/components/shell/`:
  - `ShellHeader.vue`, `ShellIconRail.vue`, `ShellStatusBar.vue`
- Feature components live with their feature (see DDD section below).
- Class/interface/type source files use StartCased filenames
  (e.g. `ChatRoom.ts`, `UsernameRegistry.ts`) per ADR 0001.

### Composition

- Prefer props down, events up. Use `defineProps` / `defineEmits` with
  TypeScript types.
- Extract a component when markup is reused or complex; inline simple
  one-off markup.
- Slots for content injection; scoped slots when the child needs to provide
  data to the slot content.

## Styling approach

- **Tailwind utility-first** for layout, spacing, color, typography.
- **`@apply`** in component `<style>` blocks only when a utility combination
  is reused across many elements within one component and inlining it would
  hurt readability.
- **Plain CSS** (in `app/assets/css/` or component `<style>` blocks) for:
  - Keyframe animations (Tailwind's `animation`/`keyframes` config covers the
    ported `navHover`; future complex animations may live in CSS).
  - Anything Tailwind can't express cleanly.
- **Theme tokens** from `tailwind.config.ts` (`background-primary`,
  `background-interactive`, `text-primary`, `text-content`,
  `text-content-inverted`, `text-error`, `courier-drop` shadow). Prefer these
  over raw color values.

## State & data flow

Per ADR 0001 (hybrid state management):

- **Pinia stores** for cross-cutting domain state:
  - `app/stores/Session.ts` - authenticated username, session state.
  - `app/stores/Connection.ts` - WebRTC connection state, transport mode.
  - `app/stores/Notifications.ts` - toast notification queue and history.
- **`useState` composables** for feature-local ephemeral state:
  - e.g. `app/features/rooms/composables/useRooms.ts` for the current room list
    and active room (if not needed cross-feature).
- **Props/events** for parent-child communication.
- Composables under `app/composables/` for cross-feature utilities (e.g.
  `useWebRtc.ts` if it spans features), feature-local composables under
  `app/features/<name>/composables/`.

## Forms & inputs

- Reusable input components under `app/components/forms/` (e.g.
  `TextInput.vue`, `IconButton.vue`).
- Validation: inline, composable-driven (`useValidation.ts` or similar).
- Error display: inline below the field, `text-error` color, with an icon.
- The login form is the first form to implement; it validates username
  uniqueness against the server.

## Feedback & states

Every view that loads data should handle:

- **Loading** - skeleton or spinner (replace the legacy `busy.gif` with a
  lightweight CSS spinner or `@nuxt/icon` spinner).
- **Empty** - friendly prompt (cf. the legacy "You're the first! Give people
  something to talk about!" copy).
- **Error** - inline error with retry action.
- **Offline / disconnected** - status bar reflects state; main view shows a
  non-blocking reconnect banner.

## Accessibility

- Use `NuxtRouteAnnouncer` (already in `app.vue`) for route changes.
- Keyboard navigation: all interactive elements reachable via Tab; the icon
  rail is keyboard-navigable.
- ARIA: roles for the icon rail (`navigation`), status bar (`status`), toast
  notifications (`alert`).
- Focus management: move focus to the message input on room entry; trap focus
  in modals.
- Reduced motion: respect `prefers-reduced-motion`; disable the
  `navHover` rotation and other animations when set.

## Icons

- `@nuxt/icon` is installed. Use the `<Icon>` component with Iconify
  collection names (e.g. `<Icon name="lucide:plus" />`).
- Default icon set to be chosen during feature implementation (Lucide is a
  reasonable default for UI chrome; emoji are allowed for room icons).
- Sizing via the `size` prop or Tailwind classes.

## Animations

- Page transitions: subtle fade via `NuxtPage` transition config.
- The ported `navHover` animation is used for the icon-rail hover-label effect.
- `.animated.slower` / `.animated.faster` utility classes are available for
  duration control.
- Reduced-motion: disable non-essential animations.
- New animations should be defined as keyframes in CSS or in
  `tailwind.config.ts` `keyframes`/`animation` and referenced via utility
  classes.

## Directory structure (DDD + Nuxt conventions)

```
app/
  app.vue
  error.vue
  assets/css/animations.css
  components/
    shell/
      ShellHeader.vue
      ShellIconRail.vue
      ShellStatusBar.vue
    forms/
      TextInput.vue
      IconButton.vue
  composables/        # cross-feature composables
  layouts/
    default.vue
    auth.vue
  pages/
    index.vue         # redirects to /rooms or /login
    login.vue
    rooms/
      index.vue
      [name].vue
    settings.vue
    about.vue
  features/
    rooms/
      components/
      composables/
      services/
      types/
    chat/
      components/
      composables/
      services/
      types/
    signaling/
      services/
      types/
    files/
      components/
      composables/
      services/
      types/
  stores/
    Session.ts
    Connection.ts
    Notifications.ts
server/
  routes/
  services/
  utils/
test/
  *.test.ts
```

Per ADR 0001: Nuxt conventions take precedence for placement; features group
related code within the Nuxt-appropriate location. Where Nuxt forces a
location (e.g. `pages/`), the file delegates to the feature.