import { setupOffscreenDocument } from "../lib/offscreen";
import { backgroundPageParameters } from "../lib/parameters";
import type { ExtensionMessageRequest } from "../typings/message";

console.log("hello extension worker");

chrome.action.onClicked.addListener(handleActionClick);
chrome.runtime.onMessage.addListener(handleExtensionMessage);
chrome.runtime.onInstalled.addListener(handleExtensionInstall);
chrome.runtime.onStartup.addListener(handleBrowserStart);
(globalThis.self as any as ServiceWorkerGlobalScope).addEventListener("fetch", handleFetchEvent);

chrome.tabs.onCreated.addListener((tab) => {
  // TBD
});
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete") return; // if user is dragging
  console.log(`[worker] tab updated [${tabId}]: ${changeInfo.status} ${tab.url}`);
  if (!tab.url) return; // TBD: do we need to remove tabs e.g. when current tab is replaced by blank url?

  const { protocol, host } = await Promise.resolve()
    .then(() => new URL(tab.url!))
    .then((url) => ({ protocol: url.protocol ?? "", host: url.host ?? "" }))
    .catch(() => ({ protocol: "", host: "" })); // empty host should not match any tabs

  const [hostSharingTabs, groupSharingTabs] = await Promise.all([
    findTabsByHost(protocol, host),
    getTabsByGroupId(tab.groupId),
  ]);

  console.log({ hostSharingTabs, groupSharingTabs });

  const adjustableTabs = [...hostSharingTabs, ...groupSharingTabs].filter(
    (tab, index, array) => array.indexOf(tab) === index,
  );
  const groupIdToHost = new Map<number, string>(); // groupId must NOT be TAB_GROUP_ID_NONE
  const hostToGroupId = new Map<string, number>();
  const floatingTabs = [] as chrome.tabs.Tab[];

  for (const tab of adjustableTabs) {
    const tabHost = urlToHost(tab.url!); // tab.url is guaranteed to be non-empty
    const groupHost = groupIdToHost.get(tab.groupId);

    if (groupHost !== tabHost) {
      floatingTabs.push(tab);
      continue;
    }

    groupIdToHost.set(tab.groupId, groupHost);
    hostToGroupId.set(groupHost, tab.groupId);
  }

  console.log({ groupIdToHost, hostToGroupId });

  for (const tab of floatingTabs) {
    const tabHost = urlToHost(tab.url!); // tab.url is guaranteed to be non-empty
    const groupId = hostToGroupId.get(tabHost);

    const mergedGroupId = await chrome.tabs.group({ tabIds: hostSharingTabs.map((tab) => tab.id), groupId });
    hostToGroupId.set(tabHost, mergedGroupId);

    chrome.tabGroups.update(mergedGroupId, { title: tabHost });
  }
});

// in the current window, find all tabs with the same host
async function findTabsByHost(protocol: string, host: string) {
  const tabIds = await chrome.tabs
    .query({
      currentWindow: true,
      url: `${protocol}//${host}/*`,
    })
    .then((tabs) => {
      console.log("tabs", tabs);
      const validTabs = tabs.filter(hasId);
      return validTabs;
    });

  return tabIds;
}

async function getTabsByGroupId(groupId: number) {
  if (groupId === chrome.tabGroups.TAB_GROUP_ID_NONE) return [];

  const tabs = await chrome.tabs.query({ currentWindow: true, groupId });
  return tabs.filter(hasId);
}

function urlToHost(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

function hasId(tab: chrome.tabs.Tab): tab is chrome.tabs.Tab & { id: number } {
  return tab.id !== undefined;
}

function handleActionClick() {
  const readerPageUrl = new URL(chrome.runtime.getURL("app.html"));
  chrome.tabs.create({ url: readerPageUrl.toString() });
  console.log("Action clicked");
}

async function handleExtensionMessage(message: ExtensionMessageRequest) {
  console.log("[worker] received message", message);
}

async function handleExtensionInstall() {
  await setupOffscreenDocument(backgroundPageParameters);
  const readerPageUrl = new URL(chrome.runtime.getURL("options.html"));
  chrome.tabs.create({ url: readerPageUrl.toString() });
}

async function handleBrowserStart() {
  await setupOffscreenDocument(backgroundPageParameters);
}

function handleFetchEvent(event: FetchEvent) {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.pathname === "/app.html") {
    const responseAsync = new Promise<Response>(async (resolve) => {
      const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
    <link rel="icon" type="image/svg+xml" href="./images/icon.svg" />
    <link rel="stylesheet" href="./app.css" />
  </head>
  <body>
    <h1>Service Worker rendered page</h1>
    <script type="module" src="./app.js"></script>
  </body>
</html>`;

      resolve(new Response(html, { headers: { "Content-Type": "text/html" } }));
    });

    event.respondWith(responseAsync);
  }
}
