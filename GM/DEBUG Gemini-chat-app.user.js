/*** DEBUGGING & LOCAL DEVELOPMENT ARCHITECTURE:
 * This is a local development Userscript wrapper.
 *
 * Workflow & Benefits:
 * - Links directly to local source files using `file://` protocol `@require` directives.
 * - Enables live editing in an external IDE without needing to copy/paste code into the browser editor.
 * - Tampermonkey does not cache `file://` URIs, so version query parameters are unnecessary for local edits.
 *
 * Setup Instructions:
 * 1. Allow local file access for your Userscript manager extension in your browser settings.
 * 2. Copy the `@require` directives from your production script, converting target paths to absolute `file://` paths.
 *    - Note on paths: Backslashes (e.g., `file:///C:\path`), although against the standards, work natively in Tampermonkey on Windows.
 * 3. Add the production script file itself as the final `@require` (the manager ignores nested metadata blocks).
 * 4. Install by dragging and dropping this debug `.user.js` file into the browser, or open its `file:///` URL directly.
 *
 * Note on Browser Constraints:
 * Firefox and strict WebExtension security models block `file://` access from extensions.
 * This setup targets Chrome/Chromium-based environments.
 *
 * TEMPLATE INSTRUCTIONS (Customize for new projects):
 * - XXX_PATH: Absolute local path to your project directory (e.g., file:///C:/Projects/MyScript)
 * - This debug file can be renamed freely.
 *
 * v3.0
 */

// ==UserScript==
// @name           DEBUG - Gemini Chat App Enhancer
// @author         papo

// ###run-at         document-start
//// document-start ['loading'] -> document-body [<body> exist] -> document-end ['DOMContentLoaded'/'interactive'] -> document-idle (TM default)

// @noframes


//// REQUIRE directives. Make it identical to production version of the US. Replace with file:// those which will be edited in IDE.

// @require        file:///H:\Projects\JS\Gemini-chat-app\GM\GM_common.js

//// FRAMEWORKS
// ###require        https://code.jquery.com/jquery-2.2.0.min.js
// ###require        http://ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js
// ###require        https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js
// @require        file:///H:\Projects\JS\Gemini-chat-app\src\Query-Dynamic.js

// @require        file:///H:\Projects\JS\Gemini-chat-app\src\Gemini-Thinking-Level-Switch.js
// @require        file:///H:\Projects\JS\Gemini-chat-app\src\Gemini-Model-Used-Badge.js

//// Production version of this US
//// Must be the last @require. Metadata block in it is ignored. No need to add if it's without JS code.
//
// #require        file:///H:\Projects\JS\Gemini-chat-app\GM\Gemini-chat-app.user.js


//// RESOURCE
// ###resource       extension_pages/options.html file:///C:\path\to\file


//// Allowing everything in this debug US:
// @match          *://*/*

// @grant          GM.getValue
// @grant          GM.setValue
// @grant          GM.xmlHttpRequest
// @grant          GM.getResourceUrl
// @grant          GM.deleteValue
// @grant          GM.listValues
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_xmlhttpRequest
// @grant          GM_setClipboard
// @grant          GM_addStyle
// @grant          GM_registerMenuCommand
// @grant          GM.openInTab
// @grant          unsafeWindow
// @grant          window.close
// @grant          window.focus
// @grant          window.onurlchange

// @connect        *
// ==/UserScript==
