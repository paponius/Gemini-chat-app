## Instructions for AI when working on script Gemini-chat-app/src/Query-Dynamic.js

### 1. Context & Purpose

* **Role:** 3rd-party injected debug script designed to monitor DOM element creation, loading, and dynamic replacement in an environment running 1st-party scripts and frameworks (e.g., React).
* **Primary Objective:** Trace element lifecycle events visually and programmatically during page load and state changes.

### 2. Performance & Resource Constraints

* **Timers:** Minimize or completely eliminate `setTimeout` and `setInterval`.
* **DOM Observers:**
* Use `MutationObserver` as the primary tool.
* Avoid heavy selectors or massive scope (`document` or `<body>` with `subtree: true`). Scope observations to specific container elements whenever possible.
* Keep callback handler execution lightweight to avoid main-thread blocking.
* Do not instantiate redundant observers.


* **Memory Management:** Ensure observers are properly disconnected when no longer needed or when cascading cleanup/recovery is triggered.

### 3. Selector Resolution & Guarding Strategy

* **Input & Decomposition:** The script accepts a complex CSS selector. It must *not* be queried as a single monolithic selector. Instead, it must be decomposed into sequential simple sub-selectors.
* **Delayed Availability & Lifecycle Persistence:** Target elements are absent at initialization and subject to arbitrary destruction and recreation by 1st-party scripts. The script must handle asynchronous appearance, disappearance, and recreation indefinitely.
* **Phase 1: Discovery & Callback Execution:**
* Incrementally observe and wait for each sub-selector segment in order until the full target element is resolved.
* To prevent race conditions during setup, attach the observer first, then immediately run an initial `querySelector` sweep.
* **Dual-Check for Pre-Built Subtrees:** When an observer with `subtree: true` detects additions, check both the added node (`node.matches(...)`) and its subtree (`node.querySelector(...)`) to handle cases where 1st-party scripts append nested structures in a single batch.
* Upon final resolution, invoke a user-provided handler function, passing the target `HTMLElement` as an argument.


* **Phase 2: "Standing Guard" & Cascade Recovery:**
* Maintain continuous monitoring using flat observers (`subtree: false`) on established parents along the path to verify the target element remains attached to the DOM.
* If detachment or removal occurs at any level in the selector ancestry chain, locate the highest surviving ancestor node where the split occurred and restart the resolution sequence from that point.
* **Reference Scenario:**
* DOM structure: `body > .a > .b > .c > .d > .target`
* Inputted selector: `.a .d > .target`
* If `.c` is removed (along with its descendants `.d` and `.target`), observation gracefully falls back and restarts from the surviving parent `.b`.





### 4. DOM Debug State Vocabulary (`data-qd`)

To ensure clear manual inspection in DevTools for both humans and AI:

* **`data-qd="observing tree for: [selector]"`**
A deep observer (`subtree: true`) is actively watching this container for the appearance of the next segment anywhere down the branch.
* **`data-qd="flat observer guarding removal of: [selector]"`**
A flat observer (`subtree: false`) is standing guard on this established parent node to instantly detect if it gets detached or removed.
* **`data-qd="handled"`**
The final target element has been fully resolved and the user callback has been executed.

### 5. Code Style & Syntax

* **Indentation:** Use tabs, never spaces.
* **Variable Declaration (`let`):** Use `let` strictly when variable reassignment and block-scoped limitation are required.
* **Constants (`const`):** Use `const` logically for values that do not change, without forcing it unnecessarily on every variable.
* **Comments:** Do not arbitrary remove comments. You can fix wrong comment, or add a new one. Never remove one if it is valid.
