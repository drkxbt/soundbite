const ICONS = {
  x: '<path class="fill" d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.18h1.7L7.4 4.73H5.58l11.09 14.45Z"/>',
  star: '<path d="m12 3.8 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8Z"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  tip: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>',
};

const svg = (paths: string) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths}</svg>`;

// Each star throws four sparks as it lands, each its own way.
const SPARKS = [[-14, -16], [16, -12], [-12, 15], [15, 14]];

let dialog: HTMLDialogElement | null = null;

export interface ThanksLink {
  kind: "follow" | "star" | "tip";
  href: string;
  text: string;
  label: string;
}

/**
 * The card's keys: a follow on X, a star on GitHub, and a tip in crypto when `tip` is a web address or one of the
 * page's own paths. Anything else given as `tip` is left out, so a host's typo can never become a script link.
 */
export function thanksLinks({ x, repo, tip = "" }: { x: string; repo: string; tip?: string }): ThanksLink[] {
  const links: ThanksLink[] = [
    { kind: "follow", href: `https://x.com/intent/follow?screen_name=${encodeURIComponent(x)}`, text: "Follow on X", label: `Follow @${x} on X` },
    { kind: "star", href: repo, text: "Star on GitHub", label: "Star Soundbite on GitHub" },
  ];
  const address = tip.trim();
  if (/^https?:\/\//i.test(address) || /^\/(?!\/)/.test(address)) links.push({ kind: "tip", href: address, text: "Tip in crypto", label: "Tip drk in crypto" });
  return links;
}

/**
 * After a download, a card in the middle of the screen thanks the person with five stars and asks for a follow on X
 * and a star on GitHub, and a tip when the page says where tips go. Escape, the close key or a tap outside it puts it
 * away.
 */
export function showThanks(host: HTMLElement, settings: { x: string; repo: string; tip?: string }): void {
  // Browsers without modal dialogs skip the card rather than fail the download that called for it.
  if (typeof HTMLDialogElement === "undefined" || !("showModal" in HTMLDialogElement.prototype)) return;
  if (!dialog || !host.contains(dialog)) {
    dialog = document.createElement("dialog");
    dialog.className = "sb-thanks";
    dialog.setAttribute("aria-labelledby", "sb-thanks-title");
    dialog.setAttribute("aria-describedby", "sb-thanks-text");
    dialog.innerHTML = `
      <div class="sb-thanks-card">
        <div class="sb-thanks-stars" aria-hidden="true"></div>
        <h2 class="sb-thanks-title" id="sb-thanks-title">Your clip is downloading</h2>
        <p class="sb-thanks-text" id="sb-thanks-text"></p>
        <div class="sb-thanks-keys"></div>
        <button class="ag-btn sb-close" type="button" aria-label="Close" title="Close">${svg(ICONS.close)}</button>
      </div>`;
    // Each star's place in the row, and each spark's way out, set through the style object: a strict page forbids
    // style attributes in markup.
    const row = dialog.querySelector(".sb-thanks-stars")!;
    for (let index = 0; index < 5; index++) {
      const star = document.createElement("span");
      star.innerHTML = svg(ICONS.star);
      star.style.setProperty("--i", String(index));
      for (const [dx, dy] of SPARKS) {
        const spark = document.createElement("i");
        spark.style.setProperty("--dx", `${dx}px`);
        spark.style.setProperty("--dy", `${dy}px`);
        star.append(spark);
      }
      row.append(star);
    }
    // Set as properties, so an account name or address from the host page is never read as markup.
    const links = thanksLinks(settings);
    dialog.querySelector(".sb-thanks-text")!.textContent = links.some((link) => link.kind === "tip")
      ? "If Soundbite saved you some time, a follow on X or a star on GitHub helps the next person find it, and a tip keeps it free."
      : "If Soundbite saved you some time, a follow on X or a star on GitHub helps the next person find it.";
    const keys = dialog.querySelector(".sb-thanks-keys")!;
    for (const link of links) {
      const key = document.createElement("a");
      key.className = `ag-key sb-${link.kind}`;
      key.target = "_blank";
      key.rel = "noopener";
      key.href = link.href;
      key.setAttribute("aria-label", link.label);
      key.innerHTML = `${svg(ICONS[link.kind === "follow" ? "x" : link.kind])}<span class="ag-key-text"></span>`;
      key.querySelector(".ag-key-text")!.textContent = link.text;
      keys.append(key);
    }
    const card = dialog;
    card.querySelector(".sb-close")!.addEventListener("click", () => card.close());
    // A press on the backdrop lands on the dialog itself, outside its card.
    card.addEventListener("click", (event) => {
      if (event.target === card) card.close();
    });
    host.append(card);
  }
  if (dialog.open) return;
  const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const card = dialog;
  card.addEventListener("close", () => before?.focus({ preventScroll: true }), { once: true });
  card.showModal();
  // The card takes focus, not its first link, so a reader hears the thanks before any choice.
  card.tabIndex = -1;
  card.focus({ preventScroll: true });
}
