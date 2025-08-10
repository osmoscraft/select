import { getBackMap, getValidSelection } from "./shared";

function shrinkSelection() {
  const backMap = getBackMap();
  if (!backMap) return;

  const sel = getValidSelection();
  if (!sel) return;

  const range = sel.getRangeAt(0);

  // Determine the currently selected element
  let currentEl: Element | null = null;

  if (range.startContainer === range.endContainer && range.startContainer.nodeType === Node.ELEMENT_NODE) {
    const el = range.startContainer as Element;
    const coversAll = range.startOffset === 0 && range.endOffset === el.childNodes.length;
    if (coversAll) currentEl = el;
  }
  if (!currentEl) {
    const cac = range.commonAncestorContainer;
    currentEl = cac.nodeType === Node.ELEMENT_NODE ? (cac as Element) : cac.parentElement || null;
  }
  if (!currentEl) return;

  const prev = backMap.get(currentEl);
  if (!prev) return;

  // Restore previous range and remove the back-link for one-step shrink
  sel.removeAllRanges();
  sel.addRange(prev);
  backMap.delete(currentEl);
}

shrinkSelection();
