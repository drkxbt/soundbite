const ICONS = {
  x: '<path class="fill" d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.18h1.7L7.4 4.73H5.58l11.09 14.45Z"/>',
  star: '<path d="m12 3.8 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8Z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
};

const svg = (paths: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;

let panel: HTMLElement | null = null;

/**
 * After a download, a small panel in the corner asks for a follow on X and a star on GitHub. It sits in the top
 * layer without blocking the page: a tap outside, Escape or its close key puts it away.
 */
export function showThanks(host: HTMLElement, { x, repo }: { x: string; repo: string }): void {
  // Browsers without popovers (Safari before 17) skip the card rather than fail the download that called for it.
  if (!("showPopover" in HTMLElement.prototype)) return;
  if (!panel || !host.contains(panel)) {
    panel = document.createElement("div");
    panel.className = "sb-thanks";
    panel.setAttribute("popover", "auto");
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-labelledby", "sb-thanks-title");
    panel.tabIndex = -1;
    panel.innerHTML = `
      <div class="sb-thanks-text">
        <p class="sb-thanks-title" id="sb-thanks-title">Your clip is downloading</p>
        <p>If Soundbite saved you some time, a follow on X or a star on GitHub helps the next person find it.</p>
      </div>
      <div class="sb-thanks-keys">
        <a class="ag-btn sb-follow" target="_blank" rel="noopener" title="Follow on X">${svg(ICONS.x)}</a>
        <a class="ag-btn sb-star" target="_blank" rel="noopener" aria-label="Star Soundbite on GitHub" title="Star on GitHub">${svg(ICONS.star)}</a>
        <button class="ag-btn sb-close" type="button" aria-label="Close" title="Close">${svg(ICONS.close)}</button>
      </div>`;
    // Set as properties, so an account name or address from the host page is never read as markup.
    const follow = panel.querySelector<HTMLAnchorElement>(".sb-follow")!;
    follow.href = `https://x.com/intent/follow?screen_name=${encodeURIComponent(x)}`;
    follow.setAttribute("aria-label", `Follow @${x} on X`);
    panel.querySelector<HTMLAnchorElement>(".sb-star")!.href = repo;
    panel.querySelector(".sb-close")!.addEventListener("click", () => panel?.hidePopover());
    host.append(panel);
  }
  if (panel.matches(":popover-open")) return;
  // Focus moves into the card so a keyboard or screen reader finds it, and goes back where it was when it closes.
  const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const card = panel;
  card.addEventListener("toggle", (event) => {
    if ((event as ToggleEvent).newState === "closed" && card.contains(document.activeElement)) before?.focus({ preventScroll: true });
  }, { once: true });
  card.showPopover();
  card.focus({ preventScroll: true });
}
