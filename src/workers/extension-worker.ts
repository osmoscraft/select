chrome.action.onClicked.addListener(handleActionClick);
chrome.commands.onCommand.addListener(handleCommand);
chrome.runtime.onInstalled.addListener(handleExtensionInstall);

async function handleCommand(command: string) {
  const currentWindow = await chrome.windows.getCurrent();
  if (currentWindow.type !== "normal") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || (tab.url && tab.url.startsWith("chrome://"))) return;

  switch (command) {
    case "expand-selection": {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: page_expandSelection,
      });
      break;
    }
    case "shrink-selection": {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: page_shrinkSelection,
      });
      break;
    }
  }
}

function handleActionClick() {
  chrome.runtime.openOptionsPage();
}

async function handleExtensionInstall() {
  const readerPageUrl = new URL(chrome.runtime.getURL("options.html"));
  chrome.tabs.create({ url: readerPageUrl.toString() });
}

/**
 * Injected into the page to expand selection.
 * Keeps per-page state in a WeakMap stored on window.__semanticExpandBack.
 */
function page_expandSelection() {
  // Ensure per-page state
  const w = window as any;
  if (!w.__semanticExpandBack) {
    w.__semanticExpandBack = new WeakMap<Element, Range>();
  }
  const backMap: WeakMap<Element, Range> = w.__semanticExpandBack;

  // Guard: skip editable contexts
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const ae = document.activeElement;
  if (
    ae &&
    (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement || (ae as HTMLElement).isContentEditable)
  )
    return;

  const isInContentEditable = (n: Node | null) => {
    for (let el = n instanceof Element ? n : n?.parentElement; el; el = el.parentElement) {
      if ((el as HTMLElement).isContentEditable) return true;
    }
    return false;
  };
  if (isInContentEditable(sel.anchorNode) || isInContentEditable(sel.focusNode)) return;

  const range = sel.getRangeAt(0);
  const selectionTextLen = sel.toString().length;

  // Start from common ancestor; climb to an element
  let node: Node | null = range.commonAncestorContainer;
  if (!node) return;
  if (node.nodeType === Node.TEXT_NODE) node = (node as Text).parentElement;
  if (!node) return;

  // Find the next ancestor whose text is strictly larger than the current selection
  let target: Element | null = node as Element;
  while (target) {
    const textLen = (target.textContent || "").length;
    if (textLen > selectionTextLen) break;
    target = target.parentElement;
  }
  if (!target) return;

  // Save current range for shrink on the target element
  backMap.set(target, range.cloneRange());

  // Select the contents of the target element
  const newRange = document.createRange();
  newRange.selectNodeContents(target);
  sel.removeAllRanges();
  sel.addRange(newRange);
}

/**
 * Injected into the page to shrink selection.
 * Restores the previous range saved on the currently selected element, if any.
 */
function page_shrinkSelection() {
  // Access per-page state
  const w = window as any;
  const backMap: WeakMap<Element, Range> = w.__semanticExpandBack;
  if (!backMap) return;

  // Guard: skip editable contexts
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  const ae = document.activeElement;
  if (
    ae &&
    (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement || (ae as HTMLElement).isContentEditable)
  )
    return;

  const isInContentEditable = (n: Node | null) => {
    for (let el = n instanceof Element ? n : n?.parentElement; el; el = el.parentElement) {
      if ((el as HTMLElement).isContentEditable) return true;
    }
    return false;
  };
  if (isInContentEditable(sel.anchorNode) || isInContentEditable(sel.focusNode)) return;

  const range = sel.getRangeAt(0);

  // Determine the currently selected element:
  // if the current range exactly selects an element's contents, prefer that element;
  // otherwise use the common ancestor element.
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
