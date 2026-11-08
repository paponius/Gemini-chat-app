/**
 * Query-Dynamic.js
 * A lightweight DOM observation debug helper for monitoring delayed element lifecycles
 * with cascade recovery and visual debugging via data-qd attributes.
 */

// Helper for cleaner console logs: returns milliseconds since page load
function getElapsedTimestamp() {
	return `+${performance.now().toFixed(2)}ms`;
}


// Global registry to track active query-dynamic instances and prevent duplicate runs across re-injections
window.__queryDynamicInstances = window.__queryDynamicInstances || {};

// TEST
// queryDynamic('body .chat-app chat-window-content .response-container .response-container-footer .more-menu-button-container', el => { console.log(getElapsedTimestamp(), '[QD] SUCCESS: Target element fully resolved:', el); });

function queryDynamic(complexSelector, callbackOrRoot, rootOrCallback) {
	// Support flexible argument ordering: (selector, callback, root) or (selector, root, callback)
	let callback = typeof callbackOrRoot === 'function' ? callbackOrRoot : rootOrCallback;
	let rootInput = typeof callbackOrRoot === 'function' ? rootOrCallback : callbackOrRoot;

	let rootElement = document.body;
	if (rootInput) {
		rootElement = typeof rootInput === 'string' ? document.querySelector(rootInput) : rootInput;
		if (!rootElement) {
			console.warn(getElapsedTimestamp(), '[QD] ERROR: Provided root element/selector not found in DOM:', rootInput);
			rootElement = document.body;
		}
	}

	console.log(getElapsedTimestamp(), '[QD] Initializing queryDynamic with selector:', complexSelector, 'on root:', rootElement);

	// Run-once / Deduplication check: Prevent multiple concurrent runs for the exact same selector
	if (window.__queryDynamicInstances[complexSelector]) {
		console.warn(getElapsedTimestamp(), '[QD] queryDynamic already running for this selector. Cleaning up previous instance.');
		window.__queryDynamicInstances[complexSelector].cleanup();
	}

	// Instance control object for cleanup
	var instance = {
		observers: [],
		rootElement: rootElement,
		cleanup() {
			this.observers.forEach(obs => obs.disconnect());
			this.observers = [];
		}
	};
	window.__queryDynamicInstances[complexSelector] = instance;

	// Decompose the complex selector into sequential simple segments.
	// Example: ".a .d > .target" -> [ { selector: '.a', combinator: 'descendant' }, ... ]
	let segments = parseSelectorSegments(complexSelector);
	console.log(getElapsedTimestamp(), '[QD] Parsed segments:', segments);
	if (segments.length === 0) {
		console.warn(getElapsedTimestamp(), '[QD] ERROR: No valid segments parsed from selector.');
		return;
	}

	resolveSegment(rootElement, segments, 0, callback, instance);
}

function parseSelectorSegments(selectorStr) {
	// Basic parser to split complex selector by combinators while preserving context.
	// For practical robustness, we can split by spaces and handle '>' explicitly.
	let trimmed = selectorStr.trim();
	let tokens = trimmed.split(/\s+/);
	let segments = [];
	let pendingCombinator = 'descendant';

	for (let i = 0; i < tokens.length; i++) {
		let token = tokens[i];

		if (token === '>') {
			pendingCombinator = 'child';
			continue;
		}

		if (token.startsWith('>')) {
			pendingCombinator = 'child';
			token = token.substring(1);
		}

		if (token.endsWith('>')) {
			token = token.slice(0, -1);
			segments.push({ selector: token, combinator: pendingCombinator });
			pendingCombinator = 'child';
			continue;
		}

		segments.push({ selector: token, combinator: pendingCombinator });
		pendingCombinator = 'descendant';
	}

	return segments;
}

function resolveSegment(currentRoot, segments, index, callback, instance) {
	debugger;
	let current = segments[index];
	let isLast = index === segments.length - 1;

	console.log(getElapsedTimestamp(), `[QD] Resolving segment [${index}/${segments.length - 1}]: "${current.selector}" (combinator: ${current.combinator}) inside root:`, currentRoot);

	// 1. Initial check: check if the root itself matches, or perform querySelector sweep
	function findMatch(root) {
		if (root.nodeType === Node.ELEMENT_NODE && root.matches(current.selector)) {
			return root;
		}
		if (current.combinator === 'child') {
			return root.querySelector(`:scope > ${current.selector}`);
		} else if (current.combinator === 'descendant') {
			return root.querySelector(`:scope ${current.selector}`);
		} // todo sibling later
	}

	let found = findMatch(currentRoot);
	if (found) {
		console.log(getElapsedTimestamp(), `[QD] Segment [${index}] found immediately:`, found);
		handleSegmentFound(found, currentRoot, segments, index, callback, instance);
		return;
	}

	// 2. Observe if not found yet
	console.log(getElapsedTimestamp(), `[QD] Segment [${index}] not found yet. Setting up tree observer on root:`, currentRoot);
	
	let stateLabel = isLast 
		? `observing tree for: ${current.selector}` 
		: `observing tree for: ${current.selector}`;
	
	currentRoot.setAttribute('data-qd', stateLabel);

	let observer = new MutationObserver((mutations) => {
		for (let mutation of mutations) {
			for (let node of mutation.addedNodes) {
				if (node.nodeType !== Node.ELEMENT_NODE) continue;

				let match = null;
				if (current.combinator === 'child') {
					if (node.matches(current.selector) && node.parentElement === currentRoot) {
						match = node;
					} else {
						match = node.querySelector(`:scope > ${current.selector}`);
					}
				} else {
					if (node.matches(current.selector)) {
						match = node;
					} else {
						match = node.querySelector(current.selector);
					}
				}

				if (match) {
					console.log(getElapsedTimestamp(), `[QD] Segment [${index}] matched via MutationObserver on node:`, node, '-> resolved match:', match);
					observer.disconnect();
					// Remove from instance tracking
					instance.observers = instance.observers.filter(o => o !== observer);
					handleSegmentFound(match, currentRoot, segments, index, callback, instance);
					return;
				}
			}
		}
	});

	observer.observe(currentRoot, {
		childList: true,
		subtree: true
	});

	instance.observers.push(observer);
}

function handleSegmentFound(element, parentRoot, segments, index, callback, instance) {
	var isLast = index === segments.length - 1;

	// Set up flat standing guards on every parent/ancestor along the entire path up to parentRoot
	setupPathGuards(element, parentRoot, segments, index, callback, instance);

	if (isLast) {
		console.log(getElapsedTimestamp(), '[QD] SUCCESS: Final target element resolved successfully:', element);
		// Mark final element as handled
		element.setAttribute('data-qd', 'handled');
		
		callback(element);
	} else {
		console.log(getElapsedTimestamp(), `[QD] Intermediate segment [${index}] resolved. Setting path guards and proceeding to next segment.`);
		
		// Proceed to next segment
		resolveSegment(element, segments, index + 1, callback, instance);
	}
}

function setupPathGuards(element, parentRoot, segments, index, callback, instance) {
	let currentParent = element.parentElement;
	let targetSelector = segments[index].selector;
	let monitoredChild = element;

	// Walk up the ancestry chain from element's parent all the way up to parentRoot
	while (currentParent && currentParent !== parentRoot.parentElement) {
		console.log(getElapsedTimestamp(), `[QD] Setting up standing guard (flat observer) on parent along path:`, currentParent);

		// Mark current parent as standing guard with the updated vocabulary
		currentParent.setAttribute('data-qd', `flat observer guarding removal of: ${targetSelector}`);

		let guardTarget = currentParent;
		let childToWatch = monitoredChild;

		let guardObserver = new MutationObserver((mutations) => {
			for (let mutation of mutations) {
				for (let removedNode of mutation.removedNodes) {
					if (removedNode === childToWatch || removedNode.contains(childToWatch)) {
						console.warn(getElapsedTimestamp(), `[QD] Guard triggered: Monitored element or its ancestor was removed/detached! Element:`, childToWatch);
						guardObserver.disconnect();
						instance.observers = instance.observers.filter(o => o !== guardObserver);
						
						// Cascade Recovery: Find highest surviving ancestor or restart from safe root
						let fallbackRoot = guardTarget;
						while (fallbackRoot && !fallbackRoot.hasAttribute('data-qd')) {
							fallbackRoot = fallbackRoot.parentElement;
						}
						
						if (!fallbackRoot) {
							console.log(getElapsedTimestamp(), '[QD] Cascade Recovery: No data-qd ancestor found. Falling back to instance rootElement and restarting from index 0.');
							resolveSegment(instance.rootElement, segments, 0, callback, instance);
						} else {
							console.log(getElapsedTimestamp(), '[QD] Cascade Recovery: Found surviving ancestor with data-qd:', fallbackRoot);
							resolveSegment(fallbackRoot, segments, index, callback, instance);
						}
						return;
					}
				}
			}
		});

		guardObserver.observe(guardTarget, {
			childList: true,
			subtree: false
		});

		instance.observers.push(guardObserver);

		// Shift up the chain to guard the next parent level
		monitoredChild = currentParent;
		currentParent = currentParent.parentElement;
	}
}