// ==========================================
// Gemini Thinking Level Switch
// ==========================================

(function() {
	'use strict';

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

})();
