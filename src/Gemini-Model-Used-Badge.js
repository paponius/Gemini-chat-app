// ==========================================
// SECTION: New DOM Data Observer & Debug (Part 1)
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
	`;

	function injectStyles() {
		if (document.getElementById('gls-model-badge-styles')) return;
		const styleEl = document.createElement('style');
		styleEl.id = 'gls-model-badge-styles';
		styleEl.textContent = STYLE;
		document.head.appendChild(styleEl);
	}

	let isProcessingQueue = false;
	const processingQueue = [];

	function initChatHistoryObserver() {
		console.log('[Gemini-chat-app model-used] Initializing global mutation observer for response containers.');

		// Function to check and queue response containers anywhere in the document
		const checkContainers = () => {
			const containers = document.querySelectorAll('response-container');
			containers.forEach(container => {
				if (!container.hasAttribute('data-gls-processed')) {
					container.setAttribute('data-gls-processed', 'queued');
					console.log('[Gemini-chat-app model-used] Queued new response container for processing:', container);
					processingQueue.push(container);
				}
			});
			processQueue();
		};

		// Run an initial check in case elements are already present
		checkContainers();

		// Observe document body for any dynamically added response containers (unlimited time / user action dependent)
		const bodyObserver = new MutationObserver(() => {
			checkContainers();
		});

		bodyObserver.observe(document.body, { childList: true, subtree: true });
	}

	async function processQueue() {
		if (isProcessingQueue) return;
		isProcessingQueue = true;
		console.log('[Gemini-chat-app model-used] processQueue() started. Current queue length:', processingQueue.length);

		try {
			while (processingQueue.length > 0) {
				const container = processingQueue.shift();
				if (!document.body.contains(container)) {
					console.log('[Gemini-chat-app model-used] Container is no longer attached to document DOM, skipping.');
					continue;
				}
				
				container.setAttribute('data-gls-processed', 'processing');
				console.log('[Gemini-chat-app model-used] Processing container:', container);
				try {
					await processSingleResponseContainer(container);
					container.setAttribute('data-gls-processed', 'true');
					console.log('[Gemini-chat-app model-used] Successfully processed and marked container as true.');
				} catch (err) {
					console.error('[Gemini-chat-app model-used] Error processing response container:', err);
					container.removeAttribute('data-gls-processed');
				}
				// Small breather between processing containers to prevent overlapping UI clicks
				await new Promise(r => setTimeout(r, 200));
			}
		} finally {
			isProcessingQueue = false;
			console.log('[Gemini-chat-app model-used] processQueue() completed. Queue empty.');
		}
	}

	async function processSingleResponseContainer(container) {
		// Wait patiently and poll for the menu button since response-container appears before its footer buttons are fully rendered/hydrated
		let menuButton = null;
		for (let i = 0; i < 100; i++) {
			menuButton = container.querySelector('.response-container-footer .menu-button-wrapper gem-icon-button');
			if (menuButton) break;
			await new Promise(r => setTimeout(r, 100));
		}

		if (!menuButton) {
			console.log('[Gemini-chat-app model-used] Menu button (.response-container-footer .menu-button-wrapper gem-icon-button) not found after waiting in container.');
			return;
		}
		console.log('[Gemini-chat-app model-used] Found menu button. Clicking to open first popup menu...');

		// 1. Click the first popup menu trigger button
		menuButton.click();

		// 2. Wait for the first popup menu containing [data-test-id="response-details-button"] to appear
		let detailsMenuItem = null;
		for (let i = 0; i < 30; i++) {
			detailsMenuItem = document.querySelector('gem-menu-item[data-test-id="response-details-button"]');
			if (detailsMenuItem) break;
			await new Promise(r => setTimeout(r, 50));
		}

		if (!detailsMenuItem) {
			console.error('[Gemini-chat-app model-used] Response details menu item ([data-test-id="response-details-button"]) not found after waiting.');
			document.body.click(); // Close any open menu
			return;
		}
		console.log('[Gemini-chat-app model-used] Found response details menu item. Clicking...');

		// 3. Click the "See response details" menu item to open the second popup/sidebar
		detailsMenuItem.click();

		// 4. Wait for the sidebar container and [data-test-id="model-line"] to appear
		let modelLine = null;
		for (let i = 0; i < 40; i++) {
			modelLine = document.querySelector('context-sidebar [data-test-id="model-line"]');
			if (modelLine) break;
			await new Promise(r => setTimeout(r, 50));
		}

		if (!modelLine) {
			console.error('[Gemini-chat-app model-used] Model line element ([data-test-id="model-line"]) not found in sidebar after waiting.');
			const closeButton = document.querySelector('context-sidebar button.close-button, context-sidebar .close-button');
			if (closeButton) closeButton.click();
			return;
		}

		const modelText = modelLine.textContent.trim();
		console.log('[Gemini-chat-app model-used] Successfully extracted model line text:', modelText);

		// 5. Close the sidebar by clicking on .close-button inside <context-sidebar>
		const closeButton = document.querySelector('context-sidebar button.close-button, context-sidebar .close-button');
		if (closeButton) {
			console.log('[Gemini-chat-app model-used] Closing sidebar via close button...');
			closeButton.click();
		} else {
			console.log('[Gemini-chat-app model-used] Sidebar close button not found, clicking document body...');
			document.body.click();
		}

		// Wait briefly for sidebar to unmount
		await new Promise(r => setTimeout(r, 100));

		// 6. Add obtained text as the last element of .response-container-footer .buttons-container-v2
		const buttonsContainer = container.querySelector('.response-container-footer .buttons-container-v2');
		if (buttonsContainer && !buttonsContainer.querySelector('.gls-model-badge')) {
			const badge = document.createElement('div');
			badge.className = 'gls-model-badge';
			badge.textContent = modelText;
			buttonsContainer.appendChild(badge);
			console.log('[Gemini-chat-app model-used] Injected model badge into buttons container:', badge);
		} else {
			console.log('[Gemini-chat-app model-used] Buttons container not found or badge already present.');
		}
	}

	injectStyles();
	setTimeout(() => {
		console.log('[Gemini-chat-app model-used] Initializing chat history observer timer triggered.');
		initChatHistoryObserver();
	}, 1000);

})();
