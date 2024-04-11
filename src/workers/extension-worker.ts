import {
  clearSelections,
  closeOthers,
  handleHighlighted,
  handleTabCreated,
  handleTabRemoved,
  mergeWindows,
  moveTabs,
  openTab,
  printDebugInfo,
  toggleSelect as toggleSelection,
} from "../lib/tab-actions";

chrome.commands.onCommand.addListener(handleCommand);
chrome.action.onClicked.addListener(handleActionClick);
chrome.runtime.onInstalled.addListener(handleExtensionInstall);

chrome.tabs.onCreated.addListener(handleTabCreated);
chrome.tabs.onRemoved.addListener(handleTabRemoved);
chrome.tabs.onHighlighted.addListener(handleHighlighted);

async function handleCommand(command: string) {
  console.log(`Command: ${command}`);
  switch (command) {
    case "print-debug-info": {
      printDebugInfo();
      break;
    }
    case "close-others": {
      closeOthers();
      break;
    }
    case "open-previous": {
      openTab(-1);
      break;
    }
    case "open-next": {
      openTab(1);
      break;
    }
    case "merge-windows": {
      mergeWindows();
      break;
    }
    case "move-previous": {
      moveTabs(-1);
      break;
    }
    case "move-next": {
      moveTabs(1);
      break;
    }
    case "toggle-selection": {
      toggleSelection();
      break;
    }
    case "clear-selections": {
      clearSelections();
      break;
    }
  }
}

chrome.tabs.onCreated.addListener(async (tab) => {
  console.log("created", {
    id: tab.id,
    title: tab.title,
    url: [tab.pendingUrl, tab.url],
    status: tab.status,
    opener: tab.openerTabId,
  });
});

function handleActionClick() {
  chrome.runtime.openOptionsPage();
}

async function handleExtensionInstall() {
  const readerPageUrl = new URL(chrome.runtime.getURL("options.html"));
  chrome.tabs.create({ url: readerPageUrl.toString() });
}
