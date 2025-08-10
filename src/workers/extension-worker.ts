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
        func: expandSelection,
      });
      break;
    }
    case "shrink-selection": {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: shrinkSelection,
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
function expandSelection() {
  // getOrCreateBackMap
  const w = window as any;
  if (!w.__semanticExpandBack) {
    w.__semanticExpandBack = new WeakMap<Node, Range>();
  }
  const backMap: WeakMap<Node, Range> = w.__semanticExpandBack;

  // getNonEmptySelection
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  // isInInput
  const ae = document.activeElement;
  if (
    ae &&
    (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement || (ae as HTMLElement).isContentEditable)
  )
    return;

  // isInContentEditable(sel.anchorNode) || isInContentEditable(sel.focusNode)
  const inContentEditable = (n: Node | null): boolean => {
    const element = n instanceof Element ? n : n?.parentElement;
    return !!element?.closest('[contenteditable="true"][contenteditable="plaintext-only"]');
  };
  if (inContentEditable(sel.anchorNode) || inContentEditable(sel.focusNode)) return;

  const range = sel.getRangeAt(0);

  const currentSelectionLength = sel.toString().trim().length;
  const anchorAndFocusSame = sel.anchorNode === sel.focusNode;

  let candidate: Node | null;

  if (anchorAndFocusSame) {
    // A. If anchor and focus are the same, select their parent
    candidate = sel.anchorNode?.parentElement ?? null;
  } else {
    // B. If anchor and focus are different, select common ancestor
    candidate = range.commonAncestorContainer;
  }

  console.log([sel.anchorNode, sel.focusNode, currentSelectionLength]);
  // 3. Repeat until reaching document root, looking for increased selection length
  while (candidate && candidate !== document.documentElement) {
    // Test if selecting this element would increase the selection length
    const testRange = document.createRange();
    testRange.selectNodeContents(candidate);
    sel.removeAllRanges();
    sel.addRange(testRange);

    const testSelection = window.getSelection();
    if (!testSelection) return;
    const testSelectionText = testSelection.toString().trim() ?? "";

    if (testSelectionText.length < currentSelectionLength) {
      // testSelection should never be less than currentSelection. Bail out to prevent infinite loop
      break;
    }

    if (testSelectionText.length > currentSelectionLength) {
      break;
    }

    candidate = candidate.parentElement;
  }

  if (!candidate || candidate === document.documentElement) return;

  // Save current range for shrink on the target element
  backMap.set(candidate, range.cloneRange());
}

/**
 * Injected into the page to shrink selection.
 * Restores the previous range saved on the currently selected element, if any.
 */
function shrinkSelection() {
  // getBackMap
  const w = window as any;
  const backMap: WeakMap<Node, Range> | undefined = w.__semanticExpandBack;
  if (!backMap) return;

  // getNonEmptySelection
  const sel = window.getSelection && window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  // isInInput
  const ae = document.activeElement;
  if (
    ae &&
    (ae instanceof HTMLInputElement || ae instanceof HTMLTextAreaElement || (ae as HTMLElement).isContentEditable)
  )
    return;

  const inContentEditable = (n: Node | null): boolean => {
    const element = n instanceof Element ? n : n?.parentElement;
    return !!element?.closest('[contenteditable="true"][contenteditable="plaintext-only"]');
  };
  if (inContentEditable(sel.anchorNode) || inContentEditable(sel.focusNode)) return;

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
