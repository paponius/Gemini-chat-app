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
	// Example: " > .b" or ".a + .b ~ .c > .target"
	let segments = parseSelectorSegments(complexSelector);
	console.log(getElapsedTimestamp(), '[QD] Parsed segments:', segments);
	if (segments.length === 0) {
		console.warn(getElapsedTimestamp(), '[QD] ERROR: No valid segments parsed from selector.');
		return;
	}

	resolveSegment(rootElement, segments, 0, callback, instance);
}

function parseSelectorSegments(selectorStr) {
	// Normalize spacing around combinators and filter out any empty tokens resulting from leading/trailing operators
	let normalized = selectorStr.trim()
		.replace(/\s*([>+~])\s*/g, ' $1 ')
		.replace(/\s+/g, ' ');
	let tokens = normalized.split(' ').filter(Boolean);
	let segments = [];
	let pendingCombinator = ' ';

	for (let i = 0; i < tokens.length; i++) {
		let token = tokens[i];

		if (token === '>' || token === '+' || token === '~') {
			pendingCombinator = token;
			continue;
		}

		segments.push({ selector: token, combinator: pendingCombinator });
		pendingCombinator = ' ';
	}

	return segments;
}

function resolveSegment(prevElement, segments, index, callback, instance) {
	let current = segments[index];
	let isLast = index === segments.length - 1;

	console.log(getElapsedTimestamp(), `[QD] Resolving segment [${index}/${segments.length - 1}]: "${current.selector}" (combinator: "${current.combinator}") relative to:`, prevElement);

	// 1. Initial check: evaluate based on combinator type relative to prevElement
	function findMatch() {
		if (index === 0) {
			switch (current.combinator) {
				case '>':
					if (prevElement.nodeType === Node.ELEMENT_NODE) {
						return prevElement.querySelector(`:scope > ${current.selector}`);
					}
					return null;
				case '+':
					{
						let next = prevElement.nextElementSibling;
						return next && next.matches(current.selector) ? next : null;
					}
				case '~':
					{
						let curr = prevElement.nextElementSibling;
						while (curr) {
							if (curr.matches(current.selector)) return curr;
							curr = curr.nextElementSibling;
						}
						return null;
					}
				case ' ':
				default:
					if (prevElement.nodeType === Node.ELEMENT_NODE && prevElement.matches(current.selector)) {
						return prevElement;
					}
					return prevElement.querySelector(current.selector);
			}
		}

		switch (current.combinator) {
			case '>':
				return prevElement.querySelector(`:scope > ${current.selector}`);
			case '+':
				{
					let next = prevElement.nextElementSibling;
					return next && next.matches(current.selector) ? next : null;
				}
			case '~':
				{
					let curr = prevElement.nextElementSibling;
					while (curr) {
						if (curr.matches(current.selector)) return curr;
						curr = curr.nextElementSibling;
					}
					return null;
				}
			case ' ':
			default:
				return prevElement.querySelector(current.selector);
		}
	}

	let found = findMatch();
	if (found) {
		console.log(getElapsedTimestamp(), `[QD] Segment [${index}] found immediately:`, found);
		handleSegmentFound(found, prevElement, segments, index, callback, instance);
		return;
	}

	// 2. Observe if not found yet
	let observeRoot;
	let observerOptions = { childList: true };

	if (index === 0 && (current.combinator === '+' || current.combinator === '~')) {
		observeRoot = prevElement.parentElement;
	} else if (current.combinator === '+' || current.combinator === '~') {
		observeRoot = prevElement.parentElement;
	} else {
		observeRoot = prevElement;
		observerOptions.subtree = (current.combinator === ' ');
	}

	if (!observeRoot) {
		console.warn(getElapsedTimestamp(), `[QD] Cannot observe element: root has no parentElement.`);
		return;
	}

	console.log(getElapsedTimestamp(), `[QD] Segment [${index}] not found yet. Setting up tree observer on root:`, observeRoot);

	let stateLabel = `observing tree for: ${current.selector}`;
	observeRoot.setAttribute('data-qd', stateLabel);

	let observer = new MutationObserver((mutations) => {
		let match = findMatch();
		if (match) {
			console.log(getElapsedTimestamp(), `[QD] Segment [${index}] matched via MutationObserver -> resolved match:`, match);
			observer.disconnect();
			// Remove from instance tracking
			instance.observers = instance.observers.filter(o => o !== observer);
			handleSegmentFound(match, prevElement, segments, index, callback, instance);
		}
	});

	observer.observe(observeRoot, observerOptions);
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
	while (currentParent && parentRoot && currentParent !== parentRoot.parentElement) {
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