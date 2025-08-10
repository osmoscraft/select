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
        files: ["expand-selection.js"],
      });
      break;
    }
    case "shrink-selection": {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["shrink-selection.js"],
      });
      break;
    }
    case "scroll-to-selection-top": {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["scroll-to-selection-top.js"],
      });
      break;
    }
    case "scroll-to-selection-bottom": {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["scroll-to-selection-bottom.js"],
      });
      break;
    }
    case "delete-selected-elements": {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["delete-selected-elements.js"],
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
