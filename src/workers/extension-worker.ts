chrome.action.onClicked.addListener(handleActionClick);
chrome.commands.onCommand.addListener(handleCommand);
chrome.runtime.onInstalled.addListener(handleExtensionInstall);

async function handleCommand(command: string) {
  const currentWindow = await chrome.windows.getCurrent();
  if (currentWindow.type !== "normal") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || (tab.url && tab.url.startsWith("chrome://"))) return;

  switch (command) {
    case "expand-selection-head": {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: expandSelectionHead,
      });
      break;
    }
    case "expand-selection-tail": {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: expandSelectionTail,
      });
      break;
    }
    case "undo-expand-selection": {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: undoExpandSelection,
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
 * Page-injected helpers
 */

function expandSelectionHead() {
  const w = window as any;
  if (!w.__semanticExpandUndoStack) w.__semanticExpandUndoStack = [];
  const stack: Range[] = w.__semanticExpandUndoStack;

  const sel = window.getSelection && window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

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

  const original = sel.getRangeAt(0).cloneRange();
  const originalLen = (sel.toString() || "").trim().length;

  const startNode = original.startContainer;
  const startOffset = original.startOffset;

  const candidates: Array<[Node, number]> = [];

  // Step within current container to earliest boundary
  if (startNode.nodeType === Node.TEXT_NODE) {
    if (startOffset > 0) candidates.push([startNode, 0]);
  } else if (startNode.nodeType === Node.ELEMENT_NODE) {
    if (startOffset > 0) candidates.push([startNode, 0]);
  }

  // Ascend to parent boundaries before current node
  let n: Node | null = startNode;
  while (n) {
    const p: Node | null = n.parentNode;
    if (!p) break;
    const idx = Array.prototype.indexOf.call(p.childNodes, n);
    candidates.push([p, idx]);
    n = p;
  }

  for (const [node, offset] of candidates) {
    const test = original.cloneRange();
    try {
      test.setStart(node, offset);
    } catch {
      continue;
    }
    sel.removeAllRanges();
    sel.addRange(test);
    const testLen = (sel.toString() || "").trim().length;
    if (testLen > originalLen) {
      stack.push(original);
      return;
    }
  }

  // No increase; restore
  sel.removeAllRanges();
  sel.addRange(original);
}

function expandSelectionTail() {
  const w = window as any;
  if (!w.__semanticExpandUndoStack) w.__semanticExpandUndoStack = [];
  const stack: Range[] = w.__semanticExpandUndoStack;

  const sel = window.getSelection && window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

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

  const original = sel.getRangeAt(0).cloneRange();
  const originalLen = (sel.toString() || "").trim().length;

  const endNode = original.endContainer as Node;
  const endOffset = original.endOffset;

  const candidates: Array<[Node, number]> = [];

  // Step within current container to latest boundary
  if (endNode.nodeType === Node.TEXT_NODE) {
    const len = ((endNode as Text).data || "").length;
    if (endOffset < len) candidates.push([endNode, len]);
  } else if (endNode.nodeType === Node.ELEMENT_NODE) {
    const len = (endNode as Element).childNodes.length;
    if (endOffset < len) candidates.push([endNode, len]);
  }

  // Ascend to parent boundaries after current node
  let n: Node | null = endNode;
  while (n) {
    const p: Node | null = n.parentNode;
    if (!p) break;
    const idx = Array.prototype.indexOf.call(p.childNodes, n);
    candidates.push([p, idx + 1]);
    n = p;
  }

  for (const [node, offset] of candidates) {
    const test = original.cloneRange();
    try {
      test.setEnd(node, offset);
    } catch {
      continue;
    }
    sel.removeAllRanges();
    sel.addRange(test);
    const testLen = (sel.toString() || "").trim().length;
    if (testLen > originalLen) {
      stack.push(original);
      return;
    }
  }

  // No increase; restore
  sel.removeAllRanges();
  sel.addRange(original);
}

function undoExpandSelection() {
  const w = window as any;
  const stack: Range[] | undefined = w.__semanticExpandUndoStack;
  if (!stack || stack.length === 0) return;

  const prev = stack.pop();
  if (!prev) return;

  const sel = window.getSelection && window.getSelection();
  if (!sel) return;

  sel.removeAllRanges();
  sel.addRange(prev);
}
