(function() {
	'use strict';

	// ==========================================
	// SECTION: Common Utilities & Configuration
	// ==========================================

	// Global debug configuration variable managed via GM storage
	let hideOriginal = GM_getValue('hideOriginalPicker', true);

	GM_registerMenuCommand(
		hideOriginal ? "Show Original Picker" : "Hide Original Picker",
		() => {
			hideOriginal = !hideOriginal;
			GM_setValue('hideOriginalPicker', hideOriginal);
			if (hideOriginal) {
				document.body.classList.add('gls-hide-picker');
			} else {
				document.body.classList.remove('gls-hide-picker');
			}
		}
	);

	const STYLE = `
		#gemini-level-switch {
			display: inline-flex;
			align-items: center;
			background: rgba(255, 255, 255, 0.08);
			border-radius: 16px;
			padding: 2px;
			margin-right: 8px;
			font-size: 12px;
			color: inherit;
			user-select: none;
		}
		.gls-btn {
			background: transparent;
			border: none;
			color: inherit;
			padding: 4px 8px;
			border-radius: 14px;
			cursor: pointer;
			opacity: 0.7;
			transition: all 0.2s ease;
		}
		.gls-btn.active {
			background: rgba(255, 255, 255, 0.2);
			opacity: 1;
			font-weight: 500;
		}
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
		/* Hide original picker visually while keeping it fully clickable and functional */
		body.gls-hide-picker .model-picker-container {
			opacity: 0 !important;
			width: 1px !important;
			min-width: 0 !important;
			padding: 0 !important;
			margin: 0 !important;
			overflow: hidden !important;
			pointer-events: auto !important;
		}
		/* Completely hide the CDK overlay menu during programmatic checks to prevent any flash */
		body.gls-suppress-overlay .cdk-overlay-popover {
			visibility: hidden !important;
			opacity: 0 !important;
			pointer-events: none !important;
		}
		/* Suppress background flash/pressed state on the trigger button during programmatic checks */
		body.gls-suppress-overlay .input-area-switch.pressed {
			background-color: transparent !important;
		}
		/* Suppress chevron flip/rotation during programmatic checks */
		body.gls-suppress-overlay .dropdown-icon.open {
			transform: none !important;
		}
	`;

	function injectStyles() {
		if (document.getElementById('gls-styles')) return;
		const styleEl = document.createElement('style');
		styleEl.id = 'gls-styles';
		styleEl.textContent = STYLE;
		document.head.appendChild(styleEl);

		if (hideOriginal) {
			document.body.classList.add('gls-hide-picker');
		}
	}

	// ==========================================
	// SECTION: Gemini Thinking Level Switch Feature
	// ==========================================

	async function getMenuTrigger() {
		for (let i = 0; i < 30; i++) {
			// can not use, as mic button has these classes: mdc-icon-button mat-mdc-icon-button mat-mdc-button-base mat-badge mat-unthemed mat-badge-overlap mat-badge-above mat-badge-after mat-badge-small mat-badge-hidden ng-star-inserted
			const trigger = document.querySelector('.model-picker-container button:is(.mat-mdc-tooltip-trigger, .input-area-switch, .lm-enabled, [data-test-id="bard-mode-menu-button"])');
			if (trigger) {
				// Wait 400ms for the framework to finish hydration and attach listeners
				// await new Promise(r => setTimeout(r, 10000)); // debug only
				await new Promise(r => setTimeout(r, 400));
				// debugger;
				return trigger;
			}
			await new Promise(r => setTimeout(r, 200));
		}
		console.error('getMenuTrigger()');
		return null;
	}

	let isCreating = false;
	async function createSwitch() {
		if (document.getElementById('gemini-level-switch') || isCreating) return;
		isCreating = true;
		try {
			console.log('createSwitch()');

			// Find container left of the mic (inside trailing-actions-wrapper or input-buttons-wrapper-bottom)
			const targetContainer = document.querySelector('.trailing-actions-wrapper, .input-buttons-wrapper-bottom');
			if (!targetContainer) return;

			const menuTrigger = await getMenuTrigger();
			if (!menuTrigger) return;

			if (document.getElementById('gemini-level-switch')) return;

			console.log('createSwitch(): create DIV');
			const switchContainer = document.createElement('div');
			switchContainer.id = 'gemini-level-switch';

			['Low', 'Medium', 'High'].forEach(level => {
				const btn = document.createElement('button');
				btn.className = 'gls-btn';
				btn.setAttribute('data-level', level);
				btn.textContent = level;
				btn.addEventListener('click', async (e) => {
					e.stopPropagation();
					await setThinkingLevel(level);
					updateActiveState(level);
				});
				switchContainer.appendChild(btn);
			});

			targetContainer.prepend(switchContainer);
			detectCurrentState();
		} finally {
			isCreating = false;
		}
	}

	async function setThinkingLevel(targetLevel) {
		document.body.classList.add('gls-suppress-overlay');
		try {
		const menuTrigger = await getMenuTrigger();

		// 1. Click the main trailing actions wrapper / model picker trigger to open the menu overlay
		if (!menuTrigger) return;

		menuTrigger.click();

		// 2. Wait for the cdk overlay / gem-menu items to render in DOM
		let items = [];
		for (let i = 0; i < 20; i++) {
			items = Array.from(document.querySelectorAll('gem-menu-item'));
			if (items.length > 0) break;
			await new Promise(r => setTimeout(r, 50));
		}

		// 3. Find and click the item matching the target level text
		const targetItem = items.find(item => {
			const label = item.querySelector('.label');
			return label && label.textContent.trim().toLowerCase() === targetLevel.toLowerCase();
		});

		if (targetItem) {
			targetItem.click(); // 1.1
			/// const clickableElement = targetItem.querySelector('button') || targetItem.querySelector('gem-menu-item-content') || targetItem;
			/// clickableElement.click();
			// Optional: click outside or press Escape to close menu if needed, or let app handle it
			setTimeout(() => {
				document.body.click();
			}, 100);
		}
		} finally {
			setTimeout(() => {
				document.body.classList.remove('gls-suppress-overlay');
			}, 200);
		}
	}

	let isDetecting = false;
	async function detectCurrentState() {
		if (isDetecting) return;
		isDetecting = true;
		document.body.classList.add('gls-suppress-overlay');
		try {
		const menuTrigger = await getMenuTrigger();
		// Open menu briefly or check if menu items are already present to read current selected state
		console.log('detectCurrentState(): started, menuTrigger:', menuTrigger);
		if (!menuTrigger) return;

		console.log('detectCurrentState(): click()', menuTrigger);
		menuTrigger.click();

		let selectedLevel = null;
		for (let i = 0; i < 120; i++) {
			// gem-menu-item is not enough, there is another menu with these tags above .submenu-container
			const selectedItem = document.querySelector('.submenu-container gem-menu-item:is(.selected, [aria-selected="true"])');
			if (selectedItem) {
				console.log('detectCurrentState(): found selectedItem at attempt', i);
				const label = selectedItem.querySelector('.label');
				if (label) {
					selectedLevel = label.textContent.trim();
					console.log('detectCurrentState(): found label:', selectedLevel);
					break;
				}
			}

			// Fallback scan through items if class isn't caught directly
			const items = document.querySelectorAll('.submenu-container gem-menu-item');
			if (items.length > 0) {
				for (const item of items) {
					if (item.classList.contains('selected') || item.getAttribute('aria-selected') === 'true' || item.querySelector('.selected, [aria-selected="true"]')) {
						const label = item.querySelector('.label');
						if (label) {
							selectedLevel = label.textContent.trim();
							console.log('detectCurrentState(): found via scan, label:', selectedLevel);
							break;
						}
					}
				}
				if (selectedLevel) break;
			}

			console.log(`detectCurrentState(): waiting for menu items... attempt ${i + 1}`);
			await new Promise(r => setTimeout(r, 1000));
		}

		updateActiveState(selectedLevel);

		 // Close menu after check
		setTimeout(() => {
			document.body.click();
		}, 50);
		} finally {
			setTimeout(() => {
				document.body.classList.remove('gls-suppress-overlay');
			}, 200);
			isDetecting = false;
		}
	}

	function updateActiveState(level) {
		const switchContainer = document.getElementById('gemini-level-switch');
		if (!switchContainer) return;

		switchContainer.querySelectorAll('.gls-btn').forEach(btn => {
			if (level && btn.getAttribute('data-level').toLowerCase() === level.toLowerCase()) {
				btn.classList.add('active');
			} else {
				btn.classList.remove('active');
			}
		});
	}

	// Observe DOM changes to ensure the switch persists and attaches properly
	const observer = new MutationObserver(() => {
		if (!document.getElementById('gemini-level-switch')) {
			createSwitch();
		}
	});

	observer.observe(document.body, { childList: true, subtree: true });

	injectStyles();
	// 1.4 // setTimeout(createSwitch, 3000);
	createSwitch();

	// ==========================================
	// SECTION: New DOM Data Observer & Debug (Part 1)
	// ==========================================

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

	setTimeout(() => {
		console.log('[Gemini-chat-app model-used] Initializing chat history observer timer triggered.');
		initChatHistoryObserver();
	}, 1000);

})();
