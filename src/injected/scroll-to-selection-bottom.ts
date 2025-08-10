import { closestCommonElement, getValidSelection } from "./shared";

function scrollToSelectionBottom() {
  const selection = getValidSelection();
  if (!selection || selection.rangeCount === 0) return;

  const container = closestCommonElement(selection.getRangeAt(0));

  if (container) {
    container.scrollIntoView({
      block: "end",
    });
  }
}

scrollToSelectionBottom();
