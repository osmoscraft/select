export function getValidSelection() {
  const sel = window.getSelection && window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;

  if (inContentEditable(sel.anchorNode) || inContentEditable(sel.focusNode)) return null;

  const ae = document.activeElement;
  if (
    ae &&
    (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement || (ae as HTMLElement).isContentEditable)
  )
    return null;

  return sel;
}

function inContentEditable(n: Node | null): boolean {
  const element = n instanceof Element ? n : n?.parentElement;
  return !!element?.closest('[contenteditable="true"][contenteditable="plaintext-only"]');
}

export function getOrCreateBackMap() {
  const w = window as any;
  if (!w.__semanticExpandBack) {
    w.__semanticExpandBack = new WeakMap<Node, Range>();
  }
  const backMap: WeakMap<Node, Range> = w.__semanticExpandBack;
  return backMap;
}

export function getBackMap() {
  const w = window as any;
  const backMap: WeakMap<Node, Range> | undefined = w.__semanticExpandBack;
  return backMap;
}

export function closestCommonElement(range: Range): Element | null {
  let candidate = range.commonAncestorContainer;
  while (candidate) {
    if (candidate.nodeType === Node.ELEMENT_NODE) {
      return candidate as Element;
    }
    candidate = candidate.parentElement as Node;
  }
  return null;
}
