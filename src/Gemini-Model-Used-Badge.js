// ==========================================
// Gemini-Model-Used-Badge
// ==========================================

(function() {
	'use strict';

	const STYLE = `
		.gls-model-badge {
			display: inline-flex;
			align-items: center;
			padding: 4px 8px;
			font-size: 11px;
			opacity: 0.8;
			background: rgba(255, 255, 255, 0.05);
			border-radius: 8px;
			margin-left: 4px;
			user-select: none;
		}
		body.gls-hide-ui .cdk-overlay-container,
		body.gls-hide-ui context-sidebar {
			opacity: 0 !important;
			visibility: hidden !important;
			pointer-events: none !important;
			position: fixed !important;
			transition: none !important;
			animation: none !important;
		}
	`;

	function injectStyles() {
		if (document.getElementById('gls-model-badge-styles')) return;
		const styleEl = document.createElement('style');
		styleEl.id = 'gls-model-badge-styles';
		styleEl.textContent = STYLE;
		document.head.appendChild(styleEl);
	}

	var isProcessingQueue = false;
	var processingQueue = [];

	function initChatHistoryObserver(rootElement) {
		console.log('[GCA model-used] Initializing chat history observer for root element:', rootElement);

		// Function to check and queue conversation containers anywhere within the root or added subtree
		function checkContainers(target = rootElement) {
			if (target.nodeType !== Node.ELEMENT_NODE) return;

			// div.conversation-container, first time pending-.conversation-container is created, but is later removed
			if (target.matches('div.conversation-container')) {
				queueContainer(target);
			}

			// redundant, if a wrapper is inserted (todo maybe should warn in console, so code is fixed)
			const containers = target.querySelectorAll(':scope div.conversation-container');
			containers.forEach(container => queueContainer(container));
		}

		function queueContainer(container) {
			/* checks if `.response-container-footer .menu-button-wrapper gem-icon-button` is present
			in found element. if not, queryDynamic() will be used.
			the found element will be added to processingQueue now only if there are all necessary elements in it
			*/
			if (container.hasAttribute('data-gls-processed')) return;

			const menuButton = container.querySelector('.response-container-footer .menu-button-wrapper gem-icon-button');
			if (menuButton) {
				container.setAttribute('data-gls-processed', 'queued');
				console.log('[GCA model-used] Queued new conversation container for processing:', container);
				processingQueue.push({ container, menuButton });
				processQueue();
			} else {
				console.warn('[GCA model-used] Menu button not yet present in newly added container, waiting via queryDynamic:', container);
				queryDynamic('.response-container-footer .menu-button-wrapper gem-icon-button', resolvedMenuButton => {
					if (!container.hasAttribute('data-gls-processed')) {
						container.setAttribute('data-gls-processed', 'queued');
						console.log('[GCA model-used] Queued new conversation container for processing:', container);
						processingQueue.push({ container, menuButton: resolvedMenuButton });
						processQueue();
					}
				}, container);
			}
		}

		// Run an initial check in case conversation containers are already present
		checkContainers();

		// Observe the root element for any dynamically added conversation containers
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				for (const node of mutation.addedNodes) {
					if (node.nodeType === Node.ELEMENT_NODE) {
						checkContainers(node);
					}
				}
			}
		});

		observer.observe(rootElement, { childList: true, subtree: false });
	}

	async function processQueue() {
		if (isProcessingQueue) return;
		isProcessingQueue = true;
		console.log('[GCA model-used] processQueue() started. Current queue length:', processingQueue.length);

		try {
			while (processingQueue.length > 0) {
				const item = processingQueue.shift();
				const container = item.container;
				if (!document.body.contains(container)) {
					console.log('[GCA model-used] Container is no longer attached to document DOM, skipping.');
					continue;
				}
				
				container.setAttribute('data-gls-processed', 'processing');
				console.log('[GCA model-used] Processing container:', container);
				try {
					await processSingleResponseContainer(item);
					container.setAttribute('data-gls-processed', 'true');
					console.log('[GCA model-used] Successfully processed and marked container as true.');
				} catch (err) {
					console.error('[GCA model-used] Error processing response container:', err);
					container.removeAttribute('data-gls-processed');
				} finally {
					// Ensure UI suppression class is cleaned up even if an error occurs
					document.body.classList.remove('gls-hide-ui');
				}
				// Small breather between processing containers to prevent overlapping UI clicks
				await new Promise(r => setTimeout(r, 200));
			}
		} finally {
			isProcessingQueue = false;
			document.body.classList.remove('gls-hide-ui');
			console.log('[GCA model-used] processQueue() completed. Queue empty.');
		}
	}

	async function processSingleResponseContainer({ container, menuButton }) {
		// Suppress popups and sidebar reflows/flashing before automation begins
		document.body.classList.add('gls-hide-ui');

		// Check if any stale sidebar or thought summary is already open and close it first
		// todo: maybe we should only close existing, if it was us opening it, to not annoy users. And if it's open (not by us),
		//       just wait here until user closes it.
		var elSidebarPreExisting = document.querySelector('context-sidebar');
		if (elSidebarPreExisting) {
			let btnCloseExisting = elSidebarPreExisting ? elSidebarPreExisting.querySelector(':scope button.close-button, :scope .close-button') : null;
			if (btnCloseExisting) btnCloseExisting.click();
			else document.body.click();
			await new Promise(r => setTimeout(r, 50));
		}

		console.log('[GCA model-used] Found menu button. Clicking to open first popup menu...');

		// 1. Click the first popup menu trigger button
		menuButton.click();

		// 2. Wait for the first popup menu containing [data-test-id="response-details-button"] to appear
		const detailsMenuItem = await new Promise(resolve => {
			queryDynamic('~ .cdk-overlay-popover > .cdk-overlay-pane > .container > gem-menu > gem-menu-item[data-test-id="response-details-button"]', menuButton, item => {
				resolve(item);
			});
		});

		if (!detailsMenuItem) {
			console.error('[GCA model-used] Response details menu item ([data-test-id="response-details-button"]) not found.');
			document.body.click(); // Close any open menu
			document.body.classList.remove('gls-hide-ui');
			return;
		}
		console.log('[GCA model-used] Found response details menu item. Clicking...');

		// 3. Click the "See response details" menu item to open the second popup/sidebar
		detailsMenuItem.click();

		// 4. Wait for the sidebar container and [data-test-id="model-line"] to appear
		const modelLine = await new Promise(resolve => {
			queryDynamic('.content-container context-sidebar > .container > .feature-container > .ng-star-inserted > .thought-summary > [data-test-id="model-line"]', line => {
				resolve(line);
			});
		});

		if (!modelLine) {
			console.error('[GCA model-used] Model line element ([data-test-id="model-line"]) not found in sidebar.');
			let btnCloseErr = document.querySelector('context-sidebar button.close-button, context-sidebar .close-button');
			if (btnCloseErr) btnCloseErr.click();
			document.body.classList.remove('gls-hide-ui');
			return;
		}

		const modelText = modelLine.textContent.trim();
		console.log('[GCA model-used] Successfully extracted model line text:', modelText);

		// 5. Close the sidebar by clicking on .close-button inside <context-sidebar>
		var elSidebar = document.querySelector('context-sidebar');
		var btnClose = elSidebar ? elSidebar.querySelector(':scope button.close-button, :scope .close-button') : null;

		if (btnClose) {
			console.log('[GCA model-used] Closing sidebar via close button...');
			btnClose.click();
		} else {
			console.log('[GCA model-used] Sidebar close button not found, clicking document body...');
			document.body.click();
		}

		// Wait for elSidebar removal via MutationObserver on its parent, with a redundant 500ms timeout fallback
		if (elSidebar && elSidebar.parentNode) {
			await new Promise(resolve => {
				let observer = null;
				const timer = setTimeout(() => {
					if (observer) observer.disconnect();
					resolve();
				}, 500);

				observer = new MutationObserver((mutations) => {
					for (const mutation of mutations) {
						for (const node of mutation.removedNodes) {
							if (node === elSidebar) {
								clearTimeout(timer);
								observer.disconnect();
								resolve();
								return;
							}
						}
					}
				});

				observer.observe(elSidebar.parentNode, { childList: true });

				if (!elSidebar.parentNode.contains(elSidebar)) {
					clearTimeout(timer);
					observer.disconnect();
					resolve();
				}
			});
		} else {
			await new Promise(r => setTimeout(r, 100));
		}

		// Remove suppression class now that the sidebar is completely gone from the DOM
		document.body.classList.remove('gls-hide-ui');

		// 6. Add obtained text as the last element of .response-container-footer .buttons-container-v2
		const buttonsContainer = container.querySelector('.response-container-footer .buttons-container-v2');
		if (buttonsContainer && !buttonsContainer.querySelector('.gls-model-badge')) {
			const badge = document.createElement('div');
			badge.className = 'gls-model-badge';
			badge.textContent = modelText;
			buttonsContainer.appendChild(badge);
			console.log('[GCA model-used] Injected model badge into buttons container:', badge);
		} else {
			console.log('[GCA model-used] Buttons container not found or badge already present.');
		}
	}

	injectStyles();
	// 	console.log('[GCA model-used] Initializing chat history observer timer triggered.');
	queryDynamic('.chat-app .content-container infinite-scroller.chat-history', initChatHistoryObserver);

})();
