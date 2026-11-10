/**
 * Query-Dynamic.js
 * A lightweight DOM observation debug helper for monitoring delayed element lifecycles
 * with cascade recovery, incremental backoff fallback, and visual debugging via data-qd attributes.
 */

// Helper for cleaner console logs: returns milliseconds since page load
function getElapsedTimestamp() {
	return `+${performance.now().toFixed(2)}ms`;
}

// Global registry to track active query-dynamic instances across re-injections
window.__queryDynamicInstances = window.__queryDynamicInstances || {};

// TEST
// (async () => { let el = await queryDynamic('body .chat-app chat-window-content .response-container .response-container-footer .more-menu-button-container'); console.log(getElapsedTimestamp(), '[QD] SUCCESS:', el); })();

function queryDynamic(complexSelector, rootInput = document.body, fallBackTimeout = 10) {
	return new Promise((resolve) => {
		// Support flexible argument ordering: (selector, root) or (selector, timeout)
		let rootElement = document.body;
		let timeoutVal = fallBackTimeout;

		if (rootInput) {
			if (typeof rootInput === 'number') {
				timeoutVal = rootInput;
			} else {
				rootElement = typeof rootInput === 'string' ? document.querySelector(rootInput) : rootInput;
				if (!rootElement) {
					console.warn(getElapsedTimestamp(), '[QD] ERROR: Provided root element/selector not found in DOM:', rootInput);
					rootElement = document.body;
				}
			}
		}

		console.log(getElapsedTimestamp(), '[QD] Initializing queryDynamic with selector:', complexSelector, 'on root:', rootElement);

		// Instance control object for cleanup
		var instance = {
			observers: [],
			timers: [],
			rootElement: rootElement,
			cleanup() {
				this.observers.forEach(obs => obs.disconnect());
				this.observers = [];
				this.timers.forEach(t => clearTimeout(t));
				this.timers = [];
			}
		};
		window.__queryDynamicInstances[complexSelector] = instance;

		// Decompose the complex selector into sequential simple segments.
		// Example: " > .b" or ".a + .b ~ .c > .target"
		let segments = parseSelectorSegments(complexSelector);
		console.log(getElapsedTimestamp(), '[QD] Parsed segments:', segments);
		if (segments.length === 0) {
			console.warn(getElapsedTimestamp(), '[QD] ERROR: No valid segments parsed from selector.');
			resolve(null);
			return;
		}

		resolveSegment(rootElement, segments, 0, (element) => {
			resolve(element);
		}, () => {
			resolve(null);
		}, instance, timeoutVal);
	});
}

function parseSelectorSegments(selectorStr) {
	let segments = [];
	let currentToken = '';
	let pendingCombinator = ' ';
	let depth = 0;

	// Traverse character by character to respect parentheses and brackets inside selectors (e.g. :is(...))
	for (let i = 0; i < selectorStr.length; i++) {
		let char = selectorStr[i];

		if (char === '(' || char === '[') depth++;
		if (char === ')' || char === ']') depth--;

		if (depth === 0 && (char === '>' || char === '+' || char === '~')) {
			if (currentToken.trim()) {
				segments.push({ selector: currentToken.trim(), combinator: pendingCombinator });
				currentToken = '';
			}
			pendingCombinator = char;
			continue;
		}

		if (depth === 0 && /\s/.test(char)) {
			if (currentToken.trim()) {
				segments.push({ selector: currentToken.trim(), combinator: pendingCombinator });
				currentToken = '';
				pendingCombinator = ' ';
			}
			continue;
		}

		currentToken += char;
	}

	if (currentToken.trim()) {
		segments.push({ selector: currentToken.trim(), combinator: pendingCombinator });
	}

	return segments;
}

function resolveSegment(prevElement, segments, index, successResolve, failureResolve, instance, fallBackTimeout) {
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
		handleSegmentFound(found, prevElement, segments, index, successResolve, failureResolve, instance, fallBackTimeout);
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
		failureResolve();
		return;
	}

	console.log(getElapsedTimestamp(), `[QD] Segment [${index}] not found yet. Setting up tree observer on root:`, observeRoot);

	let stateLabel = `observing tree for: ${current.selector}`;
	observeRoot.setAttribute('data-qd', stateLabel);

	let resolved = false;

	let observer = new MutationObserver((mutations) => {
		console.debug(getElapsedTimestamp(), `[QD] Mutation fired on root for segment [${index}]`, { mutations, observeRoot });
		if (resolved) return;
		let match = findMatch();
		if (match) {
			resolved = true;
			console.log(getElapsedTimestamp(), `[QD] Segment [${index}] matched via MutationObserver -> resolved match:`, match);
			// Remove from instance tracking
			instance.cleanup();
			handleSegmentFound(match, prevElement, segments, index, successResolve, failureResolve, instance, fallBackTimeout);
		}
	});

	observer.observe(observeRoot, observerOptions);
	instance.observers.push(observer);

	// Fallback polling with proportional schedule where fallBackTimeout is the max ceiling (in seconds)
	if (fallBackTimeout) {
		const maxMs = (typeof fallBackTimeout === 'number' ? fallBackTimeout : 10) * 1000;
		const firstMs = Math.min(Math.max(maxMs * 0.1, 200), 2000); // Proportional first check (10% of max, bounded between 200ms and 2s)

		let delays = [];
		let currentDelay = firstMs;
		while (currentDelay < maxMs) {
			delays.push(Math.round(currentDelay));
			currentDelay *= 2;
		}
		delays.push(maxMs); // Ensures the final attempt hits the exact max timeout ceiling

		let attempt = 0;

		let runFallback = () => {
			if (resolved) return;
			let match = findMatch();
			if (match) {
				resolved = true;
				console.warn(getElapsedTimestamp(), `[QD] WARNING: MutationObserver missed segment [${index}], but fallback polling successfully resolved match:`, match);
				instance.cleanup();
				handleSegmentFound(match, prevElement, segments, index, successResolve, failureResolve, instance, fallBackTimeout);
				return;
			}

			attempt++;
			if (attempt < delays.length) {
				let timer = setTimeout(runFallback, delays[attempt]);
				instance.timers.push(timer);
			} else {
				console.error(getElapsedTimestamp(), `[QD] ERROR: Failed to resolve segment [${index}] ("${current.selector}") after exhausting all incremental fallback retries (${fallBackTimeout}s total ceiling).`);
				instance.cleanup();
				failureResolve();
			}
		};

		let initialTimer = setTimeout(runFallback, delays[0]);
		instance.timers.push(initialTimer);
	}
}

function handleSegmentFound(element, parentRoot, segments, index, successResolve, failureResolve, instance, fallBackTimeout) {
	var isLast = index === segments.length - 1;

	// Set up flat standing guards on every parent/ancestor along the entire path up to parentRoot
	setupPathGuards(element, parentRoot, segments, index, successResolve, failureResolve, instance, fallBackTimeout);

	if (isLast) {
		console.log(getElapsedTimestamp(), '[QD] SUCCESS: Final target element resolved successfully:', element);
		// Mark final element as handled
		element.setAttribute('data-qd', 'handled');
		
		successResolve(element);
	} else {
		console.log(getElapsedTimestamp(), `[QD] Intermediate segment [${index}] resolved. Setting path guards and proceeding to next segment.`);
		
		// Proceed to next segment
		resolveSegment(element, segments, index + 1, successResolve, failureResolve, instance, fallBackTimeout);
	}
}

function setupPathGuards(element, parentRoot, segments, index, successResolve, failureResolve, instance, fallBackTimeout) {
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
							resolveSegment(instance.rootElement, segments, 0, successResolve, failureResolve, instance, fallBackTimeout);
						} else {
							console.log(getElapsedTimestamp(), '[QD] Cascade Recovery: Found surviving ancestor with data-qd:', fallbackRoot);
							resolveSegment(fallbackRoot, segments, index, successResolve, failureResolve, instance, fallBackTimeout);
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