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
 *
 * - XXX_PATH: Path to the script repository/source
 * - YYY: Optional description details or specific notes to edit
 * - ###: Prefix for optional directives (e.g., icons, matches, grants) as needed
 */

// ==UserScript==
// @name           Gemini Thinking Level Switch
// #future-name           Gemini Chat App Enhancer
// @namespace      https://github.com/paponius/
// @version        1.14
// @description    Adds a clean inline thinking level switcher for Gemini with automatic state detection and customizable visibility.
// @author         papo
// @license        CC BY-NC-SA 4.0
// @match          https://gemini.google.com/*
// @icon           https://www.google.com/s2/favicons?sz=64&domain=google.com
// @run-at         document-idle
// @grant          GM_registerMenuCommand
// @grant          GM_getValue
// @grant          GM_setValue

//// FRAMEWORKS
// ###require      https://code.jquery.com/jquery-2.2.0.min.js
// ###require      https://greasemonkey.github.io/gm4-polyfill/gm4-polyfill.js

//// CORE APPLICATION LOGIC
// @require        https://raw.githubusercontent.com/paponius/Gemini-chat-app/master/src/Gemini-chat-app.js?v0.9

// ==/UserScript==
