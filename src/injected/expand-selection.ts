import { getOrCreateBackMap, getValidSelection } from "./shared";

function expandSelection() {
  const backMap = getOrCreateBackMap();

  const sel = getValidSelection();
  if (!sel) return;

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

expandSelection();
