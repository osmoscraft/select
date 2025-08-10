import { getValidSelection } from "./shared";

function deleteSelectedElements() {
  const sel = getValidSelection();
  if (!sel) return;

  const range = sel.getRangeAt(0);
  const currentSelectionLength = sel.toString().trim().length;

  if (currentSelectionLength === 0) {
    // Nothing selected, just remove the selection
    sel.removeAllRanges();
    return;
  }

  // Store the original range to restore if needed
  const originalRange = range.cloneRange();

  // Find and delete the optimal element using expand algorithm
  const elementToDelete = findOptimalElementToDelete(originalRange, currentSelectionLength);

  try {
    if (elementToDelete) {
      // Delete the entire element
      elementToDelete.remove();
    } else {
      // Fallback to deleting just the selected content
      sel.removeAllRanges();
      sel.addRange(originalRange);
      originalRange.deleteContents();
    }
    sel.removeAllRanges();
  } catch (error) {
    console.error("Failed to delete selected elements:", error);
  }
}

function findOptimalElementToDelete(originalRange: Range, currentSelectionLength: number): Element | null {
  const sel = window.getSelection();
  if (!sel) return null;

  const anchorAndFocusSame = sel.anchorNode === sel.focusNode;

  let candidate: Node | null;

  if (anchorAndFocusSame) {
    // A. If anchor and focus are the same, select their parent
    candidate =
      sel.anchorNode?.nodeType === Node.ELEMENT_NODE ? sel.anchorNode : (sel.anchorNode?.parentElement ?? null);
  } else {
    // B. If anchor and focus are different, select common ancestor
    candidate = originalRange.commonAncestorContainer;
  }

  let lastGoodCandidate: Element | null = null;

  // Repeat until reaching document root, looking for same selection length
  while (candidate && candidate !== document.documentElement) {
    // Test if selecting this element would change the selection length
    const testRange = document.createRange();
    testRange.selectNodeContents(candidate);
    sel.removeAllRanges();
    sel.addRange(testRange);

    const testSelection = window.getSelection();
    if (!testSelection) return lastGoodCandidate;
    const testSelectionText = testSelection.toString().trim() ?? "";

    if (testSelectionText.length !== currentSelectionLength) break;

    // This candidate has the exact same selection length, so it's good
    if (candidate.nodeType === Node.ELEMENT_NODE) {
      lastGoodCandidate = candidate as Element;
    }

    candidate = candidate.parentElement;
  }

  // Restore original selection
  sel.removeAllRanges();
  sel.addRange(originalRange);

  return lastGoodCandidate;
}

deleteSelectedElements();
