/*** ARCHITECTURE & DEVELOPER NOTES:
 * This Userscript file contains only the Metadata Block.
 * Core logic is maintained in external files for modularity, portability, and cleaner maintenance.
 *
 * Design Rationale:
 * - Modularity & Inspection: Splitting code by semantics makes long programs far easier
 *   to understand and inspect than a monolithic file of thousands of lines.
 * - Development: Enables full IDE support, live debugging, and clean semantic separation instead of a monolithic file.
 *   External JS files can be edited directly in an external IDE, making development significantly easier.
 * - Performance: External scripts included via `@require` are cached by the manager
 *   and update automatically when the script version changes.
 * - Portability: Separates GreaseMonkey environment wrappers from generic logic, allowing
 *   the same source files to be reused within WebExtensions.
 *
 * v3.0
 */

// ==UserScript==
// @name           Gemini Chat App Enhancer
// @namespace      https://github.com/paponius/
// @version        1.21
// @description    Tweaks the Gemini Chat App
// @author         papo
// @license        CC BY-NC-SA 4.0
// @match          https://gemini.google.com/*
// @icon           https://raw.githubusercontent.com/paponius/Gemini-chat-app/master/GM/gemini.ico
// @run-at         document-idle
// @grant          GM_registerMenuCommand
// @grant          GM_getValue
// @grant          GM_setValue

// @noframes

// @require        https://raw.githubusercontent.com/paponius/Gemini-chat-app/master/GM/GM_common.js

// @require        https://raw.githubusercontent.com/paponius/Gemini-chat-app/master/src/Query-Dynamic.js

//// CORE APPLICATION LOGIC
// @require        https://raw.githubusercontent.com/paponius/Gemini-chat-app/master/src/Gemini-Thinking-Level-Switch.js
// @require        https://raw.githubusercontent.com/paponius/Gemini-chat-app/master/src/Gemini-Model-Used-Badge.js

// ==/UserScript==
