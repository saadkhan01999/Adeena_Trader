/**
 * The placeholder while a screen's code arrives - normally never seen, because
 * every screen is preloaded in the background after sign-in (App.jsx).
 *
 * When it does show (a first visit on a slow link), it is a thin accent bar at
 * the top of the content, not a skeleton of a page: a skeleton that flashes
 * for 100ms reads as the whole app reloading.
 */
export default function RouteFallback() {
  return (
    <div className="relative h-1 overflow-hidden rounded-full bg-gold-100" role="status" aria-label="Loading">
      <div className="absolute inset-y-0 w-1/3 bg-gold-gradient animate-table-refresh" />
    </div>
  );
}
